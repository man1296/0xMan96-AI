-- Tighten the dashboard-installed automatic RLS event trigger.
-- Event triggers execute as their owner; application roles do not need EXECUTE.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- Cover foreign keys commonly used by workspace-scoped lookups and deletes.
create index if not exists workspaces_owner_id_idx on public.workspaces(owner_id);
create index if not exists audit_events_actor_id_idx on public.audit_events(actor_id);
create index if not exists conversations_user_id_idx on public.conversations(user_id);
create index if not exists messages_workspace_id_idx on public.messages(workspace_id);
create index if not exists messages_user_id_idx on public.messages(user_id);
create index if not exists knowledge_documents_user_id_idx on public.knowledge_documents(user_id);
create index if not exists content_projects_user_id_idx on public.content_projects(user_id);
create index if not exists generation_jobs_workspace_id_idx on public.generation_jobs(workspace_id);
create index if not exists generation_jobs_user_id_idx on public.generation_jobs(user_id);
