-- 0005_feed_ingest.sql: atomic, idempotent occupancy ingestion. service_role only.

-- Applies a batch of entry/exit events. Duplicate (lot, source, idempotency_key) events are ignored.
-- Only car events move lot_live_state (it tracks car capacity). The count is clamped to 0..capacity and the clamp is reported.
create or replace function public.ingest_occupancy_events(p_lot uuid, p_source public.feed_source, p_events jsonb)
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  s public.lot_live_state;
  n_in integer; n_out integer; n_new integer; n_total integer;
  raw_occ integer; new_occ integer;
begin
  if jsonb_typeof(p_events) <> 'array' or jsonb_array_length(p_events) > 1000 then
    raise exception 'events must be an array of at most 1000' using errcode = 'P0001';
  end if;
  select * into s from public.lot_live_state where lot_id = p_lot for update;
  if not found then raise exception 'lot has no live state' using errcode = 'P0002'; end if;
  n_total := jsonb_array_length(p_events);

  with e as (
    select * from jsonb_to_recordset(p_events) as x(occurred_at timestamptz, direction public.occupancy_direction, vehicle_class public.vehicle_class, idempotency_key text, vehicle_hash text, zone_id uuid)
  ), ins as (
    insert into public.occupancy_events (lot_id, zone_id, occurred_at, direction, vehicle_class, vehicle_hash, source, idempotency_key)
    select p_lot, zone_id, occurred_at, direction, coalesce(vehicle_class, 'car'), vehicle_hash, p_source, idempotency_key from e
    on conflict (lot_id, source, idempotency_key) do nothing
    returning direction, vehicle_class
  )
  select count(*) filter (where direction = 'entry' and vehicle_class = 'car'),
         count(*) filter (where direction = 'exit' and vehicle_class = 'car'),
         count(*)
  into n_in, n_out, n_new from ins;

  raw_occ := s.occupied + n_in - n_out;
  new_occ := least(s.capacity, greatest(0, raw_occ));
  update public.lot_live_state set occupied = new_occ, updated_at = now(), source = p_source, is_synthetic = false where lot_id = p_lot;
  update public.lots set last_feed_at = now(), feed_source = p_source where id = p_lot;
  return jsonb_build_object('received', n_total, 'inserted', n_new, 'duplicates', n_total - n_new, 'occupied', new_occ, 'clamped', raw_occ <> new_occ);
end $$;

-- Absolute count from a snapshot-style feed (CSV, external availability). Also stores a capacity snapshot.
create or replace function public.ingest_occupancy_snapshot(p_lot uuid, p_source public.feed_source, p_occupied integer, p_captured_at timestamptz default now())
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.lot_live_state; new_occ integer;
begin
  select * into s from public.lot_live_state where lot_id = p_lot for update;
  if not found then raise exception 'lot has no live state' using errcode = 'P0002'; end if;
  new_occ := least(s.capacity, greatest(0, p_occupied));
  insert into public.capacity_snapshots (lot_id, captured_at, occupied, capacity, source, is_synthetic) values (p_lot, p_captured_at, new_occ, s.capacity, p_source, false);
  -- Only move the live state forward in time; a late-arriving old snapshot is stored but does not overwrite a newer count.
  if p_captured_at >= s.updated_at or s.is_synthetic then
    update public.lot_live_state set occupied = new_occ, updated_at = least(p_captured_at, now()), source = p_source, is_synthetic = false where lot_id = p_lot;
    update public.lots set last_feed_at = now(), feed_source = p_source where id = p_lot;
  end if;
  return jsonb_build_object('occupied', new_occ, 'clamped', new_occ <> p_occupied);
end $$;

revoke all on function public.ingest_occupancy_events(uuid, public.feed_source, jsonb) from public, anon, authenticated;
revoke all on function public.ingest_occupancy_snapshot(uuid, public.feed_source, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.ingest_occupancy_events(uuid, public.feed_source, jsonb) to service_role;
grant execute on function public.ingest_occupancy_snapshot(uuid, public.feed_source, integer, timestamptz) to service_role;
