-- Keep the exposed RPC as SECURITY INVOKER and move privileged rate-limit table writes
-- behind the existing non-exposed private schema, retaining an auth.uid() guard.
create or replace function private.consume_api_rate_limit(
  p_bucket text,
  p_max_requests integer default 20,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := auth.uid();
  allowed boolean;
begin
  if current_user_id is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;
  if p_bucket !~ '^[a-z0-9:_-]{1,80}$'
     or p_max_requests not between 1 and 1000
     or p_window_seconds not between 1 and 3600 then
    raise exception 'invalid rate limit parameters' using errcode = '22023';
  end if;
  insert into public.api_rate_limits(user_id,bucket,window_started_at,request_count)
  values(current_user_id,p_bucket,now(),1)
  on conflict(user_id,bucket) do update set
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
$function$;

revoke all on function private.consume_api_rate_limit(text, integer, integer) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.consume_api_rate_limit(text, integer, integer) to authenticated;

create or replace function public.consume_api_rate_limit(
  p_bucket text,
  p_max_requests integer default 20,
  p_window_seconds integer default 60
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private.consume_api_rate_limit(p_bucket, p_max_requests, p_window_seconds);
$function$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to authenticated;
