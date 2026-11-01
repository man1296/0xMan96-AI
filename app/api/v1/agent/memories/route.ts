import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/http/read-json";
export const runtime="nodejs";export const dynamic="force-dynamic";
const schema=z.object({workspaceId:z.string().uuid(),agentId:z.string().uuid().optional(),category:z.enum(["project_context","preference","decision","research_finding","standing_instruction","feedback"]),content:z.string().trim().min(1).max(12000),source:z.string().trim().max(80).optional(),importance:z.number().int().min(1).max(5).optional(),pinned:z.boolean().optional()}).strict();
export async function GET(request:Request){
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const workspaceId=new URL(request.url).searchParams.get("workspaceId");if(!workspaceId||!z.string().uuid().safeParse(workspaceId).success)return NextResponse.json({error:"invalid_workspace_id"},{status:400});
 const {data,error:q}=await supabase.from("agent_memories").select("id,agent_id,category,content,source,importance,pinned,created_at,updated_at").eq("workspace_id",workspaceId).order("pinned",{ascending:false}).order("importance",{ascending:false}).order("updated_at",{ascending:false}).limit(200);
 if(q)return NextResponse.json({error:"memory_query_failed"},{status:400});return NextResponse.json({memories:data});
}
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return NextResponse.json({error:"unauthorized"},{status:401});
 let raw:unknown;try{raw=await readJson(request,16*1024)}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
 const p=schema.safeParse(raw);if(!p.success)return NextResponse.json({error:"invalid_request",details:p.error.flatten()},{status:400});const v=p.data;
 if(v.agentId){const {data:agent,error:agentError}=await supabase.from("agents").select("id").eq("id",v.agentId).eq("workspace_id",v.workspaceId).maybeSingle();if(agentError||!agent)return NextResponse.json({error:"agent_not_found"},{status:404});}
 const {data,error:insertError}=await supabase.from("agent_memories").insert({workspace_id:v.workspaceId,user_id:user.id,agent_id:v.agentId??null,category:v.category,content:v.content,source:v.source??"user",importance:v.importance??3,pinned:v.pinned??false}).select("id,category,content,source,importance,pinned,created_at").single();
 if(insertError)return NextResponse.json({error:"memory_save_failed"},{status:400});return NextResponse.json({memory:data},{status:201});
}
