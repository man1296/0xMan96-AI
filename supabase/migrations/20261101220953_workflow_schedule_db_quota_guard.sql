create or replace function private.enforce_workflow_schedule_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active integer;
begin
  if new.trigger_type <> 'schedule' or new.enabled is not true then
    return new;
  end if;

  if auth.uid() is not null and new.user_id <> auth.uid() then
    raise exception 'workflow_schedule_owner_mismatch';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(new.user_id::text || ':' || new.workspace_id::text, 0)
  );

  select count(*) into v_active
  from public.workflow_definitions
  where user_id = new.user_id
    and workspace_id = new.workspace_id
    and trigger_type = 'schedule'
    and enabled = true
    and id is distinct from new.id;

  if v_active >= 5 then
    raise exception 'active_workflow_schedule_limit_reached';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_workflow_schedule_limit() from public, anon, authenticated;

drop trigger if exists workflow_definitions_schedule_limit on public.workflow_definitions;
create trigger workflow_definitions_schedule_limit
before insert or update of trigger_type, enabled on public.workflow_definitions
for each row execute function private.enforce_workflow_schedule_limit();
