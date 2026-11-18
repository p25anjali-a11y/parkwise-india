-- 0006: real data only. Removes the demo seed that earlier deployments loaded, and stops synthetic
-- rows from ever being written outside a test database again.

-- Purge. Lots cascade to zones, price rules, snapshots, live state, forecasts and events.
delete from public.lots where is_synthetic;
delete from public.organizations where is_synthetic and not exists (select 1 from public.lots l where l.org_id = organizations.id);
delete from public.calendar_days where is_synthetic;
delete from public.events where is_synthetic;
delete from public.capacity_snapshots where is_synthetic;
delete from public.demand_signals where is_mock;
delete from public.data_source_health where source = 'synthetic-occupancy';

-- Source health rows for the real sources (a fresh database has none, because the seed used to add them).
insert into public.data_source_health (source, kind, is_mock) values
  ('routing', 'RoutingProvider', true),
  ('traffic', 'TrafficSignalProvider', true),
  ('weather', 'Open-Meteo', true),
  ('parking-feed', 'ParkingFeedProvider', true)
on conflict (source) do nothing;

-- Guard: synthetic lots can only be created when a test session opts in.
create or replace function private.forbid_synthetic_lots() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_synthetic and coalesce(current_setting('app.allow_synthetic', true), '') <> 'on' then
    raise exception 'synthetic lots are not allowed outside a test database';
  end if;
  return new;
end $$;
drop trigger if exists lots_forbid_synthetic on public.lots;
create trigger lots_forbid_synthetic before insert or update of is_synthetic on public.lots
  for each row execute function private.forbid_synthetic_lots();

-- A quote can now be made without any occupancy figure, and records which inputs it used.
alter table public.price_quotes alter column predicted_occupancy drop not null;
alter table public.price_quotes add column if not exists data_inputs jsonb;
