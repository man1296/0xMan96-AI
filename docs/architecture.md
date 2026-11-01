# 0xMan96 AI platform architecture

## Deployment boundary
- Existing GitHub Pages application remains the public legacy workspace during migration.
- The Next.js App Router application in this repository is the new backend/BFF and future unified web shell.
- Vercel deployment is blocked until the selected Vercel team resolves its resource-creation/fair-use restriction.
- Supabase is the system of record for identities, workspace membership, durable data and private object storage.

## Trust boundaries
- Browser receives only the Supabase project URL and anon/publishable key.
- Supabase RLS is mandatory for all user-facing tables and Storage objects.
- Service-role keys and OpenRouter API credentials are server-only. They must never use a NEXT_PUBLIC_ prefix or be committed.
- All API routes authenticate with supabase.auth.getUser(), validate input, apply database-backed rate limits and return generic errors.
- User-provided documents and model output are untrusted data. Never execute embedded instructions or generated code automatically.

## AI gateway
- OpenRouter is the provider-neutral gateway. The server calls https://openrouter.ai/api/v1/chat/completions and streams Server-Sent Events to the authenticated client.
- Default quality model: anthropic/claude-opus-5. Quality fallback candidates: qwen/qwen3.8-max and meta/muse-spark-1.2. Model availability, pricing and provider routing can change; verify against OpenRouter's live model catalogue before release.
- The default model and fallback list are server-side configuration. Client-selected model IDs are validated syntactically and still pass through the authenticated, rate-limited server proxy.
- Set OPENROUTER_API_KEY only in server environment variables. It must never be committed or exposed through NEXT_PUBLIC_.
- Streaming usage metadata is requested for future cost metering. Persist per-generation model, provider generation ID and token usage before exposing usage analytics.
- Quality-first defaults can be expensive. Add user-visible spend estimates, hard per-user budgets and admin kill switches before enabling broad public access.

## Data model
Profiles, workspaces, memberships, conversations, messages, knowledge document metadata, creator projects, generation jobs, audit events and rate-limit counters are tenant-scoped. Workspace membership and user ownership are enforced by RLS.

## Deferred integrations
A durable worker/queue, vector embedding pipeline, OAuth publishing connectors, Web3 provider credentials, billing, malware scanning and export/render workers are separate integrations and must not be represented as live until provisioned and tested.
