# 0xMan96 AI — Multi-Agent Workspace

The existing static HTML/CSS/JavaScript workspace remains available on GitHub Pages while a Next.js + Supabase backend foundation is developed in parallel.

## Existing GitHub Pages app
- Frontend: HTML, CSS, ES modules and Puter.js.
- URL: https://man1296.github.io/0xMan96-AI/
- Local preview: `python3 -m http.server 8000`.

## New backend foundation
- Security-patched Next.js 15.5.28, React 19.1.10 and Sharp 0.35.5 baseline; track framework advisories and update immediately when fixes ship.
- Next.js App Router application at the repository root.
- Supabase Auth via SSR cookies, Postgres, row-level security and private Storage.
- Multi-tenant schema for profiles, workspaces, conversations, messages, knowledge documents, creator projects, generation jobs, audit events and API rate limits.
- Authenticated, validated, database-rate-limited OpenAI-compatible streaming proxy.
- The AI provider and secrets are intentionally not configured in source code.

## Local backend setup
1. Use Node.js 22 or newer.
2. Copy `.env.example` to `.env.local`.
3. Create a Supabase project and configure its URL and anon/publishable key.
4. Apply `supabase/migrations/202611010001_initial_platform.sql` using the Supabase CLI or SQL editor.
5. Configure Supabase Auth Site URL and redirect URL `http://localhost:3000/auth/callback`.
6. Configure the email provider / SMTP before enabling real users.
7. Set an OpenAI-compatible HTTPS gateway URL, API key and model in local environment only after provider selection.
8. Run `npm install`, `npm test`, `npm run typecheck`, `npm run build`, then `npm run dev`.

## Security boundaries
- Only the Supabase URL and anon/publishable key belong in browser configuration.
- Never commit Supabase service-role keys, AI provider keys, OAuth client secrets or signing keys.
- RLS is required; never use a service-role key to serve ordinary user requests.
- The private Storage bucket is scoped to workspace/user path prefixes.
- Health endpoint reports configuration presence, not full upstream service health.
- The new backend is not production-ready until the checklist in `docs/production-readiness.md` is completed.

## Deployment status
Vercel project creation was rejected by the selected team with HTTP 402 (`resource_creation_blocked`). Resolve the team's fair-use/billing restriction before linking or deploying the project. GitHub Pages remains independent and continues serving the existing static app.

## Remaining integration work
Durable worker/queue, embeddings/vector retrieval, document malware scanning, media rendering/export, social platform OAuth publishing, Web3 provider credentials, billing, observability and external penetration testing are not yet implemented.
