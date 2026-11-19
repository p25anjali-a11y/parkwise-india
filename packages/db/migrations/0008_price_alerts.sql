-- 0008: driver price alerts. A driver names a lot and a price per hour; the app shows the alert as "reached"
-- when the current price is at or below it. No push or email yet. Saved cars use the existing public.vehicles table.
create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lot_id uuid not null references public.lots (id) on delete cascade,
  target_rate_paise integer not null check (target_rate_paise > 0),
  created_at timestamptz not null default now(),
  unique (user_id, lot_id)
);
alter table public.price_alerts enable row level security;
create policy price_alerts_own on public.price_alerts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.price_alerts to authenticated;
