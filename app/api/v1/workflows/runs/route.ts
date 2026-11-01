import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId");
  if (!workspaceId || !z.string().uuid().safeParse(workspaceId).success) {
    return NextResponse.json({ error: "invalid_workspace_id" }, { status: 400 });
  }
  const [runsResult, stepsResult] = await Promise.all([
    supabase.from("workflow_runs").select("id,workflow_id,agent_task_id,status,started_at,completed_at,created_at")
      .eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(50),
    supabase.from("workflow_step_runs").select("id,run_id,step_index,name,status,requires_approval,input,output,error_code,started_at,completed_at,created_at")
      .eq("workspace_id", workspaceId).order("step_index", { ascending: true }).limit(300)
  ]);
  if (runsResult.error || stepsResult.error) return NextResponse.json({ error: "workflow_history_query_failed" }, { status: 400 });
  return NextResponse.json({ runs: runsResult.data ?? [], steps: stepsResult.data ?? [] });
}
