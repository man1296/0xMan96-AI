import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/http/read-json";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ approved: z.boolean() }).strict();

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "invalid_task_id" }, { status: 400 });
  let raw: unknown;
  try { raw = await readJson(request, 4096); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const [supabaseUrl, serviceRoleKey] = await Promise.all([getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL"), getRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY")]);
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "agent_runtime_not_configured" }, { status: 503 });
  const admin: any = createSupabaseClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: task, error: taskError } = await admin.from("agent_tasks")
    .select("id,workspace_id,status,approval").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (taskError || !task) return NextResponse.json({ error: "task_not_found" }, { status: 404 });
  const { data: workspace } = await supabase.from("workspaces").select("id").eq("id", task.workspace_id).maybeSingle();
  if (!workspace) return NextResponse.json({ error: "workspace_access_denied" }, { status: 403 });
  if (task.status !== "awaiting_approval") {
    return NextResponse.json({ error: "task_not_awaiting_approval" }, { status: 409 });
  }
  const approval = task.approval && typeof task.approval === "object" ? task.approval as Record<string, unknown> : {};
  const { data: run } = await admin.from("workflow_runs").select("id").eq("agent_task_id", id).eq("user_id", user.id).maybeSingle();
  const stepIndex = Number(approval.pending_step_index);
  if (!Number.isInteger(stepIndex) || stepIndex < 0 || stepIndex > 5 || typeof approval.step_fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(approval.step_fingerprint)) {
    return NextResponse.json({ error: "approval_context_invalid" }, { status: 409 });
  }
  if (!run) return NextResponse.json({ error: "workflow_run_not_found" }, { status: 409 });

  if (!parsed.data.approved) {
    const { data: updatedTask, error: updateError } = await admin.from("agent_tasks").update({
      status: "cancelled", approval: { ...approval, decision: "rejected", decided_by: user.id, decided_at: new Date().toISOString() },
      lease_expires_at: null, completed_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq("id", id).eq("status", "awaiting_approval").select("id").maybeSingle();
    if (updateError) return NextResponse.json({ error: "approval_update_failed" }, { status: 400 });
    if (!updatedTask) return NextResponse.json({ error: "approval_already_decided" }, { status: 409 });
    await admin.from("workflow_step_runs").update({ status: "failed", error_code: "approval_rejected", completed_at: new Date().toISOString() })
      .eq("run_id", run?.id ?? "").eq("run_id", run?.id ?? "").eq("workspace_id", task.workspace_id).eq("user_id", user.id).eq("step_index", stepIndex);
    await supabase.from("workflow_runs").update({ status: "cancelled", completed_at: new Date().toISOString() })
      .eq("agent_task_id", id).eq("user_id", user.id);
    return NextResponse.json({ status: "cancelled" });
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase.from("agent_tasks").update({
    status: "queued", approval: { ...approval, decision: "approved", decided_by: user.id, decided_at: now },
    run_at: now, lease_expires_at: null, updated_at: now
  }).eq("id", id).eq("status", "awaiting_approval").select("id").maybeSingle();
  if (updateError) return NextResponse.json({ error: "approval_update_failed" }, { status: 400 });
  if (!updatedTask) return NextResponse.json({ error: "approval_already_decided" }, { status: 409 });
  await supabase.from("workflow_step_runs").update({ status: "queued" })
    .eq("workspace_id", task.workspace_id).eq("user_id", user.id).eq("step_index", stepIndex);
  await supabase.from("workflow_runs").update({ status: "queued", completed_at: null })
    .eq("agent_task_id", id).eq("user_id", user.id);
  return NextResponse.json({ status: "approved", resumed: true });
}
