-- 0004_reservation_functions.sql: concurrency-safe reservation, hold-expiry and payment-confirmation functions.
-- These are callable ONLY by service_role (the Next.js server), never by anon or authenticated clients.

create or replace function public.create_hold(p_user uuid, p_quote_id uuid, p_hold_minutes integer default 15)
returns public.reservations
language plpgsql security invoker set search_path = '' as $$
declare
  q public.price_quotes;
  z public.zones;
  r public.reservations;
begin
  -- Release lapsed holds first so their bays count as free (hold lifetime is minutes; crons are not that frequent).
  perform public.expire_holds();

  select * into q from public.price_quotes where id = p_quote_id;
  if not found then raise exception 'quote not found' using errcode = 'P0002'; end if;
  if q.user_id is distinct from p_user then raise exception 'quote does not belong to this user' using errcode = '42501'; end if;
  if q.created_at < now() - interval '15 minutes' then raise exception 'quote expired, request a new price' using errcode = 'P0001'; end if;
  if q.arrival_at + make_interval(mins => q.duration_min) < now() then raise exception 'stay window already over' using errcode = 'P0001'; end if;

  -- Serialise on the zone row so two drivers cannot take the last reservable bay.
  select * into z from public.zones where id = q.zone_id for update;
  if z.closed then raise exception 'zone closed' using errcode = 'P0001'; end if;
  if exists (select 1 from public.reservations where quote_id = p_quote_id and status in ('held', 'confirmed')) then
    raise exception 'quote already reserved' using errcode = '23505';
  end if;

  -- The reserved_within_quota check constraint rejects this when no reservable bay is left (sqlstate 23514).
  update public.zones set reserved_count = reserved_count + 1, inventory_version = inventory_version + 1 where id = z.id;

  insert into public.reservations (user_id, lot_id, zone_id, quote_id, status, arrival_at, duration_min, hold_expires_at, total_paise)
  values (p_user, q.lot_id, q.zone_id, q.id, 'held', q.arrival_at, q.duration_min, now() + make_interval(mins => p_hold_minutes), q.total_paise)
  returning * into r;
  return r;
end $$;

create or replace function public.expire_holds()
returns integer
language plpgsql security invoker set search_path = '' as $$
declare n integer;
begin
  with ex as (
    update public.reservations set status = 'expired'
    where status = 'held' and hold_expires_at < now()
    returning zone_id
  ), agg as (
    select zone_id, count(*)::integer as c from ex group by zone_id
  ), upd as (
    update public.zones z set reserved_count = greatest(0, z.reserved_count - agg.c), inventory_version = z.inventory_version + 1
    from agg where z.id = agg.zone_id
    returning agg.c
  )
  select coalesce(sum(c), 0)::integer into n from upd;
  return n;
end $$;

-- Returns: confirmed | already | refund_needed | not_found
create or replace function public.confirm_payment(
  p_reservation uuid, p_provider text, p_order_id text, p_payment_id text, p_amount_paise integer,
  p_method text, p_is_test boolean, p_raw jsonb default null)
returns text
language plpgsql security invoker set search_path = '' as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_reservation for update;
  if not found then return 'not_found'; end if;

  if p_payment_id is not null and exists (select 1 from public.payments where provider = p_provider and provider_payment_id = p_payment_id) then
    return 'already';
  end if;

  insert into public.payments (reservation_id, user_id, provider, provider_order_id, provider_payment_id, amount_paise, status, method, is_test, raw)
  values (r.id, r.user_id, p_provider, p_order_id, p_payment_id, p_amount_paise, 'captured', p_method, p_is_test, p_raw);

  if r.status = 'confirmed' then return 'already'; end if;
  if r.status = 'held' and r.hold_expires_at >= now() and p_amount_paise = r.total_paise then
    update public.reservations set status = 'confirmed' where id = r.id;
    return 'confirmed';
  end if;
  -- Paid after the hold lapsed, or the amount differs: money is captured but no space is promised. Needs a refund.
  return 'refund_needed';
end $$;

create or replace function public.cancel_reservation(p_user uuid, p_reservation uuid)
returns text
language plpgsql security invoker set search_path = '' as $$
declare r public.reservations;
begin
  select * into r from public.reservations where id = p_reservation and user_id = p_user for update;
  if not found then return 'not_found'; end if;
  if r.status not in ('held', 'confirmed') then return 'not_cancellable'; end if;
  update public.reservations set status = 'cancelled' where id = r.id;
  update public.zones set reserved_count = greatest(0, reserved_count - 1), inventory_version = inventory_version + 1 where id = r.zone_id;
  return 'cancelled';
end $$;

revoke all on function public.create_hold(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.expire_holds() from public, anon, authenticated;
revoke all on function public.confirm_payment(uuid, text, text, text, integer, text, boolean, jsonb) from public, anon, authenticated;
revoke all on function public.cancel_reservation(uuid, uuid) from public, anon, authenticated;
grant execute on function public.create_hold(uuid, uuid, integer) to service_role;
grant execute on function public.expire_holds() to service_role;
grant execute on function public.confirm_payment(uuid, text, text, text, integer, text, boolean, jsonb) to service_role;
grant execute on function public.cancel_reservation(uuid, uuid) to service_role;
