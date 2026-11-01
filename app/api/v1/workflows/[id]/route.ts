import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/http/read-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  workspaceId: z.string().uuid(),
  enabled: z.boolean()
}).strict();

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "invalid_workflow_id" }, { status: 400 });
  }

  let raw: unknown;
  try { raw = await readJson(request, 4096); }
  catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { data: workflow, error: queryError } = await supabase.from("workflow_definitions")
    .select("id,trigger_type,trigger_config")
    .eq("id", id)
    .eq("workspace_id", parsed.data.workspaceId)
    .maybeSingle();
  if (queryError || !workflow) return NextResponse.json({ error: "workflow_not_found" }, { status: 404 });
  if (workflow.trigger_type !== "schedule") {
    return NextResponse.json({ error: "workflow_is_not_scheduled" }, { status: 409 });
  }

  const interval = workflow.trigger_config?.interval;
  const intervalMs = interval === "hourly" ? 3600000 : interval === "daily" ? 86400000 : interval === "weekly" ? 604800000 : 0;
  if (parsed.data.enabled && !intervalMs) {
    return NextResponse.json({ error: "invalid_workflow_schedule" }, { status: 409 });
  }

  const { data, error: updateError } = await supabase.from("workflow_definitions")
    .update({
      enabled: parsed.data.enabled,
      next_run_at: parsed.data.enabled ? new Date(Date.now() + intervalMs).toISOString() : null,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("workspace_id", parsed.data.workspaceId)
    .select("id,enabled,next_run_at")
    .single();
  if (updateError || !data) return NextResponse.json({ error: "workflow_update_failed" }, { status: 400 });
  return NextResponse.json({ workflow: data });
}
