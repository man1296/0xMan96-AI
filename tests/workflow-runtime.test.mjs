import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const workflow = fs.readFileSync("lib/agent/workflow.ts", "utf8");
const worker = fs.readFileSync("app/api/internal/agent-worker/route.ts", "utf8");
const approval = fs.readFileSync("app/api/v1/agent/tasks/[id]/approval/route.ts", "utf8");
const workflowApi = fs.readFileSync("app/api/v1/workflows/route.ts", "utf8");

test("workflow runtime is bounded and allowlisted", () => {
  assert.match(workflow, /MAX_WORKFLOW_STEPS = 6/);
  assert.match(workflow, /agent\.reason/);
  assert.match(workflow, /memory\.search/);
  assert.match(workflow, /memory\.save/);
  assert.match(workflow, /ALLOWED_TOOLS/);
  assert.match(workflow, /tool === "memory\.save" \|\| item\.requiresApproval === true/);
});

test("worker persists step history and pauses before approval-required actions", () => {
  assert.match(worker, /workflow_step_runs/);
  assert.match(worker, /status: "awaiting_approval"/);
  assert.match(worker, /status: "succeeded"/);
  assert.match(worker, /pending_step_index/);
  assert.match(worker, /tool_not_allowlisted/);
});

test("approval endpoint is authenticated and resumes only approved tasks", () => {
  assert.match(approval, /supabase\.auth\.getUser/);
  assert.match(approval, /task\.status !== "awaiting_approval"/);
  assert.match(approval, /status: "queued"/);
  assert.match(approval, /decision: "rejected"/);
});

test("Workflow definitions are workspace scoped and validated before persistence", () => {
  assert.match(workflowApi, /eq\("workspace_id", value\.workspaceId\)/);
  assert.match(workflowApi, /validateWorkflowSteps/);
  assert.match(workflowApi, /steps: z\.array\(z\.unknown\(\)\)\.max\(6\)/);
});

test("approved resumes do not consume retry attempts", async () => {
  const migration = fs.readFileSync("supabase/migrations/20261101204753_agent_task_approval_resume_attempts.sql", "utf8");
  assert.match(migration, /approval ->> 'decision' = 'approved'/);
  assert.match(migration, /attempts = t\.attempts \+ case/);
});

test("task execution state is writable only by the server role", () => {
  const migration = fs.readFileSync("supabase/migrations/20261101204839_lock_agent_task_mutations_to_server.sql", "utf8");
  assert.match(migration, /revoke all on table public\.agent_tasks from anon, authenticated/);
  assert.match(migration, /grant all on table public\.agent_tasks to service_role/);
  assert.match(migration, /grant select on table public\.agent_tasks to authenticated/);
});

test("Memory writes use a deterministic idempotency key", () => {
  assert.match(worker, /stableUuid\(runId \+ ":" \+ index \+ ":memory\.save"\)/);
  assert.match(worker, /upsert\(/);
});

test("task creation and approval transitions use server-side credentials", () => {
  const taskApi = fs.readFileSync("app/api/v1/agent/tasks/route.ts", "utf8");
  assert.match(taskApi, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(taskApi, /admin\.from\("agent_tasks"\)\.insert/);
  assert.match(approval, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(approval, /admin\.from\("agent_tasks"\)\.update/);
});

test("approval is bound to an immutable step fingerprint and a visible action summary", () => {
  assert.match(worker, /fingerprintStep\(step\)/);
  assert.match(worker, /approval\.step_fingerprint === stepFingerprint/);
  assert.match(worker, /Save Memory \(/);
  assert.match(approval, /approval\.step_fingerprint/);
});

test("worker bounds concurrency and leases cover a full six-step plan", () => {
  const lease = fs.readFileSync("supabase/migrations/20261101205225_agent_task_long_workflow_lease.sql", "utf8");
  assert.match(lease, /interval '12 minutes'/);
  assert.match(worker, /claim_agent_tasks", \{ p_limit: 2 \}/);
  assert.match(worker, /Promise\.all\(claimedTasks\.map/);
});

test("public rate limit RPC is SECURITY INVOKER", () => {
  const migration = fs.readFileSync("supabase/migrations/20261101204658_move_rate_limit_definer_private.sql", "utf8");
  assert.match(migration, /create or replace function public\.consume_api_rate_limit[\s\S]*?security invoker/i);
  assert.match(migration, /create or replace function private\.consume_api_rate_limit[\s\S]*?security definer/i);
});

test("manual production deployment is guarded and checks out main only", () => {
  const deploy = fs.readFileSync(".github/workflows/deploy-cloudflare.yml", "utf8");
  assert.match(deploy, /workflow_dispatch/);
  assert.match(deploy, /confirm_production == 'deploy'/);
  assert.match(deploy, /ref: main/);
  assert.match(deploy, /CLOUDFLARE_API_TOKEN/);
  assert.match(deploy, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(deploy, /AGENT_WORKER_SECRET/);
});

test("tasks without a saved Workflow receive a validated model-generated plan", () => {
  assert.match(worker, /buildAgentPlan/);
  assert.match(worker, /validateWorkflowSteps\(JSON\.parse/);
  assert.match(worker, /agent_plan_persist_failed/);
  assert.match(worker, /task\.plan/);
});
