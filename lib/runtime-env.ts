import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeEnvSource = "process_env" | "open_next_context" | "missing";

export interface RuntimeEnvResult {
  value: string | undefined;
  source: RuntimeEnvSource;
}

function readRuntimeProcessEnv(name: string): string | undefined {
  switch (name) {
    case "OPENROUTER_API_KEY":
    case "OPENROUTER_DEFAULT_MODEL":
    case "OPENROUTER_BASE_URL":
    case "SUPABASE_SERVICE_ROLE_KEY":
    case "AGENT_WORKER_SECRET":
      return process.env[name];
    case "NEXT_PUBLIC_SUPABASE_URL":
      return process.env.NEXT_PUBLIC_SUPABASE_URL;
    case "NEXT_PUBLIC_SUPABASE_ANON_KEY":
      return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    case "NEXT_PUBLIC_APP_URL":
      return process.env.NEXT_PUBLIC_APP_URL;
    default:
      return undefined;
  }
}

export async function readRuntimeEnv(name: string): Promise<RuntimeEnvResult> {
  const runtimeValue = readRuntimeProcessEnv(name);
  if (typeof runtimeValue === "string" && runtimeValue.length > 0) {
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
