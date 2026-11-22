-- Operator verification: GSTIN shape is enforced, GSTIN is unique, and only a platform admin can verify.
insert into public.organizations (name, city, gstin) values ('Verify Test Mall', 'Mumbai', '29AAACV9999C1ZN');
select test_helpers.expect_eq((select count(*) from public.organizations where name = 'Verify Test Mall' and verified_at is null), 1, 'new organisation starts unverified');
select test_helpers.expect_error($$insert into public.organizations (name, city, gstin) values ('Bad Shape', 'Mumbai', 'NOTAGSTIN')$$, 'a malformed GSTIN is rejected');
select test_helpers.expect_error($$insert into public.organizations (name, city, gstin) values ('Dup', 'Mumbai', '29AAACV9999C1ZN')$$, 'a GSTIN can belong to one organisation only');

-- an operator admin of that organisation (acting through RLS) cannot verify themselves
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'op-verify@test.local') on conflict do nothing;
update public.profiles set role = 'operator_admin', org_id = (select id from public.organizations where name = 'Verify Test Mall') where id = '00000000-0000-0000-0000-0000000000a1';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', false);
select test_helpers.expect_error($$update public.organizations set verified_at = now() where name = 'Verify Test Mall'$$, 'an operator cannot verify their own organisation');
select test_helpers.expect_error($$update public.organizations set gstin = '24AAACA5678D1ZW' where name = 'Verify Test Mall'$$, 'an operator cannot change the GSTIN after sign-up');
reset role;
update public.organizations set verified_at = now() where name = 'Verify Test Mall';
select test_helpers.expect_eq((select count(*) from public.organizations where name = 'Verify Test Mall' and verified_at is not null), 1, 'the service role / an admin can verify');
\echo ORG VERIFICATION ASSERTIONS PASSED
