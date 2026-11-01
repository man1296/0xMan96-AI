-- One durable row per step index in each Workflow run.
create unique index if not exists workflow_step_runs_run_step_unique
  on public.workflow_step_runs(run_id, step_index);
