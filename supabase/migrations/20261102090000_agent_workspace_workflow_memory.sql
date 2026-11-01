-- Agent + Workspace + Workflow + Memory persistent foundation.
-- Workspace-scoped tables with RLS. New public tables are not automatically exposed
-- by Supabase Data API on projects enforcing the 2026-10-30 change.
create table if not exists public.agents (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(name) between 1 and 120), description text not null default '' check (char_length(description) <= 2000),
 instructions text not null default '' check (char_length(instructions) <= 20000), config jsonb not null default '{}'::jsonb,
 enabled boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.agent_memories (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, agent_id uuid references public.agents(id) on delete set null,
 category text not null check (category in ('project_context','preference','decision','research_finding','standing_instruction','feedback')),
 content text not null check (char_length(content) between 1 and 12000), source text not null default 'user',
 importance smallint not null default 3 check (importance between 1 and 5), pinned boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workflow_definitions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, agent_id uuid references public.agents(id) on delete set null,
 name text not null check (char_length(name) between 1 and 160), description text not null default '' check (char_length(description) <= 2000),
 trigger_type text not null default 'manual' check (trigger_type in ('manual','schedule','event')),
 trigger_config jsonb not null default '{}'::jsonb, steps jsonb not null default '[]'::jsonb, enabled boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.agent_tasks (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, agent_id uuid references public.agents(id) on delete set null,
 workflow_id uuid references public.workflow_definitions(id) on delete set null,
 status text not null default 'queued' check (status in ('queued','planning','awaiting_approval','running','succeeded','failed','cancelled')),
 task text not null check (char_length(task) between 1 and 12000), plan jsonb not null default '[]'::jsonb,
 results jsonb not null default '[]'::jsonb, approval jsonb not null default '{}'::jsonb, error_code text,
 attempts integer not null default 0 check (attempts between 0 and 10), run_at timestamptz not null default now(),
 started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.workflow_runs (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade, workflow_id uuid references public.workflow_definitions(id) on delete set null,
 agent_task_id uuid references public.agent_tasks(id) on delete set null,
 status text not null default 'queued' check (status in ('queued','running','awaiting_approval','succeeded','failed','cancelled')),
 trigger_payload jsonb not null default '{}'::jsonb, started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.workflow_step_runs (
 id uuid primary key default gen_random_uuid(), run_id uuid not null references public.workflow_runs(id) on delete cascade,
 workspace_id uuid not null references public.workspaces(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade,
 step_index integer not null check (step_index between 0 and 99), name text not null check (char_length(name) between 1 and 240),
 status text not null default 'queued' check (status in ('queued','running','awaiting_approval','succeeded','failed','skipped')),
 requires_approval boolean not null default true, input jsonb not null default '{}'::jsonb, output jsonb, error_code text,
 started_at timestamptz, completed_at timestamptz, created_at timestamptz not null default now(), unique(run_id,step_index)
);
create index if not exists agents_workspace_updated_idx on public.agents(workspace_id,updated_at desc);
create index if not exists memories_workspace_updated_idx on public.agent_memories(workspace_id,updated_at desc);
create index if not exists memories_agent_idx on public.agent_memories(agent_id,created_at desc);
create index if not exists workflows_workspace_updated_idx on public.workflow_definitions(workspace_id,updated_at desc);
create index if not exists agent_tasks_queue_idx on public.agent_tasks(status,run_at,created_at) where status in ('queued','planning','running');
create index if not exists agent_tasks_workspace_idx on public.agent_tasks(workspace_id,created_at desc);
create index if not exists workflow_runs_workspace_idx on public.workflow_runs(workspace_id,created_at desc);
create index if not exists workflow_steps_run_idx on public.workflow_step_runs(run_id,step_index);
do $$
declare t text;
begin
 foreach t in array array['agents','agent_memories','workflow_definitions','agent_tasks','workflow_runs','workflow_step_runs'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('grant select,insert,update,delete on public.%I to authenticated',t);
  execute format('create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))',t||'_member_select',t);
  execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))',t||'_member_insert',t);
  execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))) with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))',t||'_member_update',t);
  execute format('create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))',t||'_member_delete',t);
 end loop;
end $$;
