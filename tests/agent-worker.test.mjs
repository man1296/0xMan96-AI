import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261102120000_durable_agent_runtime.sql", import.meta.url), "utf8");
const route = await readFile(new URL("../app/api/internal/agent-worker/route.ts", import.meta.url), "utf8");
const worker = await readFile(new URL("../custom-worker.ts", import.meta.url), "utf8");
const wrangler = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");

test("task claims are atomic and bounded", () => {
  assert.match(migration, /for update skip locked/i);
  assert.match(migration, /least\(coalesce\(p_limit, 3\), 10\)/i);
  assert.match(migration, /lease_expires_at/);
  assert.match(migration, /max_attempts/);
});

test("claim and recovery RPCs are service-role only", () => {
  assert.match(migration, /revoke all on function public\.claim_agent_tasks\(integer\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.claim_agent_tasks\(integer\) to service_role/i);
  assert.match(migration, /revoke all on function public\.recover_expired_agent_tasks\(\) from public, anon, authenticated/i);
});

test("internal worker endpoint checks a shared secret and documents the side-effect boundary", () => {
  assert.match(route, /constantTimeMatch/);
  assert.match(route, /AGENT_WORKER_SECRET/);
  assert.match(route, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(route, /Do not claim to have used external tools/);
});

test("Cloudflare schedules the worker and keeps secrets out of vars", () => {
  assert.match(wrangler, /"\* \* \* \* \*"/);
  assert.doesNotMatch(wrangler, /SUPABASE_SERVICE_ROLE_KEY|AGENT_WORKER_SECRET|OPENROUTER_API_KEY/);
  assert.match(worker, /async scheduled/);
});
