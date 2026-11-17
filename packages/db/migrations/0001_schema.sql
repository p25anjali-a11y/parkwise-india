-- 0001_schema.sql: core tables, enums, indexes. Money is integer paise.
-- Lines tagged "-- @postgis" need PostGIS; the local test harness strips them when PostGIS is absent.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists postgis with schema extensions; -- @postgis

create schema if not exists private;

-- ---------- enums ----------
create type public.user_role as enum ('driver', 'operator_admin', 'operator_staff', 'platform_admin');
create type public.vehicle_class as enum ('car', 'two_wheeler', 'ev', 'accessible');
create type public.lot_status as enum ('draft', 'pending_approval', 'approved', 'suspended');
create type public.reservation_status as enum ('held', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled', 'expired');
create type public.occupancy_direction as enum ('entry', 'exit');
create type public.feed_source as enum ('webhook', 'csv', 'fastag', 'vendor', 'external_availability', 'manual', 'synthetic');
create type public.payment_status as enum ('created', 'authorized', 'captured', 'failed', 'refunded');
create type public.signal_kind as enum ('congestion', 'rain_prob', 'incident', 'event', 'holiday', 'festival');

-- ---------- tenants and users ----------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'driver',
  org_id uuid references public.organizations (id) on delete set null,
  display_name text,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'hi', 'gu', 'mr')),
  created_at timestamptz not null default now(),
  constraint operator_needs_org check (role not in ('operator_admin', 'operator_staff') or org_id is not null)
);

-- DPDP: record each consent purpose, with withdrawal.
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  purpose text not null check (purpose in ('location', 'notifications', 'analytics')),
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz
);
create index consents_user_idx on public.consents (user_id, purpose);

-- Vehicle numbers are never stored in clear: only a keyed hash plus the last 4 characters for display.
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plate_hash text not null,
  plate_last4 text not null check (char_length(plate_last4) = 4),
  label text,
  vehicle_class public.vehicle_class not null default 'car',
  created_at timestamptz not null default now(),
  unique (user_id, plate_hash)
);

-- ---------- supply ----------
create table public.lots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null,
  city text not null,
  address text,
  category text not null check (category in ('mall', 'office', 'stadium', 'hospital', 'airport', 'hotel', 'municipal', 'other')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  geog extensions.geography (Point, 4326) generated always as (extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography) stored, -- @postgis
  status public.lot_status not null default 'draft',
  timezone text not null default 'Asia/Kolkata',
  opening_hours jsonb,
  feed_source public.feed_source not null default 'manual',
  last_feed_at timestamptz,
  municipal_cap_per_hour_paise integer check (municipal_cap_per_hour_paise > 0),
  is_synthetic boolean not null default false,
  created_at timestamptz not null default now()
);
create index lots_geog_idx on public.lots using gist (geog); -- @postgis
create index lots_city_status_idx on public.lots (city, status);
create index lots_org_idx on public.lots (org_id);

create table public.slot_types (
  id smallint generated always as identity primary key,
  code public.vehicle_class not null unique,
  label text not null
);
insert into public.slot_types (code, label) values
  ('car', 'Car'), ('two_wheeler', 'Two-wheeler'), ('ev', 'EV bay'), ('accessible', 'Accessible bay');

create table public.zones (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  slot_type_id smallint not null references public.slot_types (id),
  name text not null,
  level text,
  capacity integer not null check (capacity > 0),
  -- Share of slots sellable in advance; the rest stay for walk-ins.
  reservable_pct numeric(4, 3) not null default 0.2 check (reservable_pct between 0 and 1),
  -- Slots currently sold in advance. The check below is the last line of defence against double-selling.
  reserved_count integer not null default 0,
  inventory_version integer not null default 0,
  closed boolean not null default false,
  constraint reserved_within_quota check (reserved_count >= 0 and reserved_count <= floor(capacity * reservable_pct))
);
create index zones_lot_idx on public.zones (lot_id);

create table public.price_rules (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  zone_id uuid references public.zones (id) on delete cascade,
  name text not null,
  active boolean not null default true,
  -- Shape of packages/pricing PricingRules
  rules jsonb not null,
  version integer not null default 1,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index price_rules_lot_idx on public.price_rules (lot_id) where active;

-- Webhook credentials. secret_ciphertext is encrypted by the app; never exposed through RLS.
create table public.feed_endpoints (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots (id) on delete cascade,
  secret_ciphertext text not null,
  secret_prefix text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
create index feed_endpoints_lot_idx on public.feed_endpoints (lot_id);

-- ---------- occupancy and live state ----------
create table public.capacity_snapshots (
  id bigint generated always as identity primary key,
  lot_id uuid not null references public.lots (id) on delete cascade,
  zone_id uuid references public.zones (id) on delete cascade,
  captured_at timestamptz not null,
  occupied integer not null check (occupied >= 0),
  capacity integer not null check (capacity > 0),
  source public.feed_source not null,
  is_synthetic boolean not null default false
);
create index capacity_snapshots_lot_time_idx on public.capacity_snapshots (lot_id, captured_at desc);

create table public.occupancy_events (
  id bigint generated always as identity primary key,
  lot_id uuid not null references public.lots (id) on delete cascade,
  zone_id uuid references public.zones (id) on delete set null,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  direction public.occupancy_direction not null,
  vehicle_class public.vehicle_class not null default 'car',
  vehicle_hash text,
  source public.feed_source not null,
  idempotency_key text not null,
  raw jsonb,
  is_synthetic boolean not null default false,
  unique (lot_id, source, idempotency_key)
);
create index occupancy_events_lot_time_idx on public.occupancy_events (lot_id, occurred_at desc);

-- Latest count per lot, updated by ingestion; this is the table Realtime publishes.
create table public.lot_live_state (
  lot_id uuid primary key references public.lots (id) on delete cascade,
  occupied integer not null check (occupied >= 0),
  capacity integer not null check (capacity > 0),
  updated_at timestamptz not null default now(),
  source public.feed_source not null,
  is_synthetic boolean not null default false
);

-- ---------- signals, forecasts, ETA cache ----------
create table public.demand_signals (
  id bigint generated always as identity primary key,
  lot_id uuid references public.lots (id) on delete cascade,
  city text,
  kind public.signal_kind not null,
  value numeric not null,
  valid_at timestamptz not null,
  source text not null,
  is_mock boolean not null default true,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);
create index demand_signals_lot_kind_idx on public.demand_signals (lot_id, kind, valid_at desc);
create index demand_signals_city_kind_idx on public.demand_signals (city, kind, valid_at desc);

create table public.forecasts (
  id bigint generated always as identity primary key,
  lot_id uuid not null references public.lots (id) on delete cascade,
  target_time timestamptz not null,
  p10 integer not null,
  p50 integer not null,
  p90 integer not null,
  p_full numeric(5, 4) not null check (p_full between 0 and 1),
  model_version text not null,
  stale boolean not null default false,
  cold_start boolean not null default false,
  generated_at timestamptz not null default now(),
  check (p10 <= p50 and p50 <= p90),
  unique (lot_id, target_time, model_version)
);
create index forecasts_lot_target_idx on public.forecasts (lot_id, target_time);

create table public.route_eta_cache (
  cache_key text primary key,
  provider text not null,
  origin_cell text not null,
  dest_lot_id uuid references public.lots (id) on delete cascade,
  time_bucket timestamptz not null,
  duration_s integer not null,
  distance_m integer,
  approximate boolean not null default false,
  is_mock boolean not null default false,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index route_eta_cache_expiry_idx on public.route_eta_cache (expires_at);

-- ---------- calendar and events (editable in admin UI) ----------
create table public.calendar_days (
  id uuid primary key default gen_random_uuid(),
  starts_on date not null,
  ends_on date not null,
  name text not null,
  kind text not null check (kind in ('holiday', 'festival', 'school_holiday', 'match')),
  state text,
  weight numeric(3, 2) not null default 1 check (weight between 0 and 1),
  is_synthetic boolean not null default false,
  created_by uuid references auth.users (id),
  check (ends_on >= starts_on)
);
create index calendar_days_range_idx on public.calendar_days (starts_on, ends_on);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.lots (id) on delete cascade,
  city text not null,
  name text not null,
  venue text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  expected_attendance integer,
  impact numeric(3, 2) not null default 0.5 check (impact between 0 and 1),
  source text not null default 'manual',
  is_synthetic boolean not null default false,
  created_by uuid references auth.users (id),
  check (ends_at > starts_at)
);
create index events_time_idx on public.events (city, starts_at);

create table public.data_source_health (
  source text primary key,
  kind text not null,
  is_mock boolean not null default true,
  last_success_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  success_count bigint not null default 0,
  error_count bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------- bookings and money ----------
-- Immutable: records the price shown. Locking is recorded on the reservation that references it.
create table public.price_quotes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  lot_id uuid not null references public.lots (id) on delete cascade,
  zone_id uuid not null references public.zones (id) on delete cascade,
  arrival_at timestamptz not null,
  duration_min integer not null check (duration_min > 0),
  predicted_occupancy numeric(5, 4) not null,
  multiplier numeric(5, 2) not null,
  rate_per_hour_paise integer not null,
  total_paise integer not null,
  breakdown jsonb not null,
  model_version text,
  created_at timestamptz not null default now()
);
create index price_quotes_user_idx on public.price_quotes (user_id, created_at desc);
create index price_quotes_lot_idx on public.price_quotes (lot_id, created_at desc);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete restrict,
  lot_id uuid not null references public.lots (id) on delete restrict,
  zone_id uuid not null references public.zones (id) on delete restrict,
  quote_id uuid not null references public.price_quotes (id),
  vehicle_id uuid references public.vehicles (id) on delete set null,
  status public.reservation_status not null default 'held',
  arrival_at timestamptz not null,
  duration_min integer not null check (duration_min > 0),
  hold_expires_at timestamptz not null,
  checked_in_at timestamptz,
  completed_at timestamptz,
  total_paise integer not null check (total_paise >= 0),
  version integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reservations_user_idx on public.reservations (user_id, created_at desc);
create index reservations_lot_status_idx on public.reservations (lot_id, status);
create index reservations_held_expiry_idx on public.reservations (hold_expires_at) where status = 'held';

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.reservations (id) on delete restrict,
  user_id uuid not null references auth.users (id) on delete restrict,
  provider text not null,
  provider_order_id text,
  provider_payment_id text,
  amount_paise integer not null check (amount_paise >= 0),
  status public.payment_status not null default 'created',
  method text,
  is_test boolean not null default true,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_reservation_idx on public.payments (reservation_id);
create unique index payments_provider_payment_uidx on public.payments (provider, provider_payment_id) where provider_payment_id is not null;

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  gross_paise bigint not null,
  platform_fee_paise bigint not null,
  net_paise bigint not null,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  created_at timestamptz not null default now(),
  unique (org_id, period_start, period_end)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  org_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_log_org_time_idx on public.audit_log (org_id, created_at desc);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
