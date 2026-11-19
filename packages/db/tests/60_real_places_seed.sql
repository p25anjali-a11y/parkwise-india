-- The real-places seed applies cleanly (twice), hides the invented lots, stores no occupancy, and can be removed.
select set_config('app.allow_synthetic', 'off', false);
\i :seeddir/simulated_lots.sql
\i :seeddir/real_places.sql
\i :seeddir/real_places.sql
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic and status = 'approved' and org_id in (select id from public.organizations where name = 'Demo data (simulated occupancy)')), 18, 'places: 18 real-place lots, none duplicated by a second run');
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic and status = 'approved' and name like '[SIMULATED]%'), 0, 'places: invented lots are hidden');
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic and status = 'approved' and city = 'Ahmedabad' and org_id in (select id from public.organizations where name = 'Demo data (simulated occupancy)')), 8, 'places: 8 Ahmedabad lots');
select test_helpers.expect_eq((select count(*) from public.lot_live_state where lot_id in (select id from public.lots where is_synthetic and org_id in (select id from public.organizations where name = 'Demo data (simulated occupancy)'))), 0, 'places: no live state is stored');
select test_helpers.expect_eq((select count(*) from public.capacity_snapshots where lot_id in (select id from public.lots where is_synthetic and org_id in (select id from public.organizations where name = 'Demo data (simulated occupancy)'))), 0, 'places: no occupancy rows are stored');
\i :seeddir/remove_real_places.sql
select test_helpers.expect_eq((select count(*) from public.lots where is_synthetic and status = 'approved' and org_id in (select id from public.organizations where name = 'Demo data (simulated occupancy)')), 0, 'remove: no demo lot is visible to drivers');
\echo REAL PLACES SEED ASSERTIONS PASSED
