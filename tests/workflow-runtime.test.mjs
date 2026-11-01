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
