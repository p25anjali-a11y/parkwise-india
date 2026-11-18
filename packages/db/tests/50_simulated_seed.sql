-- The simulated-lots seed applies cleanly (and twice), is fully flagged, stores no occupancy, and can be removed.
select set_config('app.allow_synthetic', 'off', false);
\i :seeddir/simulated_lots.sql
\i :seeddir/simulated_lots.sql
select test_helpers.expect_eq((select count(*) from public.lots where name like '[SIMULATED]%' and is_synthetic and status = 'approved'), 12, 'seed: 12 simulated lots, none duplicated by a second run');
select test_helpers.expect_eq((select count(*) from public.lots where name like '[SIMULATED]%' and is_synthetic and city = 'Mumbai'), 7, 'seed: 7 Mumbai lots');
select test_helpers.expect_eq((select count(*) from public.lots where name like '[SIMULATED]%' and is_synthetic and city = 'Ahmedabad'), 5, 'seed: 5 Ahmedabad lots');
select test_helpers.expect_eq((select count(*) from public.capacity_snapshots where lot_id in (select id from public.lots where name like '[SIMULATED]%')), 0, 'seed: no occupancy rows are stored');
select test_helpers.expect_eq((select count(*) from public.lot_live_state where lot_id in (select id from public.lots where name like '[SIMULATED]%')), 0, 'seed: no live state is stored');
select test_helpers.expect_eq((select count(*) from public.lots l join public.zones z on z.lot_id = l.id join public.price_rules p on p.lot_id = l.id where l.name like '[SIMULATED]%'), 12, 'seed: each lot has a zone and price rule');
-- a saved quote on one simulated lot must not block removal of the rest
insert into public.price_quotes (lot_id, zone_id, arrival_at, duration_min, predicted_occupancy, multiplier, rate_per_hour_paise, total_paise, breakdown)
  select l.id, z.id, now(), 60, 0.5, 1, 8000, 8000, '[]'::jsonb from public.lots l join public.zones z on z.lot_id = l.id where l.name = '[SIMULATED] Bandra Mall Parking';
\i :seeddir/remove_simulated_lots.sql
select test_helpers.expect_eq((select count(*) from public.lots where name like '[SIMULATED]%' and status = 'approved'), 0, 'remove: no simulated lot is visible to drivers');
select test_helpers.expect_eq((select count(*) from public.lots where name like '[SIMULATED]%'), 1, 'remove: only the lot with a saved quote is kept (suspended)');
\echo SIMULATED SEED ASSERTIONS PASSED
