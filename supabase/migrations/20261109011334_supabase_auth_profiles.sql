create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text not null default '',
  role text not null default 'user' check (role in ('user', 'admin')),
  points_balance integer not null default 0 check (points_balance >= 0),
  point_cooldowns jsonb not null default '{}'::jsonb
    check (jsonb_typeof(point_cooldowns) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
revoke all on table public.profiles from public, anon, authenticated;
grant select on table public.profiles to authenticated;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), ''), 80)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created_create_profile
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.award_live_points(p_stream_id text)
returns table (points_balance integer, awarded integer, retry_after integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles%rowtype;
  v_last_ping timestamptz;
  v_now timestamptz := now();
  v_retry_after integer;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if p_stream_id is null or length(p_stream_id) > 120
     or p_stream_id !~ '^(twitch|kick)-[a-z0-9_]{1,110}$' then
    raise exception 'Invalid stream identifier' using errcode = '22023';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id
  for update;

  if not found then
    raise exception 'Profile not found' using errcode = 'P0002';
  end if;

  v_last_ping := nullif(v_profile.point_cooldowns ->> p_stream_id, '')::timestamptz;
  if v_last_ping is not null and v_last_ping > v_now - interval '60 seconds' then
    v_retry_after := greatest(1, ceil(extract(epoch from (v_last_ping + interval '60 seconds' - v_now)))::integer);
    return query select v_profile.points_balance, 0, v_retry_after;
    return;
  end if;

  update public.profiles
  set point_cooldowns = jsonb_set(point_cooldowns, array[p_stream_id], to_jsonb(v_now), true),
      points_balance = points_balance + 5,
      updated_at = v_now
  where id = v_user_id
  returning public.profiles.points_balance into v_profile.points_balance;

  return query select v_profile.points_balance, 5, 0;
end;
$$;

revoke all on function public.award_live_points(text) from public, anon;
grant execute on function public.award_live_points(text) to authenticated;
