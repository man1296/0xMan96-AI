-- An approved continuation must remain resumable even if its lease expires.
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
    set status = case
          when t.attempts >= t.max_attempts
            and coalesce(t.approval ->> 'decision', '') <> 'approved'
          then 'failed'
          else 'queued'
        end,
        run_at = pg_catalog.now(),
        lease_expires_at = null,
        last_error = case
          when t.attempts >= t.max_attempts
            and coalesce(t.approval ->> 'decision', '') <> 'approved'
          then 'worker_lease_expired_max_attempts'
          else 'worker_lease_expired_retrying'
        end,
        completed_at = case
          when t.attempts >= t.max_attempts
            and coalesce(t.approval ->> 'decision', '') <> 'approved'
          then pg_catalog.now()
          else null
        end,
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

revoke all on function public.recover_expired_agent_tasks() from public, anon, authenticated;
grant execute on function public.recover_expired_agent_tasks() to service_role;
