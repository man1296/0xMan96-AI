alter table public.workflow_definitions
  add column if not exists next_run_at timestamptz,
  add column if not exists last_triggered_at timestamptz;

create index if not exists workflow_definitions_due_schedule_idx
  on public.workflow_definitions (next_run_at)
  where trigger_type = 'schedule' and enabled = true and next_run_at is not null;

create or replace function private.enqueue_due_workflow_schedules(p_limit integer default 10)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_workflow record;
  v_task_id uuid;
  v_enqueued integer := 0;
  v_now timestamptz := clock_timestamp();
  v_interval text;
  v_next_run timestamptz;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 10);
begin
  for v_workflow in
    select id, workspace_id, user_id, agent_id, name, description, trigger_config, next_run_at
    from public.workflow_definitions
    where enabled = true
      and trigger_type = 'schedule'
      and next_run_at is not null
      and next_run_at <= v_now
    order by next_run_at asc
    limit v_limit
    for update skip locked
  loop
    v_interval := v_workflow.trigger_config ->> 'interval';
    if v_interval not in ('hourly', 'daily', 'weekly') then
      update public.workflow_definitions
      set enabled = false, next_run_at = null, updated_at = v_now
      where id = v_workflow.id;
      continue;
    end if;

    insert into public.agent_tasks (
      workspace_id, user_id, agent_id, workflow_id, task, status, run_at
    ) values (
      v_workflow.workspace_id,
      v_workflow.user_id,
      v_workflow.agent_id,
      v_workflow.id,
      coalesce(nullif(btrim(v_workflow.description), ''), 'Run scheduled workflow: ' || v_workflow.name),
      'queued',
      v_now
    )
    returning id into v_task_id;

    insert into public.workflow_runs (
      workspace_id, user_id, workflow_id, agent_task_id, status, trigger_payload
    ) values (
      v_workflow.workspace_id,
      v_workflow.user_id,
      v_workflow.id,
      v_task_id,
      'queued',
      jsonb_build_object(
        'source', 'scheduled_workflow',
        'scheduled_for', v_workflow.next_run_at,
        'interval', v_interval
      )
    );

    v_next_run := v_now + case v_interval
      when 'hourly' then interval '1 hour'
      when 'daily' then interval '1 day'
      when 'weekly' then interval '7 days'
    end;

    update public.workflow_definitions
    set next_run_at = v_next_run, last_triggered_at = v_now, updated_at = v_now
    where id = v_workflow.id;

    v_enqueued := v_enqueued + 1;
  end loop;

  return v_enqueued;
end;
$$;

grant usage on schema private to service_role;
revoke all on function private.enqueue_due_workflow_schedules(integer) from public, anon, authenticated;
grant execute on function private.enqueue_due_workflow_schedules(integer) to service_role;
