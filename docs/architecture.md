# 0xMan96 AI platform architecture

## Deployment boundary
- Existing GitHub Pages application remains the public legacy workspace during migration.
- The Next.js App Router application in this repository is the new backend/BFF and future unified web shell.
- Vercel deployment is blocked until the selected Vercel team resolves its resource-creation/fair-use restriction.
- Supabase is the system of record for identities, workspace membership, durable data and private object storage.

## Trust boundaries
- Browser receives only the Supabase project URL and anon/publishable key.
- Supabase RLS is mandatory for all user-facing tables and Storage objects.
- Service-role keys and AI gateway credentials are server-only. They must never use a NEXT_PUBLIC_ prefix or be committed.
- All API routes authenticate with supabase.auth.getUser(), validate input, apply database-backed rate limits and return generic errors.
- User-provided documents and model output are untrusted data. Never execute embedded instructions or generated code automatically.

## AI gateway
The chat route implements an OpenAI-compatible streaming proxy. Configure an HTTPS base URL, API key and default model in Vercel environment variables only after choosing and testing a provider. No provider secret is committed. Puter.js remains available in the legacy client while migration and billing behavior are evaluated.

## Data model
Profiles, workspaces, memberships, conversations, messages, knowledge document metadata, creator projects, generation jobs, audit events and rate-limit counters are tenant-scoped. Workspace membership and user ownership are enforced by RLS.

## Deferred integrations
A durable worker/queue, vector embedding pipeline, OAuth publishing connectors, Web3 provider credentials, billing, malware scanning and export/render workers are separate integrations and must not be represented as live until provisioned and tested.
