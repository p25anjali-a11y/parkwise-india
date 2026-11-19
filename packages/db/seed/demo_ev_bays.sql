-- DEMO ONLY (estimates, not real counts): adds EV charging bays to a few demo places so the EV filter has something to show.
-- Safe to run more than once.
insert into public.zones (lot_id, slot_type_id, name, capacity)
select l.id, (select id from public.slot_types where code = 'ev'), 'EV bays',
       case when l.name like 'Phoenix%' or l.name like 'Jio%' then 12 when l.name like 'Alpha%' or l.name like 'Acropolis%' then 8 else 6 end
from public.lots l
where l.is_synthetic and l.status = 'approved' and l.category in ('mall', 'other')
  and (l.name like 'Phoenix%' or l.name like 'Jio%' or l.name like 'Inorbit%' or l.name like 'Alpha%' or l.name like 'Acropolis%' or l.name like 'Mumbai Airport%')
  and not exists (select 1 from public.zones z where z.lot_id = l.id and z.name = 'EV bays');
