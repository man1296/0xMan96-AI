import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const idSchema = z.string().uuid();

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "invalid_document_id" }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: document, error: readError } = await supabase.from("knowledge_documents")
      .select("id, storage_path, status").eq("id", id).single();
    if (readError || !document) return NextResponse.json({ error: "document_not_found" }, { status: 404 });

    const { error: objectError } = await supabase.storage.from("workspace-assets").createSignedUrl(document.storage_path, 60);
    if (objectError) return NextResponse.json({ error: "uploaded_object_not_found" }, { status: 409 });

    const { data, error } = await supabase.from("knowledge_documents").update({ status: "uploaded" })
      .eq("id", id).select("id, name, status, size_bytes, created_at").single();
    if (error) return NextResponse.json({ error: "document_update_failed" }, { status: 503 });
    return NextResponse.json({ document: data }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!idSchema.safeParse(id).success) return NextResponse.json({ error: "invalid_document_id" }, { status: 400 });
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const { data: document, error: readError } = await supabase.from("knowledge_documents")
      .select("id, storage_path").eq("id", id).single();
    if (readError || !document) return NextResponse.json({ error: "document_not_found" }, { status: 404 });

    const { error: storageError } = await supabase.storage.from("workspace-assets").remove([document.storage_path]);
    if (storageError) return NextResponse.json({ error: "storage_delete_failed" }, { status: 503 });
    const { error } = await supabase.from("knowledge_documents").delete().eq("id", id);
    if (error) return NextResponse.json({ error: "document_delete_failed" }, { status: 503 });
    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
