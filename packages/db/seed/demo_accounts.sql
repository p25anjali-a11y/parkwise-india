-- DEMO ACCOUNTS (not a migration; run by hand in the Supabase SQL editor, after migrations through 0011 and seed/real_places.sql).
-- Gives you something to log in with:
--   mumbai.operator@parkwise.example     operator (verified), owns Phoenix Marketcity, Kurla + a second deck
--   ahmedabad.operator@parkwise.example  operator (verified), owns Alpha One Mall, Vastrapur + a second deck
--   driver@parkwise.example              driver
--   p25anjali@iima.ac.in                 operator (verified) of a demo business that owns Inorbit Mall, Malad (Mumbai)
--                                        and Acropolis Mall, Thaltej (Ahmedabad) plus a deck at each; ALSO has a driver view.
--                                        The account is created if missing, and its password is SET to the demo password.
-- All four use the password  ParkDemo#2026  . CHANGE IT or delete these users before any real launch.
-- What is real and what is not: the malls are real places at approximate positions; the businesses, GSTINs and people
-- here are FAKE (the GSTINs have a valid format and checksum but do not belong to anyone). Capacity and rates are
-- estimates, occupancy is SIMULATED on read and labelled everywhere, and no bookings or revenue are created here:
-- book as the driver and the operator sees it. Safe to run more than once. Undo with seed/remove_demo_accounts.sql.
set app.allow_synthetic = 'on';
create extension if not exists pgcrypto with schema extensions;

do $$
declare
  v_car smallint;
  r record; v_uid uuid; v_org uuid; v_lot uuid; x record;
begin
  select id into v_car from public.slot_types where code = 'car';

  -- 1) the three users
  for r in select * from (values
    ('mumbai.operator@parkwise.example',    'Mumbai demo operator',    'operator'),
    ('ahmedabad.operator@parkwise.example', 'Ahmedabad demo operator', 'operator'),
    ('driver@parkwise.example',             'Demo driver',             'driver'),
    ('p25anjali@iima.ac.in',                'Anjali (demo)',           'driver')
  ) as t(email, name, kind)
  loop
    select id into v_uid from auth.users where email = r.email;
    if v_uid is null then
      v_uid := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                              created_at, updated_at, confirmation_token, recovery_token, email_change, email_change_token_new)
      values ('00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', r.email,
              extensions.crypt('ParkDemo#2026', extensions.gen_salt('bf')), now(),
              '{"provider":"email","providers":["email"]}'::jsonb,
              jsonb_build_object('display_name', r.name, 'account_type', r.kind), now(), now(), '', '', '', '');
      insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_uid, jsonb_build_object('sub', v_uid::text, 'email', r.email), 'email', v_uid::text, now(), now(), now());
    elsif r.email = 'p25anjali@iima.ac.in' then
      -- the demo owner's account already exists: make it log in with the demo password and skip email confirmation
      update auth.users set encrypted_password = extensions.crypt('ParkDemo#2026', extensions.gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()) where id = v_uid;
    end if;
  end loop;

  -- 2) two verified demo businesses, each owning real-place lots
  for x in select * from (values
    ('mumbai.operator@parkwise.example',    'Phoenix Marketcity Parking (Demo operator)', 'Mumbai',    '27AAACP1234C1Z1', 'Phoenix Marketcity, Kurla',
       'Phoenix Marketcity, Kurla: West Deck',    19.0861, 72.8885, 600, 7000),
    ('ahmedabad.operator@parkwise.example', 'Alpha One Parking (Demo operator)',         'Ahmedabad', '24AAACA5678D1ZW', 'Alpha One Mall, Vastrapur',
       'Alpha One Mall, Vastrapur: Rooftop Deck', 23.0404, 72.5300, 300, 6000)
  ) as t(email, org_name, city, gstin, main_lot, deck_name, deck_lat, deck_lng, deck_cap, deck_rate)
  loop
    select id into v_uid from auth.users where email = x.email;
    select id into v_org from public.organizations where gstin = x.gstin;
    if v_org is null then
      insert into public.organizations (name, city, gstin, verified_at, is_synthetic) values (x.org_name, x.city, x.gstin, now(), true) returning id into v_org;
    end if;
    update public.profiles set role = 'operator_admin', org_id = v_org where id = v_uid;

    -- the existing real-place lot moves to this business
    update public.lots set org_id = v_org
      where name = x.main_lot and city = x.city and is_synthetic
        and org_id in (select id from public.organizations where name = 'Demo data (simulated occupancy)');

    -- a second lot (a deck of the same mall)
    select id into v_lot from public.lots where org_id = v_org and name = x.deck_name;
    if v_lot is null then
      insert into public.lots (org_id, name, city, address, category, lat, lng, status, feed_source, is_synthetic, data_source, data_as_of)
      values (v_org, x.deck_name, x.city, x.deck_name || ', ' || x.city, 'mall', x.deck_lat, x.deck_lng, 'approved', 'manual', true,
              'DEMO lot at a real mall. Position, capacity and rate are estimates; occupancy is SIMULATED', current_date)
      returning id into v_lot;
      insert into public.zones (lot_id, slot_type_id, name, capacity) values (v_lot, v_car, 'Cars', x.deck_cap);
      insert into public.price_rules (lot_id, name, rules) values (v_lot, 'Default (estimated)', jsonb_build_object('baseRatePerHour', x.deck_rate));
    end if;
  end loop;

  -- 3) the demo owner: one verified business with a mall in each city, still able to use the driver view
  select id into v_uid from auth.users where email = 'p25anjali@iima.ac.in';
  select id into v_org from public.organizations where gstin = '27AAACI4321D1Z4';
  if v_org is null then
    insert into public.organizations (name, city, gstin, verified_at, is_synthetic) values ('Anjali Demo Malls (Demo operator)', 'Mumbai', '27AAACI4321D1Z4', now(), true) returning id into v_org;
  end if;
  update public.profiles set role = 'operator_admin', org_id = v_org where id = v_uid;
  for x in select * from (values
    ('Mumbai',    'Inorbit Mall, Malad',      'Inorbit Mall, Malad: Podium Deck',         19.1744, 72.8355, 350, 6000),
    ('Ahmedabad', 'Acropolis Mall, Thaltej',  'Acropolis Mall, Thaltej: Basement 2',      23.0509, 72.5030, 250, 5000)
  ) as t(city, main_lot, deck_name, deck_lat, deck_lng, deck_cap, deck_rate)
  loop
    update public.lots set org_id = v_org
      where name = x.main_lot and city = x.city and is_synthetic
        and org_id in (select id from public.organizations where name = 'Demo data (simulated occupancy)');
    select id into v_lot from public.lots where org_id = v_org and name = x.deck_name;
    if v_lot is null then
      insert into public.lots (org_id, name, city, address, category, lat, lng, status, feed_source, is_synthetic, data_source, data_as_of)
      values (v_org, x.deck_name, x.city, x.deck_name || ', ' || x.city, 'mall', x.deck_lat, x.deck_lng, 'approved', 'manual', true,
              'DEMO lot at a real mall. Position, capacity and rate are estimates; occupancy is SIMULATED', current_date)
      returning id into v_lot;
      insert into public.zones (lot_id, slot_type_id, name, capacity) values (v_lot, v_car, 'Cars', x.deck_cap);
      insert into public.price_rules (lot_id, name, rules) values (v_lot, 'Default (estimated)', jsonb_build_object('baseRatePerHour', x.deck_rate));
    end if;
  end loop;
end $$;
