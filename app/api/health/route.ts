import { NextResponse } from "next/server";
import { getRuntimeEnv } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    supabaseConfigured: Boolean(getRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL") && getRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")),
    openRouterConfigured: Boolean(getRuntimeEnv("OPENROUTER_API_KEY")),
    defaultModelConfigured: Boolean(getRuntimeEnv("OPENROUTER_DEFAULT_MODEL") || "openrouter/free")
  };
  const readyForAuth = checks.supabaseConfigured;
  return NextResponse.json({
    service: "0xMan96 AI API",
    status: readyForAuth ? "configuration_present" : "configuration_missing",
    checks,
    note: "Configuration presence only; this endpoint does not certify upstream availability or provider credits.",
    timestamp: new Date().toISOString()
  }, { status: readyForAuth ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
