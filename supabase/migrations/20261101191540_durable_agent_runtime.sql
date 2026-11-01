-- Durable Agent task execution foundation.
-- The task table remains the source of truth; atomic claims use SKIP LOCKED.
alter table public.agent_tasks
  add column if not exists lease_expires_at timestamptz,
  add column if not exists max_attempts integer not null default 5
    check (max_attempts between 1 and 10),
  add column if not exists last_error text;

create index if not exists agent_tasks_lease_idx
  on public.agent_tasks(status, lease_expires_at)
  where status in ('planning','running');

create or replace function public.claim_agent_tasks(p_limit integer default 3)
returns setof public.agent_tasks
language sql
security definer
set search_path = ''
as $$
  with candidates as (
    select t.id
    from public.agent_tasks as t
    where t.status = 'queued'
      and t.run_at <= pg_catalog.now()
      and t.attempts < t.max_attempts
    order by t.run_at asc, t.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 10))
  )
  update public.agent_tasks as t
  set status = 'planning',
      attempts = t.attempts + 1,
      started_at = coalesce(t.started_at, pg_catalog.now()),
      lease_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
  from candidates as c
  where t.id = c.id
  returning t.*;
$$;

create or replace function public.recover_expired_agent_tasks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  recovered_count integer;
begin
  with expired as (
    update public.agent_tasks as t
    set status = case when t.attempts >= t.max_attempts then 'failed' else 'queued' end,
        run_at = pg_catalog.now(),
        lease_expires_at = null,
        last_error = case
          when t.attempts >= t.max_attempts then 'worker_lease_expired_max_attempts'
          else 'worker_lease_expired_retrying'
        end,
        completed_at = case when t.attempts >= t.max_attempts then pg_catalog.now() else null end,
        updated_at = pg_catalog.now()
    where t.status in ('planning','running')
      and t.lease_expires_at is not null
      and t.lease_expires_at < pg_catalog.now()
    returning t.id, t.status
  ),
  sync_runs as (
    update public.workflow_runs as r
    set status = e.status,
        completed_at = case when e.status = 'failed' then pg_catalog.now() else null end
    from expired as e
    where r.agent_task_id = e.id
    returning r.id
  )
  select count(*)::integer into recovered_count from expired;
  return coalesce(recovered_count, 0);
end;
$$;

revoke all on function public.claim_agent_tasks(integer) from public, anon, authenticated;
revoke all on function public.recover_expired_agent_tasks() from public, anon, authenticated;
grant execute on function public.claim_agent_tasks(integer) to service_role;
grant execute on function public.recover_expired_agent_tasks() to service_role;
