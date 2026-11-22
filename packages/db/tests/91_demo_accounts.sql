-- The demo-accounts seed applies cleanly (twice), gives each demo operator its own verified business and lots, and can be removed.
-- The test database has a minimal auth schema, so widen it to the columns the seed writes.
create extension if not exists pgcrypto with schema extensions;
alter table auth.users add column if not exists instance_id uuid, add column if not exists aud text, add column if not exists role text,
  add column if not exists encrypted_password text, add column if not exists email_confirmed_at timestamptz, add column if not exists raw_app_meta_data jsonb,
  add column if not exists created_at timestamptz, add column if not exists updated_at timestamptz, add column if not exists confirmation_token text,
  add column if not exists recovery_token text, add column if not exists email_change text, add column if not exists email_change_token_new text;
create table if not exists auth.identities (id uuid primary key, user_id uuid, identity_data jsonb, provider text, provider_id text, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz);
select set_config('app.allow_synthetic', 'off', false);
\i :seeddir/simulated_lots.sql
\i :seeddir/real_places.sql
\i :seeddir/demo_accounts.sql
\i :seeddir/demo_accounts.sql
select test_helpers.expect_eq((select count(*) from auth.users where email like '%@parkwise.example'), 3, 'demo: three users, none duplicated by a second run');
select test_helpers.expect_eq((select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email like '%.operator@parkwise.example' and p.role = 'operator_admin' and p.org_id is not null), 2, 'demo: two operators with an organisation');
select test_helpers.expect_eq((select count(*) from public.profiles p join auth.users u on u.id = p.id where u.email = 'driver@parkwise.example' and p.role = 'driver'), 1, 'demo: the driver stays a driver');
select test_helpers.expect_eq((select count(*) from public.organizations where gstin in ('27AAACP1234C1Z1', '24AAACA5678D1ZW') and verified_at is not null), 2, 'demo: both businesses are verified');
select test_helpers.expect_eq((select count(*) from public.lots l join public.organizations o on o.id = l.org_id where o.gstin = '27AAACP1234C1Z1' and l.city = 'Mumbai' and l.status = 'approved'), 2, 'demo: the Mumbai business owns two approved lots');
select test_helpers.expect_eq((select count(*) from public.lots l join public.organizations o on o.id = l.org_id where o.gstin = '24AAACA5678D1ZW' and l.city = 'Ahmedabad' and l.status = 'approved'), 2, 'demo: the Ahmedabad business owns two approved lots');
select test_helpers.expect_eq((select count(*) from public.lot_live_state where lot_id in (select l.id from public.lots l join public.organizations o on o.id = l.org_id where o.gstin in ('27AAACP1234C1Z1', '24AAACA5678D1ZW'))), 0, 'demo: no occupancy is stored for the demo businesses');
select test_helpers.expect_eq((select count(*) from public.reservations where user_id in (select id from auth.users where email like '%@parkwise.example')), 0, 'demo: no bookings or revenue are invented');
\i :seeddir/remove_demo_accounts.sql
select test_helpers.expect_eq((select count(*) from auth.users where email like '%@parkwise.example'), 0, 'remove: demo users are gone');
select test_helpers.expect_eq((select count(*) from public.organizations where gstin in ('27AAACP1234C1Z1', '24AAACA5678D1ZW')), 0, 'remove: demo businesses are gone');
\echo DEMO ACCOUNTS ASSERTIONS PASSED
