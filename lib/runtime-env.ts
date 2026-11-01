import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Read a runtime variable from the Cloudflare Worker binding first.
 * Fall back to process.env for local Next.js development and tests.
 * Never log or return secret values from health endpoints.
 */
export function getRuntimeEnv(name: string): string | undefined {
  try {
    const workerEnv = getCloudflareContext().env as unknown as Record<string, unknown>;
    const value = workerEnv[name];
    if (typeof value === "string" && value.length > 0) return value;
  } catch {
    // No Cloudflare request context is available during local Node.js development.
  }

  const localValue = process.env[name];
  return localValue && localValue.length > 0 ? localValue : undefined;
}
