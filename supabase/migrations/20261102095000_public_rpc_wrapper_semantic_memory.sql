-- Expose only a service-role callable PostgREST wrapper; keep the implementation private.
create or replace function public.match_agent_memories(
  p_workspace_id uuid,
  p_user_id uuid,
  p_query_embedding extensions.vector(1024),
  p_match_count integer default 8,
  p_match_threshold real default 0.32
)
returns table (
  id uuid,
  category text,
  content text,
  importance smallint,
  pinned boolean,
  similarity real
)
language sql
stable
security invoker
set search_path = ''
as $$
  select *
  from private.match_agent_memories(
    p_workspace_id,
    p_user_id,
    p_query_embedding,
    p_match_count,
    p_match_threshold
  );
$$;

revoke all on function public.match_agent_memories(uuid, uuid, extensions.vector, integer, real) from public, anon, authenticated;
grant execute on function public.match_agent_memories(uuid, uuid, extensions.vector, integer, real) to service_role;
