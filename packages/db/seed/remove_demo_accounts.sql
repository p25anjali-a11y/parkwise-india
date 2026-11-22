-- Removes the demo users and demo operator businesses (seed/demo_accounts.sql). Their lots go back to the shared demo organisation.
set app.allow_synthetic = 'on';
-- p25anjali@iima.ac.in is NOT deleted (it may be a real account): it goes back to a plain driver, and its password stays the demo one until you reset it.
update public.profiles set role = 'driver', org_id = null where id in (select id from auth.users where email = 'p25anjali@iima.ac.in');
update public.lots set org_id = (select id from public.organizations where name = 'Demo data (simulated occupancy)' and city = lots.city limit 1)
  where org_id in (select id from public.organizations where gstin in ('27AAACP1234C1Z1', '24AAACA5678D1ZW', '27AAACI4321D1Z4'))
    and name not like '%: West Deck' and name not like '%: Rooftop Deck' and name not like '%: Podium Deck' and name not like '%: Basement 2';
delete from public.lots where name in ('Phoenix Marketcity, Kurla: West Deck', 'Alpha One Mall, Vastrapur: Rooftop Deck', 'Inorbit Mall, Malad: Podium Deck', 'Acropolis Mall, Thaltej: Basement 2');
delete from auth.users where email in ('mumbai.operator@parkwise.example', 'ahmedabad.operator@parkwise.example', 'driver@parkwise.example');
delete from public.organizations where gstin in ('27AAACP1234C1Z1', '24AAACA5678D1ZW', '27AAACI4321D1Z4');
