# Durable Agent runtime

## Current scope

The scheduled Cloudflare Worker invokes the authenticated internal Agent runtime every minute. The runtime atomically claims up to two queued tasks concurrently from Supabase, loads workspace Agent instructions and relevant Memory, executes a bounded Workflow, and persists task, Workflow-run, and step-run results.

The database remains the source of truth. The queue RPC uses row locks with `SKIP LOCKED`, twelve-minute leases, bounded attempts, and stale-lease recovery. The scheduled Cloudflare tick first dispatches up to ten due recurring Workflow definitions, then claims up to two queued Agent tasks for execution.

## Workflow execution

When a user starts a task without selecting a saved Workflow, the configured model first proposes a plan of up to six steps. The server parses and validates that plan, persists it before execution, and falls back to a single reasoning step if the proposed JSON is invalid. Saved Workflow definitions also contain at most six ordered steps. The server validates every step against a strict allowlist:

- `agent.reason`: call the configured OpenRouter model for a bounded reasoning/drafting step.
- `memory.search`: retrieve relevant workspace Memory using multilingual vector similarity when Workers AI is available, with lexical fallback.
- `memory.save`: save a Memory entry after explicit user approval; embeddings are generated with Cloudflare Workers AI when the binding is available.
- `web.search`: run a bounded, read-only DuckDuckGo search (up to eight results), then fetch at most three validated public HTTPS source pages with a 600 KB response cap and 4,000-character text excerpt per page. Source IDs, titles, snippets, URLs, and extracted excerpts are preserved for citations.

No arbitrary code, shell commands, unrestricted HTTP, browser automation, publishing, wallet signing, financial transactions, or external account mutations are exposed by this runtime. Unknown tool names are rejected. Workflow content, Memory, and retrieved web snippets are treated as untrusted data, not system instructions. Web search sends the query to DuckDuckGo and fetches only the first three validated public HTTPS result pages without credentials or cookies. Redirects are revalidated, private/local destinations and non-HTML content are rejected, and page scripts are stripped rather than executed.

Every step is persisted in `workflow_step_runs`. Steps requiring approval pause the task and set `awaiting_approval`. The authenticated approval endpoint can approve and resume or reject the pending task. Approval is bound to the task owner and exact Workflow run. Memory writes always require approval, even if a client attempts to mark them as approval-free. Approval is bound to a fingerprint of the exact step definition and shows the action preview; if the step changes while awaiting approval, the previous approval is invalidated and must be granted again. Approved resumes do not consume retry attempts, and lease recovery preserves an approved continuation. Task, run, and step state is read-only to browser roles; enqueue, approval transitions, and execution writes go through authenticated server routes or the service-role worker. A deterministic step id makes Memory writes idempotent across worker retries.

The Workspace UI includes a Workflow library, a pending-approval panel, and persisted run/step history. Its current editor creates sequential reasoning steps; the server registry also supports Memory search and approval-gated Memory writes for workflows submitted through the API.

## Recurring Workflow schedules

Workflow definitions can be created as manual or recurring. The current recurring options are hourly, every 24 hours, or every 7 days. These are rolling intervals measured from activation or the previous dispatch, not wall-clock cron expressions; no timezone conversion is implied. Each scheduled Workflow stores its next due time in `next_run_at`.

On each existing one-minute Cloudflare worker tick, the server calls the private `enqueue_due_workflow_schedules` RPC. The RPC locks due definitions with `FOR UPDATE SKIP LOCKED`, creates one durable `agent_tasks` row and one `workflow_runs` row in the same database transaction, and advances `next_run_at`. Concurrent worker ticks therefore cannot dispatch the same due schedule twice. At most ten due definitions are dispatched per tick; the normal worker then claims up to two tasks. Each user can have at most five active recurring definitions per Workspace; the API checks the quota and a private Postgres trigger enforces it transactionally with an advisory lock. A definition is not dispatched while it already has a queued, running, or approval-waiting task, preventing overlapping executions; its due time remains pending until that task finishes. A paused Workflow is excluded from dispatch and can be resumed from the Workflow library, which schedules its next run one full interval after resumption.

The RPC runs as `SECURITY INVOKER`, is located in the non-exposed `private` schema, and is executable only by `service_role`. Invalid schedule interval data is disabled rather than executed.
## Required Cloudflare runtime secrets

Configure these as Worker secrets, never as plaintext vars:

- `OPENROUTER_API_KEY`: provider credential.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key. Never expose it to the browser.
- `AGENT_WORKER_SECRET`: long random secret shared by the scheduled Worker and the internal endpoint.

Add these values as GitHub Actions repository/environment secrets, then run the guarded `Deploy 0xMan96 AI to Cloudflare` workflow from the `main` branch and type `deploy` for confirmation. The workflow checks out `main` only and fails closed if any secret is missing. It deploys a new Worker version; verify `/__runtime-binding-check` reports only boolean presence. The diagnostic never returns secret values.

## Security and operational verification

1. Confirm all three secrets are configured in Cloudflare.
2. Deploy the Worker and verify the scheduled trigger.
3. Confirm the binding diagnostic reports service-role and worker-secret presence.
4. Enqueue a harmless task in an authenticated workspace.
5. Confirm task state transitions to `succeeded` and the Workflow run plus step history are persisted.
6. Test a `memory.save` step: it must pause at `awaiting_approval`; approve it in the UI and confirm the worker resumes.
7. Reject a pending approval and confirm the task is cancelled.
8. Confirm the internal endpoint rejects missing and incorrect worker secrets.
9. Monitor Worker logs, provider spend, Supabase Security Advisor, and database backups.

## Remaining before production

- Add authenticated end-to-end tests against a non-production workspace and test provider.
- Add idempotency keys for task enqueue and approval actions.
- Add cancellation, timeout, per-user budgets, rate limits, and dead-letter review.
- Add explicit Memory curation controls and embedding lifecycle visibility.
- Add a full visual step editor and workflow versioning.
- Add cron-expression scheduling, timezone-aware wall-clock schedules, and per-workflow schedule history.
- Add observability, backup/restore drills, and independent security testing.
- Deploy the latest branch and perform a real authenticated Cloudflare smoke test.

This milestone provides bounded background reasoning and approval-gated internal Memory writes. It is not a claim of unrestricted autonomous execution or production readiness.
