import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/http/read-json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
 workspaceId:z.string().uuid(), agentId:z.string().uuid().optional(), workflowId:z.string().uuid().optional(),
 task:z.string().trim().min(1).max(12000)
}).strict();

export async function GET(request:Request){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const url=new URL(request.url), workspaceId=url.searchParams.get("workspaceId");
 if(!workspaceId||!z.string().uuid().safeParse(workspaceId).success)return NextResponse.json({error:"invalid_workspace_id"},{status:400});
 const {data,error:queryError}=await supabase.from("agent_tasks").select("id,workspace_id,agent_id,workflow_id,status,task,plan,results,attempts,max_attempts,last_error,run_at,lease_expires_at,started_at,completed_at,created_at,updated_at").eq("workspace_id",workspaceId).order("created_at",{ascending:false}).limit(50);
 if(queryError)return NextResponse.json({error:"task_query_failed"},{status:400});
 return NextResponse.json({tasks:data});
}
export async function POST(request:Request){
 const supabase=await createClient();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return NextResponse.json({error:"unauthorized"},{status:401});
 let raw:unknown;try{raw=await readJson(request,16*1024)}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
 const parsed=schema.safeParse(raw);if(!parsed.success)return NextResponse.json({error:"invalid_request",details:parsed.error.flatten()},{status:400});
 const v=parsed.data;
 const {data:workspace,error:workspaceError}=await supabase.from("workspaces").select("id").eq("id",v.workspaceId).maybeSingle();
 if(workspaceError||!workspace)return NextResponse.json({error:"workspace_not_found"},{status:404});
 if(v.agentId){const {data:agent,error:agentError}=await supabase.from("agents").select("id").eq("id",v.agentId).eq("workspace_id",v.workspaceId).eq("enabled",true).maybeSingle();if(agentError||!agent)return NextResponse.json({error:"agent_not_found"},{status:404});}
 if(v.workflowId){const {data:workflow,error:workflowError}=await supabase.from("workflow_definitions").select("id").eq("id",v.workflowId).eq("workspace_id",v.workspaceId).eq("enabled",true).maybeSingle();if(workflowError||!workflow)return NextResponse.json({error:"workflow_not_found"},{status:404});}
 const {data:task,error:insertError}=await supabase.from("agent_tasks").insert({workspace_id:v.workspaceId,user_id:user.id,agent_id:v.agentId??null,workflow_id:v.workflowId??null,task:v.task,status:"queued"}).select("id,status,created_at").single();
 if(insertError||!task)return NextResponse.json({error:"task_enqueue_failed"},{status:400});
 const {data:run,error:runError}=await supabase.from("workflow_runs").insert({workspace_id:v.workspaceId,user_id:user.id,workflow_id:v.workflowId??null,agent_task_id:task.id,status:"queued",trigger_payload:{source:"agent_chat"}}).select("id").single();
 if(runError)return NextResponse.json({task,warning:"task_queued_but_run_record_failed"},{status:202});
 return NextResponse.json({task,runId:run.id},{status:202});
}
