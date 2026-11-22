-- Removes the demo users and demo operator businesses (seed/demo_accounts.sql). Their lots go back to the shared demo organisation.
set app.allow_synthetic = 'on';
update public.lots set org_id = (select id from public.organizations where name = 'Demo data (simulated occupancy)' and city = lots.city limit 1)
  where org_id in (select id from public.organizations where gstin in ('27AAACP1234C1Z1', '24AAACA5678D1ZW'))
    and name not like '%: West Deck' and name not like '%: Rooftop Deck';
delete from public.lots where name in ('Phoenix Marketcity, Kurla: West Deck', 'Alpha One Mall, Vastrapur: Rooftop Deck');
delete from auth.users where email in ('mumbai.operator@parkwise.example', 'ahmedabad.operator@parkwise.example', 'driver@parkwise.example');
delete from public.organizations where gstin in ('27AAACP1234C1Z1', '24AAACA5678D1ZW');
