-- Real-lot onboarding: import_lot and first-snapshot live state. Runs with no fixture lots involved.
select set_config('app.allow_synthetic', 'off', false);

select public.import_lot('{"name":"Test Mall Parking","city":"Mumbai","address":"1 Test Rd, Mumbai","category":"mall","lat":19.07,"lng":72.87,"car_capacity":200,"base_rate_paise":6000,"municipal_cap_paise":"","operator":"Test Operator","data_source":"operator export","data_as_of":"2026-11-01"}'::jsonb) as lot \gset

select test_helpers.expect_eq((select count(*) from public.lots where id = :'lot' and status = 'approved' and not is_synthetic and data_source = 'operator export'), 1, 'imported lot is approved, real and has provenance');
select test_helpers.expect_eq((select capacity from public.zones where lot_id = :'lot'), 200, 'car zone created with capacity');
select test_helpers.expect_eq((select (rules ->> 'baseRatePerHour')::int from public.price_rules where lot_id = :'lot'), 6000, 'default price rule holds the base rate');
select test_helpers.expect_eq((select count(*) from public.lot_live_state where lot_id = :'lot'), 0, 'no live state is invented at import');
select test_helpers.expect_error($$select public.import_lot('{"name":"test mall parking","city":"Mumbai","category":"mall","lat":19,"lng":72.8,"car_capacity":10,"base_rate_paise":5000,"operator":"x","data_source":"s","data_as_of":"2026-11-01"}'::jsonb)$$, 'duplicate lot name in a city is rejected');
select test_helpers.expect_error($$select public.import_lot('{"name":"No Source","city":"Mumbai","category":"mall","lat":19,"lng":72.8,"car_capacity":10,"base_rate_paise":5000,"operator":"x"}'::jsonb)$$, 'a lot without data_source and data_as_of is rejected');

select public.ingest_occupancy_snapshot(:'lot', 'csv', 120, now() - interval '5 minutes');
select test_helpers.expect_eq((select occupied from public.lot_live_state where lot_id = :'lot'), 120, 'first snapshot creates live state');
select test_helpers.expect_eq((select capacity from public.lot_live_state where lot_id = :'lot'), 200, 'live capacity comes from the car zone');
select public.ingest_occupancy_snapshot(:'lot', 'csv', 500, now());
select test_helpers.expect_eq((select occupied from public.lot_live_state where lot_id = :'lot'), 200, 'count is clamped to capacity');
select test_helpers.expect_eq((select count(*) from public.capacity_snapshots where lot_id = :'lot' and not is_synthetic), 2, 'both snapshots stored as real');

select public.import_lot('{"name":"Other Mall","city":"Ahmedabad","category":"mall","lat":23.02,"lng":72.55,"car_capacity":50,"base_rate_paise":4000,"municipal_cap_paise":"5000","operator":"Test Operator","data_source":"operator export","data_as_of":"2026-11-01"}'::jsonb) as lot2 \gset
select test_helpers.expect_eq((select municipal_cap_per_hour_paise from public.lots where id = :'lot2'), 5000, 'municipal cap stored on the lot');
select test_helpers.expect_eq((select count(*) from public.organizations where name = 'Test Operator'), 2, 'operator org is per city');

\echo ONBOARDING DB ASSERTIONS PASSED
