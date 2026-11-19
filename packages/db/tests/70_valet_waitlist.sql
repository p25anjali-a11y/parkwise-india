-- 0009 structure: the three new tables exist and have row level security on.
select test_helpers.expect_eq((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('car_pins', 'waitlist', 'valet_requests') and c.relrowsecurity), 3, 'car_pins, waitlist and valet_requests have RLS enabled');
select test_helpers.expect_eq((select count(*) from pg_policies where schemaname = 'public' and tablename = 'valet_requests'), 5, 'valet_requests has driver and operator policies');

\echo VALET WAITLIST DB ASSERTIONS PASSED
