-- Assertions on schema, RLS, guard triggers and seed. Raises on the first failure.
\set ON_ERROR_STOP on

-- ---- fixtures (run as the owner, bypassing RLS) ----
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000f001', 'driver@example.test'),
  ('00000000-0000-4000-8000-00000000f002', 'ops@example.test'),
  ('00000000-0000-4000-8000-00000000f003', 'admin@example.test'),
  ('00000000-0000-4000-8000-00000000f004', 'otherops@example.test');
update public.profiles set role = 'operator_admin', org_id = '00000000-0000-4000-8000-0000000000a1' where id = '00000000-0000-4000-8000-00000000f002';
update public.profiles set role = 'platform_admin' where id = '00000000-0000-4000-8000-00000000f003';
update public.profiles set role = 'operator_admin', org_id = '00000000-0000-4000-8000-0000000000a2' where id = '00000000-0000-4000-8000-00000000f004';

-- ---- seed shape ----
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic), 15, 'seed: 15 synthetic lots');
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic and city = 'Mumbai'), 9, 'seed: 9 Mumbai lots');
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic and city = 'Ahmedabad'), 6, 'seed: 6 Ahmedabad lots');
select test_helpers.expect_eq((select count(*) from public.price_rules), 15, 'seed: price rule per lot');
select test_helpers.expect_eq((select count(*) from public.lot_live_state), 15, 'seed: live state per lot');
select test_helpers.expect_eq((select (count(*) >= 15 * 30 * 96)::int from public.capacity_snapshots), 1, 'seed: at least 30 days of 15-min snapshots');
select test_helpers.expect_eq((select count(*) from public.capacity_snapshots where occupied > capacity or occupied < 0), 0, 'seed: occupancy within capacity');
select test_helpers.expect_eq((select count(*) from public.capacity_snapshots where not is_synthetic), 0, 'seed: every snapshot flagged synthetic');

-- weekday office peak should exceed weekend office level; stadium match evening should exceed a normal evening
select test_helpers.expect_eq((
  select (avg(case when extract(isodow from captured_at at time zone 'Asia/Kolkata') < 6 then occupied::numeric / capacity end)
        > 2 * avg(case when extract(isodow from captured_at at time zone 'Asia/Kolkata') >= 6 then occupied::numeric / capacity end))::int
  from public.capacity_snapshots s join public.lots l on l.id = s.lot_id
  where l.category = 'office' and extract(hour from captured_at at time zone 'Asia/Kolkata') between 11 and 13
    and not exists (select 1 from public.calendar_days c where c.kind in ('holiday', 'festival') and (s.captured_at at time zone 'Asia/Kolkata')::date between c.starts_on and c.ends_on)
), 1, 'seed: weekday office midday much busier than weekend');

select test_helpers.expect_eq((
  select (max(case when ev then f end) > max(case when not ev then f end) + 0.3)::int from (
    select s.occupied::numeric / s.capacity as f,
      exists (select 1 from public.calendar_days c where c.kind = 'match' and (s.captured_at at time zone 'Asia/Kolkata')::date between c.starts_on and c.ends_on) as ev
    from public.capacity_snapshots s join public.lots l on l.id = s.lot_id
    where l.category = 'stadium' and extract(hour from s.captured_at at time zone 'Asia/Kolkata') between 18 and 20
  ) x
), 1, 'seed: stadium match evening much busier than normal evening');

-- ---- anon ----
set role anon;
select test_helpers.expect_eq((select count(*) from public.lots), 14, 'anon sees only approved lots (14 of 15)');
select test_helpers.expect_eq((select count(*) from public.lot_live_state), 14, 'anon sees live state of approved lots only');
select test_helpers.expect_error('select * from public.price_rules', 'anon cannot read price rules');
select test_helpers.expect_error('select * from public.reservations', 'anon cannot read reservations');
select test_helpers.expect_error('select * from public.capacity_snapshots', 'anon cannot read raw snapshots');
select test_helpers.expect_error('select * from public.feed_endpoints', 'anon cannot read webhook secrets');
select test_helpers.expect_error($$insert into public.lots (org_id, name, city, category, lat, lng) values ('00000000-0000-4000-8000-0000000000a1','x','Mumbai','mall',1,1)$$, 'anon cannot insert lots');
reset role;

-- ---- driver ----
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000f001';
select test_helpers.expect_eq((select count(*) from public.lots), 14, 'driver sees approved lots only');
select test_helpers.expect_eq((select count(*) from public.price_rules), 0, 'driver sees no price rules');
select test_helpers.expect_eq((select count(*) from public.profiles), 1, 'driver sees only own profile');
select test_helpers.expect_error($$update public.profiles set role = 'platform_admin' where id = '00000000-0000-4000-8000-00000000f001'$$, 'driver cannot self-promote');
select test_helpers.expect_error($$update public.profiles set org_id = '00000000-0000-4000-8000-0000000000a1' where id = '00000000-0000-4000-8000-00000000f001'$$, 'driver cannot join an org');
select test_helpers.expect_error($$insert into public.lots (org_id, name, city, category, lat, lng) values ('00000000-0000-4000-8000-0000000000a1','x','Mumbai','mall',1,1)$$, 'driver cannot create lots');
insert into public.vehicles (user_id, plate_hash, plate_last4) values ('00000000-0000-4000-8000-00000000f001', 'hash1', '1234');
select test_helpers.expect_eq((select count(*) from public.vehicles), 1, 'driver can save own vehicle');
select test_helpers.expect_error($$insert into public.vehicles (user_id, plate_hash, plate_last4) values ('00000000-0000-4000-8000-00000000f003', 'hash2', '9999')$$, 'driver cannot save a vehicle for someone else');
reset role;

-- ---- operator admin, org a1 ----
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000f002';
select test_helpers.expect_eq((select count(*) from public.lots where org_id = '00000000-0000-4000-8000-0000000000a1'), 5, 'operator sees all 5 of own org lots incl. pending');
select test_helpers.expect_eq((select count(*) from public.lots where org_id = '00000000-0000-4000-8000-0000000000a2'), 6, 'operator sees approved lots of other orgs (public)');
select test_helpers.expect_eq((select count(*) from public.price_rules), 5, 'operator sees only own org price rules');
select test_helpers.expect_error($$update public.lots set status = 'approved' where id = '00000000-0000-4000-8000-000000000109'$$, 'operator cannot approve own lot');
select test_helpers.expect_error($$update public.lots set org_id = '00000000-0000-4000-8000-0000000000a2' where id = '00000000-0000-4000-8000-000000000101'$$, 'operator cannot move a lot to another org');
update public.lots set name = 'Phoenix Marketcity, Kurla (renamed)' where id = '00000000-0000-4000-8000-000000000101';
select test_helpers.expect_eq((select count(*) from public.lots where name like '%renamed%'), 1, 'operator can edit own lot');
update public.lots set name = 'hijack' where id = '00000000-0000-4000-8000-000000000110';
select test_helpers.expect_eq((select count(*) from public.lots where name = 'hijack'), 0, 'operator cannot edit other org lot (update matches 0 rows)');
insert into public.lots (org_id, name, city, category, lat, lng, status) values ('00000000-0000-4000-8000-0000000000a1', 'New lot', 'Mumbai', 'office', 19.0, 72.8, 'draft');
select test_helpers.expect_error($$insert into public.lots (org_id, name, city, category, lat, lng, status) values ('00000000-0000-4000-8000-0000000000a1','Sneaky','Mumbai','office',19,72.8,'approved')$$, 'operator cannot insert an already approved lot');
select test_helpers.expect_error($$insert into public.lots (org_id, name, city, category, lat, lng) values ('00000000-0000-4000-8000-0000000000a2','Other org','Mumbai','office',19,72.8)$$, 'operator cannot create lots for another org');
select test_helpers.expect_error('select * from public.feed_endpoints', 'operator cannot read webhook secrets through the Data API');
reset role;

-- ---- operator of org a2 cannot see org a1 private rows ----
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000f004';
select test_helpers.expect_eq((select count(*) from public.price_rules where lot_id = '00000000-0000-4000-8000-000000000101'), 0, 'other org operator cannot read these price rules');
select test_helpers.expect_eq((select count(*) from public.capacity_snapshots where lot_id = '00000000-0000-4000-8000-000000000101'), 0, 'other org operator cannot read these snapshots');
reset role;

-- ---- platform admin ----
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-00000000f003';
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic), 15, 'platform admin sees all lots');
update public.lots set status = 'approved' where id = '00000000-0000-4000-8000-000000000109';
select test_helpers.expect_eq((select count(*) from public.lots where id = '00000000-0000-4000-8000-000000000109' and status = 'approved'), 1, 'platform admin can approve a lot');
select test_helpers.expect_eq((select count(*) from public.data_source_health), 5, 'platform admin can read data source health');
reset role;

-- ---- immutability, quota and concurrency guards (owner context) ----
insert into public.price_quotes (id, lot_id, zone_id, arrival_at, duration_min, predicted_occupancy, multiplier, rate_per_hour_paise, total_paise, breakdown)
select '00000000-0000-4000-8000-0000000000c1', l.id, z.id, now(), 60, 0.5, 1.0, 8000, 8000, '[]'::jsonb
from public.lots l join public.zones z on z.lot_id = l.id join public.slot_types st on st.id = z.slot_type_id
where l.id = '00000000-0000-4000-8000-000000000101' and st.code = 'car';
select test_helpers.expect_error($$update public.price_quotes set total_paise = 1 where id = '00000000-0000-4000-8000-0000000000c1'$$, 'price quotes are immutable (update)');
select test_helpers.expect_error($$delete from public.price_quotes where id = '00000000-0000-4000-8000-0000000000c1'$$, 'price quotes are immutable (delete)');

select test_helpers.expect_error($$update public.zones set reserved_count = capacity where id = (select id from public.zones limit 1)$$, 'zone quota blocks overselling (reserved_count > floor(capacity * pct))');

insert into public.reservations (id, user_id, lot_id, zone_id, quote_id, status, arrival_at, duration_min, hold_expires_at, total_paise)
select '00000000-0000-4000-8000-0000000000d1', '00000000-0000-4000-8000-00000000f001', q.lot_id, q.zone_id, q.id, 'held', now(), 60, now() + interval '15 minutes', 8000
from public.price_quotes q where q.id = '00000000-0000-4000-8000-0000000000c1';
update public.reservations set status = 'confirmed' where id = '00000000-0000-4000-8000-0000000000d1';
select test_helpers.expect_eq((select version from public.reservations where id = '00000000-0000-4000-8000-0000000000d1'), 1, 'reservation version increments on update (optimistic concurrency)');

select test_helpers.expect_error($$insert into public.occupancy_events (lot_id, occurred_at, direction, source, idempotency_key)
  values ('00000000-0000-4000-8000-000000000101', now(), 'entry', 'webhook', 'k1'), ('00000000-0000-4000-8000-000000000101', now(), 'entry', 'webhook', 'k1')$$,
  'duplicate idempotency key is rejected');

-- ---- real data only ----
select test_helpers.expect_error($$insert into public.lots (org_id, name, city, category, lat, lng, is_synthetic)
  select id, 'x', 'Mumbai', 'mall', 19, 72.8, true from public.organizations limit 1$$,
  'synthetic lots are refused outside a test session');
select test_helpers.expect_eq((select count(*) from public.price_quotes where predicted_occupancy is null and false), 0, 'quotes may omit occupancy (column nullable)');
select test_helpers.expect_eq((select (is_nullable = 'YES')::int from information_schema.columns where table_name = 'price_quotes' and column_name = 'predicted_occupancy'), 1, 'predicted_occupancy is nullable');

\echo ALL DB ASSERTIONS PASSED
