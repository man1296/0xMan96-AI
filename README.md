# 0xMan96 AI — Multi-Agent Workspace

The existing static HTML/CSS/JavaScript workspace remains available on GitHub Pages while a Next.js + Supabase backend foundation is developed in parallel.

## Existing GitHub Pages app
- Frontend: HTML, CSS, ES modules and Puter.js.
- URL: https://man1296.github.io/0xMan96-AI/
- Local preview: `python3 -m http.server 8000`.

## New backend foundation
- Next.js App Router, Supabase Auth SSR, PostgreSQL, row-level security and private Storage.
- Multi-tenant schema for profiles, workspaces, conversations, messages, knowledge documents, creator projects, generation jobs, audit events and API rate limits.
- Authenticated, validated, database-rate-limited OpenRouter streaming proxy.
- Free-first AI default: OpenRouter's `openrouter/free` router. It selects from currently available free models; availability and provider rate limits can change.
- Paid model IDs remain allowlisted for deliberate selection, but the server does not automatically fall back from the free router to a paid model.
- Provider credentials are server-only and intentionally not stored in source code.

## Local backend setup
1. Use Node.js 22 or newer.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` from the Supabase project.
4. Set `OPENROUTER_API_KEY` in the server environment. Never commit it or expose it to browser code.
5. Keep `OPENROUTER_BASE_URL=https://openrouter.ai/api/v1` and `OPENROUTER_DEFAULT_MODEL=openrouter/free` for the free-first configuration.
6. Configure Supabase Auth Site URL and redirect URL `http://localhost:3000/auth/callback`.
7. Configure SMTP before enabling real users.
8. Run `npm install`, `npm test`, `npm run typecheck`, `npm run build`, `npx opennextjs-cloudflare build`, then `npm run dev`. For a local Workers-runtime preview, use `npm run preview`.

## Security boundaries
- Only the Supabase URL and anon/publishable key belong in browser configuration.
- Never commit Supabase service-role keys, OpenRouter keys, OAuth client secrets or signing keys.
- RLS is required; never use a service-role key to serve ordinary user requests.
- The private Storage bucket is scoped to workspace/user path prefixes.
- Health endpoint reports configuration presence, not full upstream service health.
- The new backend is not production-ready until the checklist in `docs/production-readiness.md` is completed.

## Deployment status
Vercel project creation was previously rejected by the selected team with HTTP 402 (`resource_creation_blocked`). The backend now has a Cloudflare Workers deployment configuration using the OpenNext adapter. GitHub Pages remains independent and continues serving the existing static app. The Cloudflare adapter build is included in CI; deployment still requires connecting a Cloudflare account and setting server-side secrets. Cloudflare deployment compatibility still needs to be validated before choosing it as the backend host.

## Remaining integration work
Durable worker/queue, embeddings/vector retrieval, document malware scanning, media rendering/export, social platform OAuth publishing, Web3 provider credentials, billing, observability and external penetration testing are not yet implemented.
