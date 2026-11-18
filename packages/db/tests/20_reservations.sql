-- Reservation function assertions. Runs after 10_assertions.sql in the same database.
\set ON_ERROR_STOP on

-- fixtures: a lot with a one-bay reservable quota, and quotes for two drivers
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000f011', 'd1@example.test'),
  ('00000000-0000-4000-8000-00000000f012', 'd2@example.test');
update public.zones set reservable_pct = 0.004 where lot_id = '00000000-0000-4000-8000-000000000107' and slot_type_id = (select id from public.slot_types where code = 'car');
select test_helpers.expect_eq((select floor(capacity * reservable_pct)::int from public.zones where lot_id = '00000000-0000-4000-8000-000000000107' and slot_type_id = 1), 1, 'fixture: lot 107 car zone has a quota of 1');

insert into public.price_quotes (id, user_id, lot_id, zone_id, arrival_at, duration_min, predicted_occupancy, multiplier, rate_per_hour_paise, total_paise, breakdown)
select q.id::uuid, q.uid::uuid, z.lot_id, z.id, now() + interval '30 minutes', 60, 0.5, 1.0, 4000, 4000, '[]'::jsonb
from public.zones z, (values
  ('00000000-0000-4000-8000-0000000000e1', '00000000-0000-4000-8000-00000000f011'),
  ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-00000000f012'),
  ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-00000000f011')) as q(id, uid)
where z.lot_id = '00000000-0000-4000-8000-000000000107' and z.slot_type_id = 1;

-- privileges: clients cannot call the functions
set role authenticated;
select test_helpers.expect_error($$select public.create_hold('00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-0000000000e1')$$, 'authenticated cannot call create_hold');
select test_helpers.expect_error($$select public.expire_holds()$$, 'authenticated cannot call expire_holds');
reset role;
set role anon;
select test_helpers.expect_error($$select public.confirm_payment(gen_random_uuid(), 'x', null, 'p', 1, null, true)$$, 'anon cannot call confirm_payment');
reset role;

set role service_role;
-- another user's quote is refused
select test_helpers.expect_error($$select public.create_hold('00000000-0000-4000-8000-00000000f012', '00000000-0000-4000-8000-0000000000e1')$$, 'cannot hold against someone else''s quote');
-- happy path
select public.create_hold('00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-0000000000e1');
select test_helpers.expect_eq((select reserved_count from public.zones where lot_id = '00000000-0000-4000-8000-000000000107' and slot_type_id = 1), 1, 'hold increments reserved_count');
select test_helpers.expect_eq((select count(*) from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e1' and status = 'held'), 1, 'hold creates a held reservation');
-- same quote twice
select test_helpers.expect_error($$select public.create_hold('00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-0000000000e1')$$, 'a quote cannot be reserved twice');
-- quota exhausted: second driver cannot take the last bay
select test_helpers.expect_error($$select public.create_hold('00000000-0000-4000-8000-00000000f012', '00000000-0000-4000-8000-0000000000e2')$$, 'no oversell beyond reservable quota');
select test_helpers.expect_eq((select reserved_count from public.zones where lot_id = '00000000-0000-4000-8000-000000000107' and slot_type_id = 1), 1, 'failed hold leaves reserved_count unchanged');

-- payment confirmation is idempotent
select test_helpers.expect_eq((select (public.confirm_payment((select id from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e1'), 'mock', 'o1', 'p1', 4000, 'upi', true) = 'confirmed')::int), 1, 'payment confirms a held reservation');
select test_helpers.expect_eq((select (public.confirm_payment((select id from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e1'), 'mock', 'o1', 'p1', 4000, 'upi', true) = 'already')::int), 1, 'replayed payment is a no-op');
select test_helpers.expect_eq((select count(*) from public.payments where provider_payment_id = 'p1'), 1, 'one payment row per provider payment id');

-- cancelling releases the bay; another user can now hold
select test_helpers.expect_eq((select (public.cancel_reservation('00000000-0000-4000-8000-00000000f011', (select id from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e1')) = 'cancelled')::int), 1, 'owner can cancel');
select test_helpers.expect_eq((select reserved_count from public.zones where lot_id = '00000000-0000-4000-8000-000000000107' and slot_type_id = 1), 0, 'cancel releases the bay');
select public.create_hold('00000000-0000-4000-8000-00000000f012', '00000000-0000-4000-8000-0000000000e2');
select test_helpers.expect_eq((select (public.cancel_reservation('00000000-0000-4000-8000-00000000f011', (select id from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e2')) = 'not_found')::int), 1, 'a different user cannot cancel it');

-- expiry releases the bay and a late payment is flagged for refund
reset role;
update public.reservations set hold_expires_at = now() - interval '1 minute' where quote_id = '00000000-0000-4000-8000-0000000000e2';
set role service_role;
select test_helpers.expect_eq(public.expire_holds(), 1, 'expire_holds releases one lapsed hold');
select test_helpers.expect_eq((select reserved_count from public.zones where lot_id = '00000000-0000-4000-8000-000000000107' and slot_type_id = 1), 0, 'expiry releases the bay');
select test_helpers.expect_eq((select (public.confirm_payment((select id from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e2'), 'mock', 'o2', 'p2', 4000, 'upi', true) = 'refund_needed')::int), 1, 'payment after expiry is flagged for refund');
select test_helpers.expect_eq((select count(*) from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e2' and status = 'expired'), 1, 'late payment does not resurrect an expired hold');
reset role;

-- create_hold itself reclaims a lapsed hold: e4 holds the only bay, lapses, then e3 can take it with no cron run
reset role;
insert into public.price_quotes (id, user_id, lot_id, zone_id, arrival_at, duration_min, predicted_occupancy, multiplier, rate_per_hour_paise, total_paise, breakdown)
select '00000000-0000-4000-8000-0000000000e4', '00000000-0000-4000-8000-00000000f012', z.lot_id, z.id, now() + interval '30 minutes', 60, 0.5, 1.0, 4000, 4000, '[]'::jsonb
from public.zones z where z.lot_id = '00000000-0000-4000-8000-000000000107' and z.slot_type_id = 1;
set role service_role;
select public.create_hold('00000000-0000-4000-8000-00000000f012', '00000000-0000-4000-8000-0000000000e4');
select test_helpers.expect_error($$select public.create_hold('00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-0000000000e3')$$, 'bay is taken while the hold is live');
reset role;
update public.reservations set hold_expires_at = now() - interval '1 minute' where quote_id = '00000000-0000-4000-8000-0000000000e4';
set role service_role;
select public.create_hold('00000000-0000-4000-8000-00000000f011', '00000000-0000-4000-8000-0000000000e3');
select test_helpers.expect_eq((select count(*) from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e3' and status = 'held'), 1, 'create_hold reclaims a lapsed hold without a cron run');
select test_helpers.expect_eq((select count(*) from public.reservations where quote_id = '00000000-0000-4000-8000-0000000000e4' and status = 'expired'), 1, 'the lapsed hold was marked expired');
reset role;

\echo RESERVATION DB ASSERTIONS PASSED
