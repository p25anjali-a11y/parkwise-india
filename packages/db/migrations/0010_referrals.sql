-- 0010: referrals and a wallet ledger. A driver has one code. A friend who signs up with it and completes a first
-- confirmed booking earns both sides a credit. Credits are recorded in an append-only ledger in integer paise.
-- Spending credit at checkout is NOT built yet; the ledger only records and shows balances.
-- All writes go through the functions below (service_role only), never from the browser.
create table public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9]{6,10}$'),
  created_at timestamptz not null default now()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  code text not null,
  status text not null default 'signed_up' check (status in ('signed_up', 'rewarded')),
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (referrer_id <> referred_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id, created_at desc);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount_paise integer not null check (amount_paise <> 0),
  reason text not null check (reason in ('referral_given', 'referral_received', 'adjustment')),
  referral_id uuid references public.referrals (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (referral_id, user_id)
);
create index wallet_ledger_user_idx on public.wallet_ledger (user_id, created_at desc);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.wallet_ledger enable row level security;
create policy referral_codes_own on public.referral_codes for select to authenticated using (user_id = (select auth.uid()));
create policy referrals_own on public.referrals for select to authenticated
  using (referrer_id = (select auth.uid()) or referred_id = (select auth.uid()));
create policy wallet_ledger_own on public.wallet_ledger for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.referral_codes, public.referrals, public.wallet_ledger from anon, authenticated;
grant select on public.referral_codes, public.referrals, public.wallet_ledger to authenticated;
grant all on public.referral_codes, public.referrals, public.wallet_ledger to service_role;

-- One stable code per user. Collisions retry with a fresh random code.
create or replace function public.get_or_create_referral_code(p_user uuid)
returns text language plpgsql security invoker set search_path = '' as $$
declare v text; i integer := 0;
begin
  select code into v from public.referral_codes where user_id = p_user;
  if v is not null then return v; end if;
  loop
    v := upper(substr(md5(random()::text || clock_timestamp()::text || p_user::text), 1, 8));
    begin
      insert into public.referral_codes (user_id, code) values (p_user, v) on conflict (user_id) do nothing;
      select code into v from public.referral_codes where user_id = p_user;
      return v;
    exception when unique_violation then
      i := i + 1;
      if i > 5 then raise; end if;
    end;
  end loop;
end $$;

-- A new user claims someone's code. Returns ok, invalid, self, already or late (the user already has a confirmed booking).
create or replace function public.claim_referral(p_referred uuid, p_code text)
returns text language plpgsql security invoker set search_path = '' as $$
declare v_referrer uuid;
begin
  select user_id into v_referrer from public.referral_codes where code = upper(trim(p_code));
  if v_referrer is null then return 'invalid'; end if;
  if v_referrer = p_referred then return 'self'; end if;
  if exists (select 1 from public.referrals where referred_id = p_referred) then return 'already'; end if;
  if exists (select 1 from public.reservations where user_id = p_referred and status in ('confirmed', 'checked_in', 'completed')) then return 'late'; end if;
  insert into public.referrals (referrer_id, referred_id, code) values (v_referrer, p_referred, upper(trim(p_code)));
  return 'ok';
end $$;

-- Called after a payment confirms. Rewards both sides once, when the booking is confirmed and big enough. Returns rewarded or none.
create or replace function public.reward_referral(p_reservation uuid, p_give_paise integer, p_get_paise integer, p_min_paise integer)
returns text language plpgsql security invoker set search_path = '' as $$
declare r record; ref record;
begin
  select user_id, status, total_paise into r from public.reservations where id = p_reservation;
  if not found or r.status not in ('confirmed', 'checked_in', 'completed') or r.total_paise < p_min_paise then return 'none'; end if;
  update public.referrals set status = 'rewarded', rewarded_at = now()
    where referred_id = r.user_id and status = 'signed_up' returning id, referrer_id, referred_id into ref;
  if ref.id is null then return 'none'; end if;
  insert into public.wallet_ledger (user_id, amount_paise, reason, referral_id) values
    (ref.referrer_id, p_give_paise, 'referral_given', ref.id),
    (ref.referred_id, p_get_paise, 'referral_received', ref.id);
  return 'rewarded';
end $$;

revoke all on function public.get_or_create_referral_code(uuid) from public, anon, authenticated;
revoke all on function public.claim_referral(uuid, text) from public, anon, authenticated;
revoke all on function public.reward_referral(uuid, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.get_or_create_referral_code(uuid) to service_role;
grant execute on function public.claim_referral(uuid, text) to service_role;
grant execute on function public.reward_referral(uuid, integer, integer, integer) to service_role;
