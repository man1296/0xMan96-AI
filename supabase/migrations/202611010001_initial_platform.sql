-- 0xMan96 AI: initial multi-tenant platform schema.
-- Apply through Supabase migrations after reviewing project settings.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation' check (char_length(title) <= 240),
  agent_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','tool')),
  content text not null check (char_length(content) <= 50000),
  token_count integer check (token_count is null or token_count >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 255),
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 26214400),
  storage_path text not null unique,
  status text not null default 'uploaded' check (status in ('uploading','uploaded','processing','ready','failed')),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.content_projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  brief jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft','in_progress','review','approved','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('text','image','video','audio','transcription','export','publish')),
  provider text,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed','cancelled')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_code text,
  attempts integer not null default 0 check (attempts >= 0),
  run_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 120),
  target_type text,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.api_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  primary key (user_id, bucket)
);

create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists conversations_workspace_updated_idx on public.conversations(workspace_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index if not exists documents_workspace_created_idx on public.knowledge_documents(workspace_id, created_at desc);
create index if not exists content_projects_workspace_updated_idx on public.content_projects(workspace_id, updated_at desc);
create index if not exists generation_jobs_status_run_idx on public.generation_jobs(status, run_at) where status = 'queued';
create index if not exists audit_events_workspace_created_idx on public.audit_events(workspace_id, created_at desc);

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare new_workspace_id uuid;
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email,''),'@',1)))
  on conflict (id) do nothing;

  insert into public.workspaces (name, owner_id)
  values ('Personal workspace', new.id)
  returning id into new_workspace_id;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_0xman96 on auth.users;
create trigger on_auth_user_created_0xman96
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_max_requests integer default 20,
  p_window_seconds integer default 60
) returns boolean
language plpgsql security definer
set search_path = public
as $$
declare current_user_id uuid := auth.uid();
declare allowed boolean;
begin
  if current_user_id is null then raise exception 'authentication required' using errcode = '28000'; end if;
  if p_bucket !~ '^[a-z0-9:_-]{1,80}$' or p_max_requests not between 1 and 1000 or p_window_seconds not between 1 and 3600 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;

  insert into public.api_rate_limits(user_id, bucket, window_started_at, request_count)
  values (current_user_id, p_bucket, now(), 1)
  on conflict (user_id, bucket) do update set
    request_count = case
      when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then 1
      else public.api_rate_limits.request_count + 1
    end,
    window_started_at = case
      when public.api_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds) then now()
      else public.api_rate_limits.window_started_at
    end
  returning request_count <= p_max_requests into allowed;
  return allowed;
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.knowledge_documents enable row level security;
alter table public.content_projects enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.audit_events enable row level security;
alter table public.api_rate_limits enable row level security;

create policy "profile_select_self" on public.profiles for select to authenticated using (id = auth.uid());
create policy "profile_update_self" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "workspace_select_members" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "workspace_update_owner" on public.workspaces for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "member_select_workspace" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "conversation_member_access" on public.conversations for all to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "message_member_access" on public.messages for all to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "document_member_access" on public.knowledge_documents for all to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "content_member_access" on public.content_projects for all to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "job_member_access" on public.generation_jobs for all to authenticated using (user_id = auth.uid() and public.is_workspace_member(workspace_id)) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "audit_member_read" on public.audit_events for select to authenticated using (workspace_id is not null and public.is_workspace_member(workspace_id));
create policy "rate_limit_no_client_access" on public.api_rate_limits for all to authenticated using (false) with check (false);

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workspace-assets', 'workspace-assets', false, 26214400,
  array['application/pdf','text/plain','text/markdown','text/csv','application/json','image/png','image/jpeg','image/webp','audio/mpeg','audio/wav','video/mp4'])
on conflict (id) do update set public = false, file_size_limit = 26214400;

create policy "workspace_storage_read" on storage.objects for select to authenticated
using (bucket_id = 'workspace-assets' and public.is_workspace_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = auth.uid()::text);
create policy "workspace_storage_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'workspace-assets' and public.is_workspace_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = auth.uid()::text);
create policy "workspace_storage_update" on storage.objects for update to authenticated
using (bucket_id = 'workspace-assets' and public.is_workspace_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = auth.uid()::text)
with check (bucket_id = 'workspace-assets' and public.is_workspace_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = auth.uid()::text);
create policy "workspace_storage_delete" on storage.objects for delete to authenticated
using (bucket_id = 'workspace-assets' and public.is_workspace_member(((storage.foldername(name))[1])::uuid) and (storage.foldername(name))[2] = auth.uid()::text);
