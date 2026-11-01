import { getCloudflareContext } from "@opennextjs/cloudflare";

export type RuntimeEnvSource = "process_env" | "open_next_context" | "missing";

export interface RuntimeEnvResult {
  value: string | undefined;
  source: RuntimeEnvSource;
}

/**
 * Cloudflare runtime variables and Secrets are exposed through process.env
 * when nodejs_compat_populate_process_env is enabled. OpenNext context is
 * retained as a fallback for actual Worker bindings and local adapters.
 * Never log or expose the returned secret value.
 */
export async function readRuntimeEnv(name: string): Promise<RuntimeEnvResult> {
  const runtimeValue = process.env[name];
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
