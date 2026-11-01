# Durable Agent runtime

## Current scope

The scheduled Worker invokes the internal Agent runtime once per minute. The runtime atomically claims up to three queued tasks from Supabase, loads workspace Agent instructions and recent Memory, calls the configured OpenRouter model, and persists the result and Workflow run status.

The database remains the source of truth. The `claim_agent_tasks` RPC uses row locks with `SKIP LOCKED`, a five-minute lease, and a bounded attempt count. Expired leases are recovered on the next worker tick. Retry delays use bounded exponential backoff.

## Required Cloudflare runtime secrets

Configure these as Worker secrets, never as plaintext vars:

- `OPENROUTER_API_KEY`: provider credential already used by the chat proxy.
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Supabase service role key. Never expose it to the browser.
- `AGENT_WORKER_SECRET`: a long random secret shared by the scheduled Worker and the internal endpoint.

`npm run deploy` installs the OpenRouter key and installs the two Agent runtime secrets when supplied to the build environment. If either Agent secret is absent, scheduled processing intentionally remains disabled. After configuring secrets, deploy a new Worker version and verify `/__runtime-binding-check` reports only boolean presence.

## Security and execution boundary

The internal endpoint accepts only the shared worker secret and uses the service-role client server-side. The service role is never returned to the client. The worker only performs model reasoning and persistence. It does not execute arbitrary code, browser actions, external integrations, transactions, publishing, or other side effects. Such actions must be implemented through a server-side allowlisted tool registry with per-tool authorization and approval-resume handling.

Workflow definitions and Memory are supplied as untrusted context. They cannot override the runtime system policy. No claim of full autonomous tool execution is made by this milestone.

## Operational verification

1. Set the three runtime secrets in Cloudflare and deploy.
2. Confirm the binding diagnostic reports `serviceRoleKey` and `agentWorkerSecret` as present.
3. Enqueue a harmless task in an authenticated workspace.
4. Confirm it transitions `queued -> planning -> succeeded` and its Workflow run is completed.
5. Confirm a failed provider request is retried and an expired lease is recovered.
6. Confirm the endpoint rejects missing and incorrect worker secrets.
7. Monitor Cloudflare Worker logs and Supabase Security Advisor before public rollout.

## Not yet complete

- Browser UI integration with the authenticated Agent, Memory, and Workflow APIs.
- Multi-step allowlisted tool execution and approval/resume.
- Semantic/vector Memory retrieval and automatic memory curation.
- Authenticated E2E tests, observability, budget enforcement, backup/restore drills, and independent security testing.
