-- 0011: operator identity. A parking business gives its GSTIN when it signs up; a platform admin checks it against
-- the GST portal and marks the organisation verified. Unverified operators can set up lots but cannot submit them
-- for approval. Operators can never mark themselves verified or change the GSTIN afterwards.
alter table public.organizations
  add column gstin text check (gstin is null or gstin ~ '^(0[1-9]|[1-2][0-9]|3[0-8])[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'),
  add column verified_at timestamptz,
  add column verified_by uuid references auth.users (id) on delete set null;

create unique index organizations_gstin_key on public.organizations (gstin) where gstin is not null;

-- SECURITY INVOKER on purpose: current_user must be the calling role, not the function owner.
create or replace function private.guard_org_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') or private.is_platform_admin() then
    return new;
  end if;
  if new.gstin is distinct from old.gstin or new.verified_at is distinct from old.verified_at or new.verified_by is distinct from old.verified_by then
    raise exception 'only a platform admin can change GSTIN or verification';
  end if;
  return new;
end $$;

drop trigger if exists orgs_guard on public.organizations;
create trigger orgs_guard before update on public.organizations
  for each row execute function private.guard_org_update();
