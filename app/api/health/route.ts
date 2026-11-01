import { NextResponse } from "next/server";
import { readRuntimeEnv } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [supabaseUrl, supabaseAnonKey, openRouter, defaultModel] = await Promise.all([
    readRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL"),
    readRuntimeEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    readRuntimeEnv("OPENROUTER_API_KEY"),
    readRuntimeEnv("OPENROUTER_DEFAULT_MODEL")
  ]);

  const checks = {
    supabaseConfigured: Boolean(supabaseUrl.value && supabaseAnonKey.value),
    openRouterConfigured: Boolean(openRouter.value),
    defaultModelConfigured: Boolean(defaultModel.value || "openrouter/free")
  };
  const readyForAuth = checks.supabaseConfigured;

  return NextResponse.json({
    service: "0xMan96 AI API",
    status: readyForAuth ? "configuration_present" : "configuration_missing",
    checks,
    diagnostics: {
      openRouterKeySource: openRouter.source
    },
    note: "Configuration presence only; this endpoint does not certify upstream availability or provider credits. Diagnostics expose source status only, never secret values.",
    timestamp: new Date().toISOString()
  }, { status: readyForAuth ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
