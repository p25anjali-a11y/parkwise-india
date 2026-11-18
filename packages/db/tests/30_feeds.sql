-- Feed ingestion assertions. Runs after 10 and 20 in the same database.
\set ON_ERROR_STOP on

set role authenticated;
select test_helpers.expect_error($$select public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'webhook', '[]'::jsonb)$$, 'authenticated cannot ingest events');
reset role;
set role anon;
select test_helpers.expect_error($$select public.ingest_occupancy_snapshot('00000000-0000-4000-8000-000000000101', 'csv', 5)$$, 'anon cannot ingest snapshots');
reset role;

-- known starting point on a synthetic lot: 100 of capacity C
update public.lot_live_state set occupied = 100 where lot_id = '00000000-0000-4000-8000-000000000101';

set role service_role;
select test_helpers.expect_eq((public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'webhook',
  '[{"occurred_at":"2026-11-20T10:00:00Z","direction":"entry","idempotency_key":"a1"},
    {"occurred_at":"2026-11-20T10:01:00Z","direction":"entry","idempotency_key":"a2"},
    {"occurred_at":"2026-11-20T10:02:00Z","direction":"exit","idempotency_key":"a3"}]'::jsonb) ->> 'occupied')::int, 101, 'two entries and one exit move the count by +1');
select test_helpers.expect_eq((select occupied from public.lot_live_state where lot_id = '00000000-0000-4000-8000-000000000101'), 101, 'live state updated');
select test_helpers.expect_eq((select (is_synthetic)::int from public.lot_live_state where lot_id = '00000000-0000-4000-8000-000000000101'), 0, 'live state no longer flagged synthetic');

-- replay: same keys are ignored, count unchanged
select test_helpers.expect_eq((public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'webhook',
  '[{"occurred_at":"2026-11-20T10:00:00Z","direction":"entry","idempotency_key":"a1"},
    {"occurred_at":"2026-11-20T10:03:00Z","direction":"entry","idempotency_key":"a4"}]'::jsonb) ->> 'duplicates')::int, 1, 'replayed event is reported as a duplicate');
select test_helpers.expect_eq((select occupied from public.lot_live_state where lot_id = '00000000-0000-4000-8000-000000000101'), 102, 'only the new event counted');
select test_helpers.expect_eq((select count(*) from public.occupancy_events where lot_id = '00000000-0000-4000-8000-000000000101' and source = 'webhook'), 4, 'four distinct events stored');

-- the same key from a different source is a different event
select test_helpers.expect_eq((public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'fastag',
  '[{"occurred_at":"2026-11-20T10:00:00Z","direction":"exit","idempotency_key":"a1"}]'::jsonb) ->> 'inserted')::int, 1, 'idempotency is per source');

-- two-wheelers do not move the car count
select test_helpers.expect_eq((public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'webhook',
  '[{"occurred_at":"2026-11-20T11:00:00Z","direction":"entry","vehicle_class":"two_wheeler","idempotency_key":"b1"}]'::jsonb) ->> 'occupied')::int, 101, 'two-wheeler entry leaves the car count alone');

-- clamping at zero and at capacity is reported
update public.lot_live_state set occupied = 0 where lot_id = '00000000-0000-4000-8000-000000000101';
select test_helpers.expect_eq(((public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'webhook',
  '[{"occurred_at":"2026-11-20T12:00:00Z","direction":"exit","idempotency_key":"c1"}]'::jsonb) ->> 'clamped') = 'true')::int, 1, 'exit from empty is clamped and flagged');
select test_helpers.expect_eq((select occupied from public.lot_live_state where lot_id = '00000000-0000-4000-8000-000000000101'), 0, 'count never goes negative');

-- bad input
select test_helpers.expect_error($$select public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'webhook', '{"not":"array"}'::jsonb)$$, 'non-array payload rejected');
select test_helpers.expect_error($$select public.ingest_occupancy_events('00000000-0000-4000-8000-000000000101', 'webhook', '[{"occurred_at":"2026-11-20T12:00:00Z","direction":"sideways","idempotency_key":"z"}]'::jsonb)$$, 'bad direction rejected');
select test_helpers.expect_error($$select public.ingest_occupancy_events('00000000-0000-4000-8000-0000000009ff', 'webhook', '[]'::jsonb)$$, 'unknown lot rejected');

-- snapshots: absolute count, clamped to capacity, older snapshot does not overwrite newer live state
select test_helpers.expect_eq((public.ingest_occupancy_snapshot('00000000-0000-4000-8000-000000000101', 'csv', 50) ->> 'occupied')::int, 50, 'snapshot sets the live count');
select test_helpers.expect_eq(((public.ingest_occupancy_snapshot('00000000-0000-4000-8000-000000000101', 'csv', 999999) ->> 'clamped') = 'true')::int, 1, 'snapshot above capacity is clamped and flagged');
select public.ingest_occupancy_snapshot('00000000-0000-4000-8000-000000000101', 'csv', 7, now() - interval '1 hour');
select test_helpers.expect_eq((select (occupied = capacity)::int from public.lot_live_state where lot_id = '00000000-0000-4000-8000-000000000101'), 1, 'an older snapshot is stored but does not overwrite a newer live count');
select test_helpers.expect_eq((select count(*) from public.capacity_snapshots where lot_id = '00000000-0000-4000-8000-000000000101' and source = 'csv' and occupied = 7), 1, 'the older snapshot was still recorded');
reset role;

\echo FEED DB ASSERTIONS PASSED
