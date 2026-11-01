-- Multilingual semantic Memory retrieval using Cloudflare Workers AI and pgvector.
create extension if not exists vector with schema extensions;

alter table public.agent_memories
  add column if not exists embedding extensions.vector(1024),
  add column if not exists embedding_model text,
  add column if not exists embedded_at timestamptz;

create index if not exists agent_memories_embedding_hnsw_idx
  on public.agent_memories
  using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;

create or replace function private.match_agent_memories(
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
  select
    m.id,
    m.category,
    m.content,
    m.importance,
    m.pinned,
    (1 - (m.embedding OPERATOR(extensions.<=>) p_query_embedding))::real as similarity
  from public.agent_memories as m
  where m.workspace_id = p_workspace_id
    and m.user_id = p_user_id
    and m.embedding is not null
    and 1 - (m.embedding OPERATOR(extensions.<=>) p_query_embedding) >= p_match_threshold
  order by m.embedding OPERATOR(extensions.<=>) p_query_embedding asc
  limit greatest(1, least(coalesce(p_match_count, 8), 20));
$$;

revoke all on function private.match_agent_memories(uuid, uuid, extensions.vector, integer, real) from public, anon, authenticated;
grant execute on function private.match_agent_memories(uuid, uuid, extensions.vector, integer, real) to service_role;
grant usage on schema extensions to service_role;
