import { readJson } from "@/lib/http/read-json";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { chatRequestSchema } from "@/lib/validation/chat.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    let raw: unknown;
    try { raw = await readJson(request, 64 * 1024); }
    catch (error) { const tooLarge = error instanceof Error && error.message === "request_too_large"; return NextResponse.json({ error: tooLarge ? "payload_too_large" : "invalid_json" }, { status: tooLarge ? 413 : 400 }); }
    const parsed = chatRequestSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "invalid_request", details: parsed.error.flatten() }, { status: 400 });

    const { data: allowed, error: limitError } = await supabase.rpc("consume_api_rate_limit", {
      p_bucket: "ai-chat",
      p_max_requests: 20,
      p_window_seconds: 60
    });
    if (limitError) return NextResponse.json({ error: "rate_limit_unavailable" }, { status: 503 });
    if (!allowed) return NextResponse.json({ error: "rate_limited", retryAfterSeconds: 60 }, { status: 429, headers: { "Retry-After": "60" } });

    const base = process.env.AI_GATEWAY_BASE_URL;
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    const defaultModel = process.env.AI_DEFAULT_MODEL;
    if (!base || !apiKey || !defaultModel) return NextResponse.json({ error: "ai_provider_not_configured" }, { status: 503 });

    const gateway = new URL(base);
    if (gateway.protocol !== "https:" && gateway.hostname !== "localhost") return NextResponse.json({ error: "invalid_gateway_configuration" }, { status: 500 });

    const upstream = await fetch(new URL("/v1/chat/completions", gateway), {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json", "Accept": "text/event-stream" },
      body: JSON.stringify({ model: parsed.data.model || defaultModel, messages: parsed.data.messages, stream: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(90000)
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "ai_provider_error", providerStatus: upstream.status }, { status: 502 });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no"
      }
    });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
