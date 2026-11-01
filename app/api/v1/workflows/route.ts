import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/http/read-json";
import { validateWorkflowSteps } from "@/lib/agent/workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional(),
  steps: z.array(z.unknown()).max(6),
  scheduleInterval: z.enum(["hourly", "daily", "weekly"]).optional()
}).strict();

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId || !z.string().uuid().safeParse(workspaceId).success) {
    return NextResponse.json({ error: "invalid_workspace_id" }, { status: 400 });
  }
  const { data, error: queryError } = await supabase.from("workflow_definitions")
    .select("id,agent_id,name,description,trigger_type,trigger_config,steps,enabled,next_run_at,last_triggered_at,created_at,updated_at")
    .eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(100);
  if (queryError) return NextResponse.json({ error: "workflow_query_failed" }, { status: 400 });
  return NextResponse.json({ workflows: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try { raw = await readJson(request, 48 * 1024); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });
  const value = parsed.data;
  if (value.scheduleInterval) {
    const { count, error: scheduleCountError } = await supabase.from("workflow_definitions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", value.workspaceId)
      .eq("user_id", user.id)
      .eq("trigger_type", "schedule")
      .eq("enabled", true);
    if (scheduleCountError) return NextResponse.json({ error: "workflow_schedule_limit_check_failed" }, { status: 400 });
    if ((count ?? 0) >= 5) {
      return NextResponse.json({ error: "active_workflow_schedule_limit_reached", limit: 5 }, { status: 429 });
    }
  }
  let steps;
  try { steps = validateWorkflowSteps(value.steps); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "invalid_workflow_steps" }, { status: 400 });
  }
  if (value.agentId) {
    const { data: agent, error: agentError } = await supabase.from("agents").select("id")
      .eq("id", value.agentId).eq("workspace_id", value.workspaceId).maybeSingle();
    if (agentError || !agent) return NextResponse.json({ error: "agent_not_found" }, { status: 404 });
  }
  const { data, error: insertError } = await supabase.from("workflow_definitions").insert({
    workspace_id: value.workspaceId, user_id: user.id, agent_id: value.agentId ?? null,
    name: value.name, description: value.description ?? "",
    trigger_type: value.scheduleInterval ? "schedule" : "manual",
    trigger_config: value.scheduleInterval ? { interval: value.scheduleInterval } : {},
    next_run_at: value.scheduleInterval
      ? new Date(Date.now() + (value.scheduleInterval === "hourly" ? 3600000 : value.scheduleInterval === "daily" ? 86400000 : 604800000)).toISOString()
      : null,
    steps
  }).select("id,name,description,trigger_type,trigger_config,steps,enabled,next_run_at,last_triggered_at,created_at").single();
  if (insertError?.message?.includes("active_workflow_schedule_limit_reached")) {
    return NextResponse.json({ error: "active_workflow_schedule_limit_reached", limit: 5 }, { status: 429 });
  }
  if (insertError) return NextResponse.json({ error: "workflow_create_failed" }, { status: 400 });
  return NextResponse.json({ workflow: data }, { status: 201 });
}
