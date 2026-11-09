-- The previous RPC awarded app points from browser visibility, which is not
-- evidence of official Twitch or Kick watch time. Preserve existing balances,
-- but prevent client roles from creating further unverified points.
revoke all on function public.award_live_points(text) from public, anon, authenticated;
