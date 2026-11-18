-- 0007: onboard real lots with provenance, and let the first occupancy snapshot create a lot's live state.
-- Nothing here invents a count: a lot has no live state (and shows "No live availability") until real data arrives.

alter table public.lots add column if not exists data_source text;
alter table public.lots add column if not exists data_as_of date;

-- Creates org (if new), lot, car zone and default price rule in one transaction. Server (service_role) only.
create or replace function public.import_lot(p jsonb) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_org uuid; v_lot uuid; v_car smallint;
  v_name text := btrim(p ->> 'name'); v_city text := p ->> 'city';
begin
  if v_name is null or v_name = '' or v_city is null then raise exception 'name and city are required'; end if;
  if coalesce(p ->> 'data_source', '') = '' or (p ->> 'data_as_of') is null then raise exception 'data_source and data_as_of are required'; end if;
  if exists (select 1 from public.lots where lower(name) = lower(v_name) and city = v_city) then
    raise exception 'lot already exists: % (%)', v_name, v_city using errcode = '23505';
  end if;
  select id into v_car from public.slot_types where code = 'car';

  select id into v_org from public.organizations where lower(name) = lower(p ->> 'operator') and city = v_city and not is_synthetic limit 1;
  if v_org is null then
    insert into public.organizations (name, city) values (p ->> 'operator', v_city) returning id into v_org;
  end if;

  insert into public.lots (org_id, name, city, address, category, lat, lng, status, feed_source, municipal_cap_per_hour_paise, data_source, data_as_of)
  values (v_org, v_name, v_city, p ->> 'address', p ->> 'category', (p ->> 'lat')::double precision, (p ->> 'lng')::double precision,
          'approved', 'manual', nullif(p ->> 'municipal_cap_paise', '')::integer, p ->> 'data_source', (p ->> 'data_as_of')::date)
  returning id into v_lot;

  insert into public.zones (lot_id, slot_type_id, name, capacity) values (v_lot, v_car, 'Cars', (p ->> 'car_capacity')::integer);
  insert into public.price_rules (lot_id, name, rules)
  values (v_lot, 'Default', jsonb_strip_nulls(jsonb_build_object(
    'baseRatePerHour', (p ->> 'base_rate_paise')::integer,
    'municipalCapPerHour', nullif(p ->> 'municipal_cap_paise', '')::integer)));
  return v_lot;
end $$;
revoke all on function public.import_lot(jsonb) from public, anon, authenticated;
grant execute on function public.import_lot(jsonb) to service_role;

-- Snapshot ingestion now creates the live state on a lot's first real count (capacity = its car zones).
create or replace function public.ingest_occupancy_snapshot(p_lot uuid, p_source public.feed_source, p_occupied integer, p_captured_at timestamptz default now())
returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s public.lot_live_state; new_occ integer; cap integer;
begin
  select * into s from public.lot_live_state where lot_id = p_lot for update;
  if not found then
    select coalesce(sum(z.capacity), 0) into cap from public.zones z join public.slot_types t on t.id = z.slot_type_id
      where z.lot_id = p_lot and t.code = 'car' and not z.closed;
    if cap = 0 then raise exception 'lot has no car zone' using errcode = 'P0002'; end if;
    insert into public.lot_live_state (lot_id, occupied, capacity, updated_at, source, is_synthetic)
      values (p_lot, least(cap, greatest(0, p_occupied)), cap, least(p_captured_at, now()), p_source, false)
      returning * into s;
  end if;
  new_occ := least(s.capacity, greatest(0, p_occupied));
  insert into public.capacity_snapshots (lot_id, captured_at, occupied, capacity, source, is_synthetic) values (p_lot, p_captured_at, new_occ, s.capacity, p_source, false);
  if p_captured_at >= s.updated_at or s.is_synthetic then
    update public.lot_live_state set occupied = new_occ, updated_at = least(p_captured_at, now()), source = p_source, is_synthetic = false where lot_id = p_lot;
    update public.lots set last_feed_at = now(), feed_source = p_source where id = p_lot;
  end if;
  return jsonb_build_object('occupied', new_occ, 'clamped', new_occ <> p_occupied);
end $$;
revoke all on function public.ingest_occupancy_snapshot(uuid, public.feed_source, integer, timestamptz) from public, anon, authenticated;
grant execute on function public.ingest_occupancy_snapshot(uuid, public.feed_source, integer, timestamptz) to service_role;
