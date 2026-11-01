-- Task and execution status are server-owned state. Browser clients may read,
-- but cannot enqueue or mutate task/run/step records directly.
revoke all on table public.agent_tasks from anon, authenticated;
revoke all on table public.workflow_runs from anon, authenticated;
revoke all on table public.workflow_step_runs from anon, authenticated;

grant select on table public.agent_tasks to authenticated;
grant select on table public.workflow_runs to authenticated;
grant select on table public.workflow_step_runs to authenticated;

grant all on table public.agent_tasks to service_role;
grant all on table public.workflow_runs to service_role;
grant all on table public.workflow_step_runs to service_role;
