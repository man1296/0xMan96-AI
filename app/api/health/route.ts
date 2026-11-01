import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { readRuntimeEnv } from "@/lib/runtime-env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getRuntimeDiagnostics() {
  const processEnv = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    openRouterApiKey: typeof process.env["OPENROUTER_API_KEY"] === "string" && process.env["OPENROUTER_API_KEY"].length > 0
  };

  let openNextContext: {
    available: boolean;
    supabaseUrl: boolean;
    supabaseAnonKey: boolean;
    openRouterApiKey: boolean;
  } = {
    available: false,
    supabaseUrl: false,
    supabaseAnonKey: false,
    openRouterApiKey: false
  };

  try {
    const env = getCloudflareContext().env as unknown as Record<string, unknown>;
    openNextContext = {
      available: true,
      supabaseUrl: typeof env.NEXT_PUBLIC_SUPABASE_URL === "string" && env.NEXT_PUBLIC_SUPABASE_URL.length > 0,
      supabaseAnonKey: typeof env.NEXT_PUBLIC_SUPABASE_ANON_KEY === "string" && env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 0,
      openRouterApiKey: typeof env.OPENROUTER_API_KEY === "string" && env.OPENROUTER_API_KEY.length > 0
    };
  } catch {
    // The request may not have an OpenNext Cloudflare context.
  }

  return { processEnv, openNextContext };
}

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
      openRouterKeySource: openRouter.source,
      runtime: getRuntimeDiagnostics()
    },
    note: "Configuration presence only; this endpoint does not certify upstream availability or provider credits. Diagnostics expose boolean presence only, never configuration values.",
    timestamp: new Date().toISOString()
  }, { status: readyForAuth ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
