-- 0009: find-my-car pin, wait-list for full lots, valet requests. EV bays reuse the existing 'ev' slot type (zones).
create table public.car_pins (
  reservation_id uuid primary key references public.reservations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  note text check (char_length(note) <= 200),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  updated_at timestamptz not null default now()
);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  lot_id uuid not null references public.lots (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, lot_id)
);

create type public.valet_status as enum ('requested', 'accepted', 'done');
create table public.valet_requests (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null unique references public.reservations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  lot_id uuid not null references public.lots (id) on delete cascade,
  note text check (char_length(note) <= 200),
  status public.valet_status not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index valet_requests_lot_idx on public.valet_requests (lot_id, status);

alter table public.car_pins enable row level security;
alter table public.waitlist enable row level security;
alter table public.valet_requests enable row level security;

create policy car_pins_own on public.car_pins for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy waitlist_own on public.waitlist for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- operators see how many people wait for their lots
create policy waitlist_operator_select on public.waitlist for select to authenticated
  using (private.lot_in_my_org(lot_id));

create policy valet_driver_select on public.valet_requests for select to authenticated using (user_id = (select auth.uid()));
create policy valet_driver_insert on public.valet_requests for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'requested'
    and exists (select 1 from public.reservations r where r.id = reservation_id and r.user_id = (select auth.uid()) and r.lot_id = valet_requests.lot_id and r.status = 'confirmed'));
create policy valet_driver_cancel on public.valet_requests for delete to authenticated
  using (user_id = (select auth.uid()) and status = 'requested');
create policy valet_operator_select on public.valet_requests for select to authenticated using (private.lot_in_my_org(lot_id));
create policy valet_operator_update on public.valet_requests for update to authenticated
  using (private.lot_in_my_org(lot_id)) with check (private.lot_in_my_org(lot_id));

grant select, insert, update, delete on public.car_pins, public.waitlist to authenticated;
grant select, insert, delete on public.valet_requests to authenticated;
grant update (status, updated_at) on public.valet_requests to authenticated;
