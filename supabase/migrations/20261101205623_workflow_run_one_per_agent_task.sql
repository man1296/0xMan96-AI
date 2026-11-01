-- Each Agent task has at most one durable Workflow run.
create unique index if not exists workflow_runs_agent_task_id_unique
  on public.workflow_runs(agent_task_id)
  where agent_task_id is not null;
