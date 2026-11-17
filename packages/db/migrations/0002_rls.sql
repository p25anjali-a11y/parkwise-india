-- 0002_rls.sql: helper functions, triggers, row level security and explicit grants.
-- "Automatically expose new tables" is OFF on the Supabase project, so every grant is explicit.
-- The service role (server-side code only) bypasses RLS but still needs table privileges.

-- ---------- helper functions (private schema, not exposed through the Data API) ----------
create or replace function private.current_role_name() returns public.user_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function private.current_org() returns uuid
language sql stable security definer set search_path = '' as $$
  select org_id from public.profiles where id = (select auth.uid())
$$;

create or replace function private.is_platform_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'platform_admin' from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function private.is_operator() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role in ('operator_admin', 'operator_staff') from public.profiles where id = (select auth.uid())), false)
$$;

create or replace function private.is_operator_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'operator_admin' from public.profiles where id = (select auth.uid())), false)
$$;

-- True when the lot belongs to the caller's organisation.
create or replace function private.lot_in_my_org(p_lot uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.lots l
    where l.id = p_lot and l.org_id = (select org_id from public.profiles where id = (select auth.uid()))
  )
$$;

create or replace function private.lot_is_public(p_lot uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.lots l where l.id = p_lot and l.status = 'approved')
$$;

grant usage on schema private to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;

-- ---------- triggers ----------
-- New auth user -> driver profile.
create or replace function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users cannot promote themselves or move organisations. Only platform admins and the service role can.
-- SECURITY INVOKER on purpose: current_user must be the calling role, not the function owner.
create or replace function private.guard_profile_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.role is distinct from old.role or new.org_id is distinct from old.org_id)
     and current_user not in ('postgres', 'service_role', 'supabase_admin')
     and not private.is_platform_admin() then
    raise exception 'role and organisation can only be changed by a platform admin';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.guard_profile_update();

-- Only platform admins (or the service role) may approve or suspend a lot, or change its tenant.
-- SECURITY INVOKER on purpose: current_user must be the calling role, not the function owner.
create or replace function private.guard_lot_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or private.is_platform_admin() then
    return new;
  end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'a lot cannot change organisation';
  end if;
  if new.status is distinct from old.status and new.status not in ('draft', 'pending_approval') then
    raise exception 'only a platform admin can set status %', new.status;
  end if;
  if old.status in ('approved', 'suspended') and new.status is distinct from old.status and new.status = 'draft' then
    raise exception 'an approved lot cannot return to draft';
  end if;
  return new;
end $$;

drop trigger if exists lots_guard on public.lots;
create trigger lots_guard before update on public.lots
  for each row execute function private.guard_lot_update();

-- price_quotes are an immutable record of what was shown.
create or replace function private.block_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% rows are immutable', tg_table_name;
end $$;

drop trigger if exists price_quotes_immutable on public.price_quotes;
create trigger price_quotes_immutable before update or delete on public.price_quotes
  for each row execute function private.block_mutation();

drop trigger if exists audit_log_immutable on public.audit_log;
create trigger audit_log_immutable before update or delete on public.audit_log
  for each row execute function private.block_mutation();

-- Optimistic concurrency and updated_at on reservations.
create or replace function private.touch_reservation() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  new.version = old.version + 1;
  return new;
end $$;

drop trigger if exists reservations_touch on public.reservations;
create trigger reservations_touch before update on public.reservations
  for each row execute function private.touch_reservation();

-- ---------- enable RLS on every table ----------
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.consents enable row level security;
alter table public.vehicles enable row level security;
alter table public.lots enable row level security;
alter table public.slot_types enable row level security;
alter table public.zones enable row level security;
alter table public.price_rules enable row level security;
alter table public.feed_endpoints enable row level security;
alter table public.capacity_snapshots enable row level security;
alter table public.occupancy_events enable row level security;
alter table public.lot_live_state enable row level security;
alter table public.demand_signals enable row level security;
alter table public.forecasts enable row level security;
alter table public.route_eta_cache enable row level security;
alter table public.calendar_days enable row level security;
alter table public.events enable row level security;
alter table public.data_source_health enable row level security;
alter table public.price_quotes enable row level security;
alter table public.reservations enable row level security;
alter table public.payments enable row level security;
alter table public.payouts enable row level security;
alter table public.audit_log enable row level security;

-- ---------- policies ----------
-- organizations
create policy org_select on public.organizations for select to authenticated
  using (id = private.current_org() or private.is_platform_admin());
create policy org_update on public.organizations for update to authenticated
  using ((id = private.current_org() and private.is_operator_admin()) or private.is_platform_admin());

-- profiles
create policy profiles_select_self on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_platform_admin()
         or (org_id is not null and org_id = private.current_org() and private.is_operator()));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid()) or private.is_platform_admin())
  with check (id = (select auth.uid()) or private.is_platform_admin());

-- consents and vehicles: own rows only
create policy consents_own on public.consents for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy vehicles_own on public.vehicles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- lots: public can see approved lots; operators see and manage their org's lots; platform admin sees all
create policy lots_public_select on public.lots for select to anon, authenticated
  using (status = 'approved');
create policy lots_org_select on public.lots for select to authenticated
  using (org_id = private.current_org() or private.is_platform_admin());
create policy lots_org_insert on public.lots for insert to authenticated
  with check (org_id = private.current_org() and private.is_operator_admin() and status in ('draft', 'pending_approval'));
create policy lots_org_update on public.lots for update to authenticated
  using (org_id = private.current_org() and private.is_operator_admin())
  with check (org_id = private.current_org());
create policy lots_admin_all on public.lots for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- slot_types: reference data
create policy slot_types_read on public.slot_types for select to anon, authenticated using (true);

-- zones: visible for approved lots; operators manage their own
create policy zones_public_select on public.zones for select to anon, authenticated
  using (private.lot_is_public(lot_id));
create policy zones_org_all on public.zones for all to authenticated
  using (private.lot_in_my_org(lot_id) and private.is_operator()) with check (private.lot_in_my_org(lot_id) and private.is_operator_admin());
create policy zones_admin_all on public.zones for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());

-- price_rules: operators only (drivers see quotes, not rules)
create policy rules_org_select on public.price_rules for select to authenticated
  using ((private.lot_in_my_org(lot_id) and private.is_operator()) or private.is_platform_admin());
create policy rules_org_write on public.price_rules for all to authenticated
  using (private.lot_in_my_org(lot_id) and private.is_operator_admin())
  with check (private.lot_in_my_org(lot_id) and private.is_operator_admin());

-- feed_endpoints: no policies for authenticated users. Service role only; secrets never leave the server.

-- capacity_snapshots and occupancy_events: operators read their own lots; writes via service role only
create policy snapshots_org_select on public.capacity_snapshots for select to authenticated
  using ((private.lot_in_my_org(lot_id) and private.is_operator()) or private.is_platform_admin());
create policy events_org_select on public.occupancy_events for select to authenticated
  using ((private.lot_in_my_org(lot_id) and private.is_operator()) or private.is_platform_admin());

-- lot_live_state: live counts are public for approved lots (Realtime publishes this table)
create policy live_public_select on public.lot_live_state for select to anon, authenticated
  using (private.lot_is_public(lot_id));
create policy live_org_select on public.lot_live_state for select to authenticated
  using ((private.lot_in_my_org(lot_id) and private.is_operator()) or private.is_platform_admin());

-- demand_signals and forecasts: public for approved lots
create policy signals_public_select on public.demand_signals for select to anon, authenticated
  using (lot_id is null or private.lot_is_public(lot_id));
create policy forecasts_public_select on public.forecasts for select to anon, authenticated
  using (private.lot_is_public(lot_id));

-- route_eta_cache: server only (no policies)

-- calendar and events: readable by everyone signed in; edited by platform admin, events also by operators for their lots
create policy calendar_read on public.calendar_days for select to anon, authenticated using (true);
create policy calendar_admin_write on public.calendar_days for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy events_read on public.events for select to anon, authenticated using (true);
create policy events_admin_write on public.events for all to authenticated
  using (private.is_platform_admin()) with check (private.is_platform_admin());
create policy events_operator_write on public.events for all to authenticated
  using (lot_id is not null and private.lot_in_my_org(lot_id) and private.is_operator_admin())
  with check (lot_id is not null and private.lot_in_my_org(lot_id) and private.is_operator_admin());

-- data_source_health: platform admin only
create policy health_admin_select on public.data_source_health for select to authenticated
  using (private.is_platform_admin());

-- price_quotes: the driver who got the quote, the lot's operators, platform admin. Inserts via service role.
create policy quotes_select on public.price_quotes for select to authenticated
  using (user_id = (select auth.uid())
         or (private.lot_in_my_org(lot_id) and private.is_operator())
         or private.is_platform_admin());

-- reservations: drivers see their own; operators see their lots'. Writes via service role (concurrency-safe functions).
create policy reservations_select on public.reservations for select to authenticated
  using (user_id = (select auth.uid())
         or (private.lot_in_my_org(lot_id) and private.is_operator())
         or private.is_platform_admin());

-- payments
create policy payments_select on public.payments for select to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.reservations r
                    where r.id = reservation_id and private.lot_in_my_org(r.lot_id) and private.is_operator_admin())
         or private.is_platform_admin());

-- payouts
create policy payouts_select on public.payouts for select to authenticated
  using ((org_id = private.current_org() and private.is_operator_admin()) or private.is_platform_admin());

-- audit_log
create policy audit_select on public.audit_log for select to authenticated
  using ((org_id is not null and org_id = private.current_org() and private.is_operator_admin()) or private.is_platform_admin());

-- ---------- grants ----------
-- Read access where a policy allows it; writes only where a policy allows them. service_role gets everything.
grant select on public.slot_types, public.lots, public.zones, public.lot_live_state, public.demand_signals,
  public.forecasts, public.calendar_days, public.events to anon;
grant select on public.organizations, public.profiles, public.consents, public.vehicles, public.lots, public.slot_types,
  public.zones, public.price_rules, public.capacity_snapshots, public.occupancy_events, public.lot_live_state,
  public.demand_signals, public.forecasts, public.calendar_days, public.events, public.data_source_health,
  public.price_quotes, public.reservations, public.payments, public.payouts, public.audit_log to authenticated;
grant insert, update on public.lots to authenticated;
grant insert, update, delete on public.zones, public.price_rules, public.events, public.calendar_days to authenticated;
grant update on public.organizations, public.profiles to authenticated;
grant insert, update, delete on public.consents, public.vehicles to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- realtime: publish live counts ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.lot_live_state;
  end if;
end $$;
