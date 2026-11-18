-- Hides every simulated lot from drivers (suspended) and deletes those with no saved quotes or reservations.
-- Lots that already have a saved price quote or booking are only suspended: those records are immutable by design.
-- Real lots are untouched.
update public.lots set status = 'suspended' where is_synthetic and name like '[SIMULATED]%';
delete from public.lots l where l.is_synthetic and l.name like '[SIMULATED]%'
  and not exists (select 1 from public.price_quotes q where q.lot_id = l.id)
  and not exists (select 1 from public.reservations r where r.lot_id = l.id);
delete from public.organizations o where o.is_synthetic and o.name = '[SIMULATED] Demo operator'
  and not exists (select 1 from public.lots l where l.org_id = o.id);
