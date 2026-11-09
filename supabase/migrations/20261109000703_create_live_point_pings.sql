create table if not exists public.live_point_pings (
  user_id text not null,
  stream_id text not null,
  last_ping_at timestamptz not null default now(),
  primary key (user_id, stream_id)
);

alter table public.live_point_pings enable row level security;
revoke all on table public.live_point_pings from anon, authenticated;
