import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    openRouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    defaultModelConfigured: Boolean(process.env.OPENROUTER_DEFAULT_MODEL || "anthropic/claude-opus-5")
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
