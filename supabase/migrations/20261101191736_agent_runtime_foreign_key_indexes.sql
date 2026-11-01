-- Cover Agent/Workflow foreign keys used by workspace-scoped lookups and deletes.
create index if not exists agent_memories_user_id_idx on public.agent_memories(user_id);
create index if not exists agent_tasks_agent_id_idx on public.agent_tasks(agent_id);
create index if not exists agent_tasks_user_id_idx on public.agent_tasks(user_id);
create index if not exists agent_tasks_workflow_id_idx on public.agent_tasks(workflow_id);
create index if not exists agents_user_id_idx on public.agents(user_id);
create index if not exists workflow_definitions_agent_id_idx on public.workflow_definitions(agent_id);
create index if not exists workflow_definitions_user_id_idx on public.workflow_definitions(user_id);
create index if not exists workflow_runs_agent_task_id_idx on public.workflow_runs(agent_task_id);
create index if not exists workflow_runs_user_id_idx on public.workflow_runs(user_id);
create index if not exists workflow_runs_workflow_id_idx on public.workflow_runs(workflow_id);
create index if not exists workflow_step_runs_user_id_idx on public.workflow_step_runs(user_id);
create index if not exists workflow_step_runs_workspace_id_idx on public.workflow_step_runs(workspace_id);
