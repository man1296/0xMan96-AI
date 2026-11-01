import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { readJson } from "@/lib/http/read-json";
export const runtime="nodejs";export const dynamic="force-dynamic";
const schema=z.object({workspaceId:z.string().uuid(),name:z.string().trim().min(1).max(120),description:z.string().max(2000).optional(),instructions:z.string().max(20000).optional(),config:z.record(z.string(),z.unknown()).optional()}).strict();
export async function GET(request:Request){
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return NextResponse.json({error:"unauthorized"},{status:401});
 const workspaceId=new URL(request.url).searchParams.get("workspaceId");if(!workspaceId||!z.string().uuid().safeParse(workspaceId).success)return NextResponse.json({error:"invalid_workspace_id"},{status:400});
 const {data,error:q}=await supabase.from("agents").select("id,name,description,instructions,config,enabled,created_at,updated_at").eq("workspace_id",workspaceId).order("updated_at",{ascending:false}).limit(100);
 if(q)return NextResponse.json({error:"agent_query_failed"},{status:400});return NextResponse.json({agents:data});
}
export async function POST(request:Request){
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return NextResponse.json({error:"unauthorized"},{status:401});
 let raw:unknown;try{raw=await readJson(request,32*1024)}catch{return NextResponse.json({error:"invalid_json"},{status:400})}
 const p=schema.safeParse(raw);if(!p.success)return NextResponse.json({error:"invalid_request",details:p.error.flatten()},{status:400});const v=p.data;
 const {data,error:insertError}=await supabase.from("agents").insert({workspace_id:v.workspaceId,user_id:user.id,name:v.name,description:v.description??"",instructions:v.instructions??"",config:v.config??{}}).select("id,name,description,instructions,config,enabled,created_at").single();
 if(insertError)return NextResponse.json({error:"agent_create_failed"},{status:400});return NextResponse.json({agent:data},{status:201});
}
