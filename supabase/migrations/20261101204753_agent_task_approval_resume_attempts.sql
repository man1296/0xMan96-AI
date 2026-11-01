-- An approved resume is a continuation, not a retry attempt.
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
      and (
        t.attempts < t.max_attempts
        or t.approval ->> 'decision' = 'approved'
      )
    order by t.run_at asc, t.created_at asc
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 3), 10))
  )
  update public.agent_tasks as t
  set status = 'planning',
      attempts = t.attempts + case
        when t.approval ->> 'decision' = 'approved' then 0
        else 1
      end,
      started_at = coalesce(t.started_at, pg_catalog.now()),
      lease_expires_at = pg_catalog.now() + interval '5 minutes',
      updated_at = pg_catalog.now()
  from candidates as c
  where t.id = c.id
  returning t.*;
$$;

revoke all on function public.claim_agent_tasks(integer) from public, anon, authenticated;
grant execute on function public.claim_agent_tasks(integer) to service_role;
