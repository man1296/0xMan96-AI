import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const { data: profile, error: profileError } = await supabase.from("profiles").select("id, display_name, avatar_url, created_at").eq("id", user.id).maybeSingle();
    if (profileError) return NextResponse.json({ error: "profile_unavailable" }, { status: 503 });
    return NextResponse.json({ user: { id: user.id, email: user.email }, profile }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
