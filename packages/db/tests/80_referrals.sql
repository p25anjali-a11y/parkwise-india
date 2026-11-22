-- 0010 referrals: structure, privileges, claim rules and one-time rewards.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-0000000000a1', 'ref-a@example.test'),
  ('00000000-0000-4000-8000-0000000000a2', 'ref-b@example.test'),
  ('00000000-0000-4000-8000-0000000000a3', 'ref-c@example.test');

select test_helpers.expect_eq((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('referral_codes', 'referrals', 'wallet_ledger') and c.relrowsecurity), 3, 'referral tables have RLS enabled');

-- clients cannot call the functions or write the tables
set role authenticated;
select test_helpers.expect_error($$select public.get_or_create_referral_code('00000000-0000-4000-8000-0000000000a1')$$, 'authenticated cannot create codes');
select test_helpers.expect_error($$select public.reward_referral(gen_random_uuid(), 1, 1, 1)$$, 'authenticated cannot reward');
select test_helpers.expect_error($$insert into public.wallet_ledger (user_id, amount_paise, reason) values ('00000000-0000-4000-8000-0000000000a1', 100, 'adjustment')$$, 'authenticated cannot write the ledger');
reset role;

set role service_role;
create temp table codes as select public.get_or_create_referral_code('00000000-0000-4000-8000-0000000000a1') as code;
select test_helpers.expect_eq((select count(*) from codes where code ~ '^[A-Z0-9]{8}$'), 1, 'code is 8 upper-case characters');
select test_helpers.expect_eq((select public.get_or_create_referral_code('00000000-0000-4000-8000-0000000000a1') = (select code from codes))::int, 1, 'the same user gets the same code');
select test_helpers.expect_eq((select (public.claim_referral('00000000-0000-4000-8000-0000000000a1', (select code from codes)) = 'self')::int), 1, 'you cannot claim your own code');
select test_helpers.expect_eq((select (public.claim_referral('00000000-0000-4000-8000-0000000000a2', 'NOPE0000') = 'invalid')::int), 1, 'unknown code is invalid');
select test_helpers.expect_eq((select (public.claim_referral('00000000-0000-4000-8000-0000000000a2', lower((select code from codes))) = 'ok')::int), 1, 'a friend can claim a code, case-insensitively');
select test_helpers.expect_eq((select (public.claim_referral('00000000-0000-4000-8000-0000000000a2', (select code from codes)) = 'already')::int), 1, 'a user can claim only once');
reset role;

-- a confirmed booking by the friend (a2): fixture lot 107
insert into public.price_quotes (id, user_id, lot_id, zone_id, arrival_at, duration_min, predicted_occupancy, multiplier, rate_per_hour_paise, total_paise, breakdown)
select '00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a2', z.lot_id, z.id, now() + interval '30 minutes', 60, 0.5, 1.0, 4000, 4000, '[]'::jsonb
from public.zones z where z.lot_id = '00000000-0000-4000-8000-000000000107' and z.slot_type_id = 1;
insert into public.reservations (id, user_id, lot_id, zone_id, quote_id, status, arrival_at, duration_min, hold_expires_at, total_paise)
select '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a2', q.lot_id, q.zone_id, q.id, 'confirmed', now() + interval '30 minutes', 60, now() + interval '10 minutes', 4000
from public.price_quotes q where q.id = '00000000-0000-4000-8000-0000000000b1';

set role service_role;
select test_helpers.expect_eq((select (public.reward_referral('00000000-0000-4000-8000-0000000000c1', 10000, 10000, 5000) = 'none')::int), 1, 'a booking below the minimum earns nothing');
select test_helpers.expect_eq((select (public.reward_referral('00000000-0000-4000-8000-0000000000c1', 10000, 10000, 1000) = 'rewarded')::int), 1, 'the first confirmed booking above the minimum rewards both');
select test_helpers.expect_eq((select (public.reward_referral('00000000-0000-4000-8000-0000000000c1', 10000, 10000, 1000) = 'none')::int), 1, 'the reward is paid only once');
select test_helpers.expect_eq((select sum(amount_paise)::int from public.wallet_ledger where user_id = '00000000-0000-4000-8000-0000000000a1'), 10000, 'the inviter is credited');
select test_helpers.expect_eq((select sum(amount_paise)::int from public.wallet_ledger where user_id = '00000000-0000-4000-8000-0000000000a2'), 10000, 'the friend is credited');
select test_helpers.expect_eq((select (public.claim_referral('00000000-0000-4000-8000-0000000000a3', (select code from codes)) = 'ok')::int), 1, 'a third user can claim');
reset role;

-- RLS: a user sees only their own ledger rows
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-4000-8000-0000000000a1';
select test_helpers.expect_eq((select count(*) from public.wallet_ledger)::int, 1, 'the inviter sees only their own ledger row');
select test_helpers.expect_eq((select count(*) from public.referrals)::int, 2, 'the inviter sees the referrals they made');
reset role;
\echo REFERRAL DB ASSERTIONS PASSED
