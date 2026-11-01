import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeEnvSource = "process_env" | "open_next_context" | "missing";

export interface RuntimeEnvResult {
  value: string | undefined;
  source: RuntimeEnvSource;
}

/**
 * Read server-side configuration from the Cloudflare Worker runtime.
 * Use an explicit property access for the OpenRouter secret so the access
 * matches Cloudflare's documented process.env pattern. Keep dynamic access
 * for NEXT_PUBLIC_* values to avoid Next.js build-time inlining.
 * Never log or expose returned secret values.
 */
function readProcessEnv(name: string): string | undefined {
  switch (name) {
    case "OPENROUTER_API_KEY":
      return process.env.OPENROUTER_API_KEY;
    case "OPENROUTER_DEFAULT_MODEL":
      return process.env.OPENROUTER_DEFAULT_MODEL;
    case "OPENROUTER_BASE_URL":
      return process.env.OPENROUTER_BASE_URL;
    case "NEXT_PUBLIC_SUPABASE_URL":
    case "NEXT_PUBLIC_SUPABASE_ANON_KEY":
    case "NEXT_PUBLIC_APP_URL":
      return process.env[name];
    default:
      return process.env[name];
  }
}

export async function readRuntimeEnv(name: string): Promise<RuntimeEnvResult> {
  const runtimeValue = readProcessEnv(name);
  if (runtimeValue && runtimeValue.length > 0) {
    return { value: runtimeValue, source: "process_env" };
  }

  try {
    const workerEnv = getCloudflareContext().env as unknown as Record<string, unknown>;
    const value = workerEnv[name];
    if (typeof value === "string" && value.length > 0) {
      return { value, source: "open_next_context" };
    }
  } catch {
    // No OpenNext Cloudflare request context is available.
  }

  return { value: undefined, source: "missing" };
}

export async function getRuntimeEnv(name: string): Promise<string | undefined> {
  return (await readRuntimeEnv(name)).value;
}
