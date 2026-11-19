-- REAL PLACES, SIMULATED OCCUPANCY (not a migration; apply by hand for a demo).
-- Replaces the invented "[SIMULATED] ..." lots: it hides them and adds well-known real places (malls, stadiums,
-- hospitals, airports) in Mumbai and Ahmedabad under their real names.
-- What is real: the place and its (approximate) map position. What is NOT real: the capacity and hourly rate
-- (estimates) and, above all, the occupancy, which the app simulates on read (apps/web/lib/simulated-occupancy.ts)
-- from the clock, live rain and events. The lots stay flagged is_synthetic so every screen says "Demo traffic".
-- Positions are approximate and should be checked against a map before any real pilot.
-- Safe to run more than once. Remove with seed/remove_real_places.sql.
set app.allow_synthetic = 'on';

update public.lots set status = 'suspended' where is_synthetic and name like '[SIMULATED]%';

do $$
declare
  r record; v_org uuid; v_lot uuid; v_car smallint;
begin
  select id into v_car from public.slot_types where code = 'car';
  for r in select * from (values
    ('Mumbai',    'Phoenix Marketcity, Kurla',                  'mall',     19.0866, 72.8890, 1200, 6000),
    ('Mumbai',    'High Street Phoenix and Palladium, Lower Parel', 'mall', 18.9946, 72.8258, 1000, 8000),
    ('Mumbai',    'Jio World Drive, BKC',                       'mall',     19.0640, 72.8650, 1000, 9000),
    ('Mumbai',    'Inorbit Mall, Malad',                        'mall',     19.1740, 72.8350,  800, 6000),
    ('Mumbai',    'R City Mall, Ghatkopar',                     'mall',     19.0995, 72.9165, 1000, 6000),
    ('Mumbai',    'Infiniti Mall, Andheri West',                'mall',     19.1370, 72.8267,  400, 6000),
    ('Mumbai',    'Oberoi Mall, Goregaon East',                 'mall',     19.1730, 72.8610,  600, 6000),
    ('Mumbai',    'Wankhede Stadium, Churchgate',               'stadium',  18.9389, 72.8258,  300, 9000),
    ('Mumbai',    'Tata Memorial Hospital, Parel',              'hospital', 19.0042, 72.8423,  200, 5000),
    ('Mumbai',    'Mumbai Airport Terminal 2',                  'other',    19.0896, 72.8656, 1500, 12000),
    ('Ahmedabad', 'Alpha One Mall, Vastrapur',                  'mall',     23.0400, 72.5295,  800, 5000),
    ('Ahmedabad', 'Ahmedabad One Mall, Vastrapur',              'mall',     23.0380, 72.5262,  500, 5000),
    ('Ahmedabad', 'Acropolis Mall, Thaltej',                    'mall',     23.0505, 72.5025,  600, 5000),
    ('Ahmedabad', 'Himalaya Mall, Drive-In Road',               'mall',     23.0460, 72.5325,  300, 5000),
    ('Ahmedabad', 'Narendra Modi Stadium, Motera',              'stadium',  23.0919, 72.5975, 1000, 6000),
    ('Ahmedabad', 'Civil Hospital, Asarwa',                     'hospital', 23.0540, 72.6035,  300, 3000),
    ('Ahmedabad', 'Kankaria Lake',                              'other',    23.0063, 72.6010,  250, 3000),
    ('Ahmedabad', 'Ahmedabad Airport',                          'other',    23.0770, 72.6347,  600, 8000)
  ) as t(city, name, category, lat, lng, capacity, rate_paise)
  loop
    select l.id into v_lot from public.lots l join public.organizations o on o.id = l.org_id
      where l.is_synthetic and l.city = r.city and l.name = r.name and o.name = 'Demo data (simulated occupancy)';
    if v_lot is not null then
      update public.lots set status = 'approved' where id = v_lot;
      continue;
    end if;
    select id into v_org from public.organizations where is_synthetic and city = r.city and name = 'Demo data (simulated occupancy)';
    if v_org is null then
      insert into public.organizations (name, city, is_synthetic) values ('Demo data (simulated occupancy)', r.city, true) returning id into v_org;
    end if;
    insert into public.lots (org_id, name, city, address, category, lat, lng, status, feed_source, is_synthetic, data_source, data_as_of)
    values (v_org, r.name, r.city, r.name || ', ' || r.city, r.category, r.lat, r.lng, 'approved', 'manual', true,
            'Real place, approximate position. Capacity and rate are estimates; occupancy is SIMULATED', current_date)
    returning id into v_lot;
    insert into public.zones (lot_id, slot_type_id, name, capacity) values (v_lot, v_car, 'Cars', r.capacity);
    insert into public.price_rules (lot_id, name, rules) values (v_lot, 'Default (estimated)', jsonb_build_object('baseRatePerHour', r.rate_paise));
  end loop;
end $$;
