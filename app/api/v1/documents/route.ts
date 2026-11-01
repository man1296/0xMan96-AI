import { readJson } from "@/lib/http/read-json";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const requestSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(180),
  mimeType: z.enum(["application/pdf","text/plain","text/markdown","text/csv","application/json"]),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024)
}).strict();

const allowedExtensions: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt"],
  "text/markdown": [".md",".markdown"],
  "text/csv": [".csv"],
  "application/json": [".json"]
};

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const workspaceId = new URL(request.url).searchParams.get("workspaceId");
    if (!workspaceId || !z.string().uuid().safeParse(workspaceId).success) return NextResponse.json({ error: "invalid_workspace" }, { status: 400 });
    const { data, error } = await supabase.from("knowledge_documents").select("id, name, mime_type, size_bytes, status, chunk_count, created_at").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(100);
    if (error) return NextResponse.json({ error: "documents_unavailable" }, { status: 503 });
    return NextResponse.json({ documents: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    let raw: unknown;
    try { raw = await readJson(request, 8 * 1024); }
    catch (error) { const tooLarge = error instanceof Error && error.message === "request_too_large"; return NextResponse.json({ error: tooLarge ? "payload_too_large" : "invalid_json" }, { status: tooLarge ? 413 : 400 }); }
    const parsed = requestSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

    const { workspaceId, name, mimeType, sizeBytes } = parsed.data;
    const extension = name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
    if (!allowedExtensions[mimeType].includes(extension)) return NextResponse.json({ error: "file_type_mismatch" }, { status: 400 });

    const { data: allowed, error: limitError } = await supabase.rpc("consume_api_rate_limit", { p_bucket: "document-upload", p_max_requests: 30, p_window_seconds: 3600 });
    if (limitError) return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
    if (!allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

    const id = crypto.randomUUID();
    const safeName = name.normalize("NFKC").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150);
    const path = workspaceId + "/" + user.id + "/" + id + "-" + safeName;
    const { data: signed, error: signedError } = await supabase.storage.from("workspace-assets").createSignedUploadUrl(path);
    if (signedError || !signed) return NextResponse.json({ error: "upload_unavailable" }, { status: 503 });

    const { data: document, error: insertError } = await supabase.from("knowledge_documents").insert({
      workspace_id: workspaceId, user_id: user.id, name, mime_type: mimeType,
      size_bytes: sizeBytes, storage_path: path, status: "uploading"
    }).select("id, name, status, storage_path").single();
    if (insertError) {
      await supabase.storage.from("workspace-assets").remove([path]);
      return NextResponse.json({ error: "document_record_failed" }, { status: 403 });
    }
    return NextResponse.json({ document, upload: { path: signed.path, token: signed.token } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
