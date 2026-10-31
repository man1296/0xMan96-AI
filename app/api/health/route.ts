import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    supabaseConfigured: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    aiGatewayConfigured: Boolean(process.env.AI_GATEWAY_BASE_URL && process.env.AI_GATEWAY_API_KEY && process.env.AI_DEFAULT_MODEL)
  };
  const readyForAuth = checks.supabaseConfigured;
  return NextResponse.json({
    service: "0xMan96 AI API",
    status: readyForAuth ? "configuration_present" : "configuration_missing",
    checks,
    note: "This endpoint checks environment configuration only; it does not certify upstream availability.",
    timestamp: new Date().toISOString()
  }, { status: readyForAuth ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
