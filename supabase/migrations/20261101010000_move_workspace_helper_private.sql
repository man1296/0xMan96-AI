-- Move the RLS membership helper out of the exposed Data API schema.
-- Existing policies retain their function dependency when the function is moved.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter function public.is_workspace_member(uuid) set schema private;
alter function private.is_workspace_member(uuid) set search_path = '';
revoke all on function private.is_workspace_member(uuid) from public, anon;
grant execute on function private.is_workspace_member(uuid) to authenticated;
