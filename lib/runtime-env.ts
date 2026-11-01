import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeEnvSource = "cloudflare_global" | "open_next_context" | "process_env" | "missing";

export interface RuntimeEnvResult {
  value: string | undefined;
  source: RuntimeEnvSource;
}

/**
 * Read a Worker secret from the native Cloudflare env binding first,
 * then OpenNext's request context, then process.env for local development.
 * Never log or expose the returned secret value.
 */
export async function readRuntimeEnv(name: string): Promise<RuntimeEnvResult> {
  try {
    const workerModule = await import("cloudflare:workers");
    const value = workerModule.env[name];
    if (typeof value === "string" && value.length > 0) {
      return { value, source: "cloudflare_global" };
    }
  } catch {
    // The native Workers module is unavailable in local Node.js development.
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

  const localValue = process.env[name];
  if (localValue && localValue.length > 0) {
    return { value: localValue, source: "process_env" };
  }

  return { value: undefined, source: "missing" };
}

export async function getRuntimeEnv(name: string): Promise<string | undefined> {
  return (await readRuntimeEnv(name)).value;
}
