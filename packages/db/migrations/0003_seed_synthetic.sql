-- 0003_seed_synthetic.sql: DEMO DATA ONLY. Every row below is flagged is_synthetic = true.
-- Lot names and coordinates point at real places for demo realism, but capacities, tariffs and all
-- occupancy are invented. Coordinates are approximate. Never present this as real parking data.

-- ---------- deterministic synthetic occupancy shape (mirrors packages/forecast/src/synthetic.ts) ----------
create or replace function private.bump(h numeric, mu numeric, sd numeric, amp numeric) returns numeric
language sql immutable set search_path = '' as $$
  select amp * exp(-power(h - mu, 2) / (2 * sd * sd))
$$;

create or replace function private.synth_frac(
  cat text, h numeric, weekend_like boolean, is_event boolean, is_festival boolean, is_holiday boolean, is_rain boolean
) returns numeric language plpgsql immutable set search_path = '' as $$
declare f numeric;
begin
  f := case cat
    when 'mall' then case when weekend_like
        then 0.08 + private.bump(h, 13, 2.5, 0.5) + private.bump(h, 18.5, 2.2, 0.55)
        else 0.06 + private.bump(h, 13, 2.5, 0.28) + private.bump(h, 19, 2, 0.4) end
    when 'office' then case when weekend_like
        then 0.06 + private.bump(h, 12, 3, 0.06)
        else 0.08 + private.bump(h, 12, 3.6, 0.82) end
    when 'hospital' then case when weekend_like
        then 0.3 + private.bump(h, 11, 3, 0.25)
        else 0.3 + private.bump(h, 11, 3.2, 0.45) end
    when 'stadium' then 0.04 + case when is_event then private.bump(h, 18.5, 1.7, 0.85) else 0 end
    else 0.2 end;
  if is_event and cat = 'mall' then f := f + private.bump(h, 19, 2, 0.12); end if;
  if is_festival and cat = 'mall' then f := f + private.bump(h, 18, 2.5, 0.15); end if;
  if is_holiday and cat = 'hospital' then f := f * 0.9; end if;
  if is_rain then
    if cat = 'mall' then f := f - private.bump(h, 16, 4, 0.12);
    elsif cat = 'office' then f := f - 0.05;
    elsif cat = 'hospital' then f := f + 0.04; end if;
  end if;
  return greatest(0, least(1, f));
end $$;

-- ---------- organisations ----------
insert into public.organizations (id, name, city, is_synthetic) values
  ('00000000-0000-4000-8000-0000000000a1', 'Synthetic Mumbai Retail Parking Ops', 'Mumbai', true),
  ('00000000-0000-4000-8000-0000000000a2', 'Synthetic Ahmedabad Parking Ops', 'Ahmedabad', true),
  ('00000000-0000-4000-8000-0000000000a3', 'Synthetic Venue and Health Parking Ops', 'Mumbai', true);

-- ---------- lots (15) ----------
insert into public.lots (id, org_id, name, city, address, category, lat, lng, status, feed_source, last_feed_at, is_synthetic, municipal_cap_per_hour_paise) values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-0000000000a1', 'Phoenix Marketcity, Kurla', 'Mumbai', 'LBS Marg, Kurla West', 'mall', 19.0866, 72.8890, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-0000000000a1', 'High Street Phoenix, Lower Parel', 'Mumbai', 'Senapati Bapat Marg, Lower Parel', 'mall', 18.9940, 72.8258, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-0000000000a1', 'Inorbit Mall, Malad', 'Mumbai', 'Link Road, Malad West', 'mall', 19.1740, 72.8346, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-0000000000a1', 'Jio World Drive, BKC', 'Mumbai', 'Bandra Kurla Complex', 'mall', 19.0646, 72.8656, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-0000000000a3', 'Nariman Point Office Parking', 'Mumbai', 'Nariman Point', 'office', 18.9256, 72.8242, 'approved', 'synthetic', now(), true, 9000),
  ('00000000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-0000000000a3', 'Wankhede Stadium Parking', 'Mumbai', 'Churchgate, near Marine Drive', 'stadium', 18.9389, 72.8258, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-0000000000a3', 'KEM Hospital Parking, Parel', 'Mumbai', 'Acharya Donde Marg, Parel', 'hospital', 19.0030, 72.8420, 'approved', 'synthetic', now(), true, 6000),
  ('00000000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-0000000000a3', 'Lilavati Hospital Parking, Bandra', 'Mumbai', 'Bandra Reclamation', 'hospital', 19.0510, 72.8290, 'approved', 'synthetic', now(), true, 6000),
  ('00000000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-0000000000a1', 'BKC G-Block Office Parking', 'Mumbai', 'G Block, Bandra Kurla Complex', 'office', 19.0680, 72.8700, 'pending_approval', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-0000000000a2', 'Alpha One Mall, Vastrapur', 'Ahmedabad', 'Vastrapur', 'mall', 23.0405, 72.5290, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-0000000000a2', 'Acropolis Mall, Thaltej', 'Ahmedabad', 'SG Highway, Thaltej', 'mall', 23.0510, 72.5070, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-0000000000a2', 'Narendra Modi Stadium Parking, Motera', 'Ahmedabad', 'Motera', 'stadium', 23.0915, 72.5975, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000113', '00000000-0000-4000-8000-0000000000a2', 'Sterling Hospital Parking, Memnagar', 'Ahmedabad', 'Memnagar', 'hospital', 23.0510, 72.5370, 'approved', 'synthetic', now(), true, 5000),
  ('00000000-0000-4000-8000-000000000114', '00000000-0000-4000-8000-0000000000a2', 'GIFT City Office Parking', 'Ahmedabad', 'GIFT City, Gandhinagar', 'office', 23.1620, 72.6850, 'approved', 'synthetic', now(), true, null),
  ('00000000-0000-4000-8000-000000000115', '00000000-0000-4000-8000-0000000000a2', 'Ahmedabad One Mall, Vastrapur', 'Ahmedabad', 'Vastrapur', 'mall', 23.0330, 72.5300, 'approved', 'synthetic', now(), true, null);

-- ---------- zones: car zone for every lot, plus two-wheeler and EV zones where it makes sense ----------
insert into public.zones (lot_id, slot_type_id, name, level, capacity, reservable_pct)
select l.id, (select id from public.slot_types where code = 'car'), 'Cars', 'Basement',
  case l.category when 'mall' then 600 when 'office' then 350 when 'stadium' then 1200 when 'hospital' then 220 else 200 end
  + (right(l.id::text, 3)::int % 7) * 20,
  case l.category when 'stadium' then 0.4 when 'hospital' then 0.1 else 0.25 end
from public.lots l where l.is_synthetic;

insert into public.zones (lot_id, slot_type_id, name, level, capacity, reservable_pct)
select l.id, (select id from public.slot_types where code = 'two_wheeler'), 'Two-wheelers', 'Ground',
  case l.category when 'mall' then 250 when 'stadium' then 600 else 120 end, 0
from public.lots l where l.is_synthetic;

insert into public.zones (lot_id, slot_type_id, name, level, capacity, reservable_pct)
select l.id, (select id from public.slot_types where code = 'ev'), 'EV bays', 'Level 1', 12, 0.5
from public.lots l where l.is_synthetic and l.category in ('mall', 'office');

-- ---------- price rules (shape of packages/pricing PricingRules; money in paise) ----------
insert into public.price_rules (lot_id, name, rules)
select l.id, 'Default dynamic tariff',
  jsonb_build_object(
    'baseRatePerHour', case l.category when 'mall' then 8000 when 'office' then 6000 when 'stadium' then 10000 else 4000 end,
    'tiers', jsonb_build_array(
      jsonb_build_object('minOccupancy', 0, 'multiplier', 0.9),
      jsonb_build_object('minOccupancy', 0.4, 'multiplier', 1),
      jsonb_build_object('minOccupancy', 0.6, 'multiplier', 1.15),
      jsonb_build_object('minOccupancy', 0.8, 'multiplier', 1.3),
      jsonb_build_object('minOccupancy', 0.9, 'multiplier', 1.5)),
    'floorMultiplier', 0.8, 'ceilingMultiplier', 2,
    'maxIncreasePerInterval', 0.15, 'maxDecreasePerInterval', 0.2,
    'signalUplifts', jsonb_build_object('rain', 0.05, 'highCongestion', 0.05, 'congestionThreshold', 0.7),
    'maxSignalUplift', 0.1, 'dynamicEnabled', true, 'overstayMultiplier', 1.5,
    'municipalCapPerHour', l.municipal_cap_per_hour_paise)
from public.lots l where l.is_synthetic;

-- ---------- calendar, a match series and rain days, relative to today (IST) ----------
-- Dates are illustrative, not a real fixture list or festival calendar.
with t as (select (now() at time zone 'Asia/Kolkata')::date as today)
insert into public.calendar_days (starts_on, ends_on, name, kind, weight, is_synthetic)
select today + d.off, today + d.off, d.name, d.kind, d.w, true from t, (values
  (-20, 'Synthetic public holiday', 'holiday', 1.0),
  (-9,  'Synthetic public holiday', 'holiday', 1.0),
  (-12, 'Synthetic festival day', 'festival', 1.0),
  (-26, 'Synthetic festival day', 'festival', 0.7),
  (-23, 'Synthetic IPL-style match', 'match', 1.0),
  (-16, 'Synthetic IPL-style match', 'match', 1.0),
  (-9,  'Synthetic IPL-style match', 'match', 1.0),
  (-2,  'Synthetic IPL-style match', 'match', 1.0),
  (6,   'Synthetic IPL-style match', 'match', 1.0)) as d(off, name, kind, w);

with t as (select (now() at time zone 'Asia/Kolkata')::date as today)
insert into public.demand_signals (city, kind, value, valid_at, source, is_mock)
select c.city, 'rain_prob', 0.9, ((today + d.off)::timestamp at time zone 'Asia/Kolkata') + interval '12 hours', 'synthetic-seed', true
from t, (values ('Mumbai'), ('Ahmedabad')) as c(city), (values (-25), (-24), (-14), (-7), (-6), (-3)) as d(off);

with t as (select (now() at time zone 'Asia/Kolkata')::date as today)
insert into public.events (lot_id, city, name, venue, starts_at, ends_at, expected_attendance, impact, source, is_synthetic)
select l.id, l.city, 'Synthetic IPL-style match', l.name,
  ((today + d.off)::timestamp at time zone 'Asia/Kolkata') + interval '19 hours 30 minutes',
  ((today + d.off)::timestamp at time zone 'Asia/Kolkata') + interval '23 hours 30 minutes',
  case l.city when 'Mumbai' then 33000 else 100000 end, 0.9, 'synthetic-seed', true
from t, public.lots l, (values (-23), (-16), (-9), (-2), (6)) as d(off)
where l.category = 'stadium';

-- ---------- 30 days of 15-minute occupancy snapshots (car zones only) ----------
with t as (select (now() at time zone 'Asia/Kolkata')::date as today),
cap as (
  select z.lot_id, sum(z.capacity)::int as capacity
  from public.zones z join public.slot_types st on st.id = z.slot_type_id
  where st.code = 'car' group by z.lot_id
),
slots as (
  select ts, (ts at time zone 'Asia/Kolkata')::date as d
  from t, generate_series(((today - 30)::timestamp at time zone 'Asia/Kolkata'), now(), interval '15 minutes') as ts
),
flags as (
  select s.ts, s.d,
    extract(isodow from s.d) >= 6 as wk,
    exists (select 1 from public.calendar_days c where c.kind = 'match' and s.d between c.starts_on and c.ends_on) as ev,
    exists (select 1 from public.calendar_days c where c.kind = 'festival' and s.d between c.starts_on and c.ends_on) as fest,
    exists (select 1 from public.calendar_days c where c.kind = 'holiday' and s.d between c.starts_on and c.ends_on) as hol
  from slots s
)
insert into public.capacity_snapshots (lot_id, captured_at, occupied, capacity, source, is_synthetic)
select l.id, f.ts,
  least(cap.capacity, greatest(0, round(cap.capacity * least(1, greatest(0,
    private.synth_frac(
      l.category,
      extract(hour from f.ts at time zone 'Asia/Kolkata') + extract(minute from f.ts at time zone 'Asia/Kolkata') / 60.0,
      f.wk or f.hol or f.fest,
      f.ev, f.fest, f.hol,
      exists (select 1 from public.demand_signals r where r.kind = 'rain_prob' and r.city = l.city and r.value >= 0.6
              and (r.valid_at at time zone 'Asia/Kolkata')::date = f.d))
    * (1 + ((abs(hashtextextended(l.id::text || f.d::text, 3)) % 2001) / 1000.0 - 1.0) * 0.05)
    + ((abs(hashtextextended(l.id::text || f.ts::text, 7)) % 2001) / 1000.0 - 1.0) * 0.03
  ))))::int),
  cap.capacity, 'synthetic', true
from public.lots l
join cap on cap.lot_id = l.id
cross join flags f
where l.is_synthetic;

-- Latest snapshot becomes the live state.
insert into public.lot_live_state (lot_id, occupied, capacity, updated_at, source, is_synthetic)
select distinct on (lot_id) lot_id, occupied, capacity, captured_at, 'synthetic', true
from public.capacity_snapshots where is_synthetic order by lot_id, captured_at desc;

-- Source health table starts with the planned sources, all mock or not yet connected.
insert into public.data_source_health (source, kind, is_mock) values
  ('routing', 'RoutingProvider', true),
  ('traffic', 'TrafficSignalProvider', true),
  ('weather', 'Open-Meteo', true),
  ('parking-feed', 'ParkingFeedProvider', true),
  ('synthetic-occupancy', 'seed', true)
on conflict (source) do nothing;
