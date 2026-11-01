# Production readiness checklist

This repository change is a backend foundation, not a production certification.

## Implemented in code
- Next.js server application and health/configuration endpoint
- Supabase SSR client and auth callback exchange
- Protected workspace route and user profile API
- PostgreSQL multi-tenant schema with RLS
- Private Storage bucket and per-user object policies
- Database-backed per-user API rate limit RPC
- Validated OpenAI-compatible streaming proxy (provider configuration required)
- Security response headers and CI type/build/test checks

## Required before production
- [ ] Create/select Supabase project and set site URL + redirect URLs
- [ ] Apply SQL migrations and verify RLS with at least two independent users/workspaces
- [ ] Configure Vercel project after team resource-creation restriction is resolved
- [ ] Set Supabase URL and anon key in Preview and Production
- [ ] Set AI gateway URL/key/model after selecting a provider and reviewing pricing/data processing terms
- [ ] Configure SMTP/email confirmation, password recovery and abuse controls in Supabase Auth
- [ ] Add automated integration tests for login, logout, session refresh, RLS isolation, storage and streaming
- [ ] Add dependency scanning, secret scanning, SAST, DAST and backup/restore drills
- [ ] Add error monitoring, structured logs, alerting and retention policy
- [ ] Add worker/queue for durable schedules and media processing
- [ ] Complete privacy policy, terms, data deletion/export and incident response runbooks
- [ ] Independent penetration test and remediation
- [ ] Formal certification only through the relevant external audit process

## Operational targets to define
Set explicit SLOs for API availability, latency, job completion, recovery time and recovery point before launch. Do not claim compliance or certification based solely on CI passing.
