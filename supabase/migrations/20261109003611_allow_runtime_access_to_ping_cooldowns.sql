create policy liveloot_runtime_all on public.live_point_pings
for all to liveloot_runtime
using (true)
with check (true);
