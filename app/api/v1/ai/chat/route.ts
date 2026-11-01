import { readJson } from "@/lib/http/read-json";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatRequestSchema } from "@/lib/validation/chat.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const QUALITY_FALLBACK_MODELS = [
  "qwen/qwen3.8-max",
  "meta/muse-spark-1.2"
];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let raw: unknown;
    try { raw = await readJson(request, 64 * 1024); }
    catch (error) {
      const tooLarge = error instanceof Error && error.message === "request_too_large";
      return NextResponse.json({ error: tooLarge ? "payload_too_large" : "invalid_json" }, { status: tooLarge ? 413 : 400 });
    }
    const parsed = chatRequestSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

    const { data: allowed, error: limitError } = await supabase.rpc("consume_api_rate_limit", {
      p_bucket: "ai-chat",
      p_max_requests: 20,
      p_window_seconds: 60
    });
    if (limitError) return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
    if (!allowed) return NextResponse.json({ error: "rate_limited", retryAfterSeconds: 60 }, { status: 429, headers: { "Retry-After": "60" } });

    const apiKey = process.env.OPENROUTER_API_KEY;
    const defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || "anthropic/claude-opus-5";
    const base = process.env.OPENROUTER_BASE_URL || OPENROUTER_DEFAULT_BASE_URL;
    if (!apiKey) return NextResponse.json({ error: "ai_provider_not_configured" }, { status: 503 });

    const gateway = new URL(base);
    if (gateway.protocol !== "https:" || gateway.hostname !== "openrouter.ai") {
      return NextResponse.json({ error: "invalid_gateway_configuration" }, { status: 500 });
    }

    const selectedModel = parsed.data.model || defaultModel;
    const fallbackModels = selectedModel === defaultModel ? QUALITY_FALLBACK_MODELS : [];
    const upstream = await fetch(new URL("chat/completions", gateway.toString().replace(/\/$/, "") + "/"), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://man1296.github.io/0xMan96-AI/",
        "X-OpenRouter-Title": "0xMan96 AI"
      },
      body: JSON.stringify({
        model: selectedModel,
        ...(fallbackModels.length ? { models: fallbackModels } : {}),
        messages: parsed.data.messages,
        stream: true,
        stream_options: { include_usage: true }
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(90000)
    });

    if (!upstream.ok || !upstream.body) {
      const providerStatus = upstream.status;
      return NextResponse.json({
        error: providerStatus === 401 || providerStatus === 402 ? "ai_provider_auth_or_credits_error" :
          providerStatus === 429 ? "ai_provider_rate_limited" : "ai_provider_error",
        providerStatus
      }, { status: providerStatus === 429 ? 429 : 502 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        ...(upstream.headers.get("X-Generation-Id") ? { "X-OpenRouter-Generation-Id": upstream.headers.get("X-Generation-Id")! } : {})
      }
    });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
