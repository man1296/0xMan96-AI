-- Resolve RLS init-plan warnings by evaluating auth and membership helpers once per statement.
alter policy profile_select_self on public.profiles
  using (id = (select auth.uid()));
alter policy profile_update_self on public.profiles
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy workspace_update_owner on public.workspaces
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

alter policy conversation_member_access on public.conversations
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

alter policy content_member_access on public.content_projects
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)))
  with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

alter policy job_member_delete_queued on public.generation_jobs
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)) and status = 'queued');
alter policy job_member_insert on public.generation_jobs
  with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and status = 'queued' and attempts = 0 and started_at is null and completed_at is null);
alter policy job_member_read on public.generation_jobs
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));

alter policy document_member_delete on public.knowledge_documents
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));
alter policy document_member_insert on public.knowledge_documents
  with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)) and status = 'uploading');
alter policy document_member_read on public.knowledge_documents
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));
alter policy document_member_update on public.knowledge_documents
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)) and status = 'uploading')
  with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)) and status = 'uploaded');

alter policy message_member_delete on public.messages
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and role = any (array['user'::text, 'assistant'::text]));
alter policy message_member_insert on public.messages
  with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and role = any (array['user'::text, 'assistant'::text]));
alter policy message_member_read on public.messages
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id)));
alter policy message_member_update on public.messages
  using (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and role = any (array['user'::text, 'assistant'::text]))
  with check (user_id = (select auth.uid()) and (select private.is_workspace_member(workspace_id))
    and role = any (array['user'::text, 'assistant'::text]));

-- The table's unique constraint already owns a unique (run_id, step_index) index.
-- Keep that constraint and remove duplicate indexes over the same key.
drop index if exists public.workflow_step_runs_run_step_unique;
drop index if exists public.workflow_steps_run_idx;
