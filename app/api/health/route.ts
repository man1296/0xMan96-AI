import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    aiGateway: Boolean(process.env.AI_GATEWAY_BASE_URL && process.env.AI_GATEWAY_API_KEY && process.env.AI_DEFAULT_MODEL)
  };
  const configured = checks.supabase;
  return NextResponse.json({
    service: "0xMan96 AI API",
    status: configured ? "operational" : "not_configured",
    checks,
    timestamp: new Date().toISOString()
  }, { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
