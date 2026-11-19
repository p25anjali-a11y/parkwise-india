-- Hides every demo lot (real places with simulated occupancy, and the older invented ones) and deletes those with no
-- saved quotes or reservations. Lots with quotes or bookings are only suspended: those records are immutable by design.
-- Lots of real operators are untouched.
update public.lots set status = 'suspended'
  where is_synthetic and org_id in (select id from public.organizations where name in ('Demo data (simulated occupancy)', '[SIMULATED] Demo operator'));
delete from public.lots l
  where l.is_synthetic and l.org_id in (select id from public.organizations where name in ('Demo data (simulated occupancy)', '[SIMULATED] Demo operator'))
  and not exists (select 1 from public.price_quotes q where q.lot_id = l.id)
  and not exists (select 1 from public.reservations r where r.lot_id = l.id);
delete from public.organizations o where o.name in ('Demo data (simulated occupancy)', '[SIMULATED] Demo operator')
  and not exists (select 1 from public.lots l where l.org_id = o.id);
