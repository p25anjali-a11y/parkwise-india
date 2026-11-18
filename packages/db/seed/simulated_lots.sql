-- SIMULATED LOTS (not a migration; apply by hand when you want a demo). Every row is flagged is_synthetic and named
-- "[SIMULATED] ...". Only the lots exist in the database: their occupancy is computed on read by the app
-- (apps/web/lib/simulated-occupancy.ts) from the real clock, live rain probability and real event windows.
-- Names are neighbourhoods, coordinates approximate, capacities and rates invented.
-- Safe to run more than once (existing simulated lots are kept and re-approved). Remove with seed/remove_simulated_lots.sql.
set app.allow_synthetic = 'on';

do $$
declare
  r record; v_org uuid; v_lot uuid; v_car smallint;
begin
  select id into v_car from public.slot_types where code = 'car';
  for r in select * from (values
    ('Mumbai',    'Bandra Mall Parking',          'mall',     19.0596, 72.8295,  600,  8000),
    ('Mumbai',    'Lower Parel Mall Parking',     'mall',     18.9930, 72.8250,  800,  9000),
    ('Mumbai',    'BKC Office Parking',           'office',   19.0690, 72.8690,  700, 10000),
    ('Mumbai',    'Andheri East Office Parking',  'office',   19.1136, 72.8697,  450,  7000),
    ('Mumbai',    'Powai Mall Parking',           'mall',     19.1176, 72.9060,  500,  6000),
    ('Mumbai',    'Churchgate Stadium Parking',   'stadium',  18.9389, 72.8258,  300,  9000),
    ('Mumbai',    'Parel Hospital Parking',       'hospital', 19.0007, 72.8408,  250,  5000),
    ('Ahmedabad', 'SG Highway Mall Parking',      'mall',     23.0300, 72.5070,  500,  5000),
    ('Ahmedabad', 'Satellite Mall Parking',       'mall',     23.0225, 72.5170,  400,  5000),
    ('Ahmedabad', 'Navrangpura Office Parking',   'office',   23.0396, 72.5604,  300,  5000),
    ('Ahmedabad', 'Motera Stadium Parking',       'stadium',  23.0919, 72.5975,  800,  6000),
    ('Ahmedabad', 'Civil Hospital Parking',       'hospital', 23.0522, 72.6034,  250,  3000)
  ) as t(city, name, category, lat, lng, capacity, rate_paise)
  loop
    select id into v_lot from public.lots where is_synthetic and city = r.city and name = '[SIMULATED] ' || r.name;
    if v_lot is not null then
      update public.lots set status = 'approved' where id = v_lot;
      continue;
    end if;
    select id into v_org from public.organizations where is_synthetic and city = r.city and name = '[SIMULATED] Demo operator';
    if v_org is null then
      insert into public.organizations (name, city, is_synthetic) values ('[SIMULATED] Demo operator', r.city, true) returning id into v_org;
    end if;
    insert into public.lots (org_id, name, city, address, category, lat, lng, status, feed_source, is_synthetic, data_source, data_as_of)
    values (v_org, '[SIMULATED] ' || r.name, r.city, 'Simulated lot, approximate location', r.category, r.lat, r.lng, 'approved', 'manual', true,
            'SIMULATED: invented capacity, rate and occupancy', current_date)
    returning id into v_lot;
    insert into public.zones (lot_id, slot_type_id, name, capacity) values (v_lot, v_car, 'Cars', r.capacity);
    insert into public.price_rules (lot_id, name, rules) values (v_lot, 'Default (simulated)', jsonb_build_object('baseRatePerHour', r.rate_paise));
  end loop;
end $$;
