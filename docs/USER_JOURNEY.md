# User journeys and feature map

Written 22 Nov 2026 alongside the interface redesign (PR "Map-first driver app, operator console, live trip and referrals"). Routes are the real ones in `apps/web`. "Built" means the screen exists and is tested as far as `docs/STATUS.md` says; nothing here has handled real parking data or real money.

## Driver journey

| # | Stage | What the driver wants | Screen and route | What the app does | Status |
|---|---|---|---|---|---|
| 1 | Discover | Hear about it, trust it | Invite link `/r/CODE`, `/how` | Invite link stores the code for 7 days and opens sign-up. `/how` explains the three steps | Built (new) |
| 2 | Find parking | See what is near and what it costs | `/search` (first tab, `/` redirects here) | Map with price pins coloured by availability, list beside it, city, category, EV and sort filters, name search, "Near me" | Built (redesigned) |
| 3 | Decide | Pick between lots | `/lots/[id]` | Price now, free bays, why this price, best time to arrive, EV bays, wait-list when nearly full, mini map | Built (redesigned) |
| 4 | Reserve and pay | Lock the price | Quote form, `ReserveFlow` | 15 minute hold, price locked, mock UPI (Razorpay test mode adapter written) | Built, mock payments |
| 5 | Travel | Know when I arrive and whether there will be space | `/trip/[lotId]` | Live position (only after the driver taps Start), ETA that refreshes every 30 s, arrival clock time, expected free bays at arrival, share ETA, hand-off to the maps app | Built (new). Straight-line path, not a road route. ETA is a mock estimate until a routing key is set |
| 6 | Arrive and enter | Get in quickly | `/driver/reservations` | "You have arrived" banner within 150 m, signed QR entry pass | Built. No gate scanner screen yet |
| 7 | Stay | Find my car, ask for valet | Reservation card | Car pin with note, valet request | Built |
| 8 | Leave and pay | Know what I owe | Reservation card | Prepaid at booking. No extension or overstay flow | Not built |
| 9 | Come back and invite | Reuse, earn credit | `/rewards`, `/driver` | Invite code, share to WhatsApp or copy link, credit ledger, invite list | Built (new). Credit can be earned but not yet spent at checkout |

Entry points on a phone: bottom tab bar (Find, Live lot, My trips, Rewards, Me). On a desktop (900 px and up): top bar with the same tabs, Find parking first.

### Referral rules (pilot values in `apps/web/lib/referral.ts`)
- Each driver has one 8 character code. The invite link is `/r/CODE`.
- The friend must sign up through the link, then complete a first confirmed booking of at least Rs 50. Then both get Rs 100 credit in the ledger.
- One referral per friend, no self-referral, a friend with an earlier confirmed booking cannot be referred.
- Rewarding runs inside the payment confirmation route, best effort, and never blocks a payment.
- The amounts are a business decision for the owner. Payments are still mock, so credits earned today come from mock payments.

## Operator journey

| # | Stage | Screen and route | Status |
|---|---|---|---|
| 1 | Sign up as operator | `/login` (operator option), `/become-operator` | Built |
| 2 | Add a lot | `/operator/lots/new` | Built |
| 3 | Connect occupancy | `/operator/integrations` (signed webhook, CSV) | Built. Vendor and FASTag adapters are stubs that require partnership |
| 4 | Set prices | `/operator/lots/[id]` (base rate, floor, ceiling, dynamic on or off, what-if table) | Built |
| 5 | Watch the day | `/operator` overview: KPIs (live lots, vehicles in now, gross 7 days, arriving in 2 h), alerts, revenue forecast, valet queue, wait-list, live lot cards | Built (redesigned) |
| 6 | Manage bookings | `/operator/reservations` (status and lot filters) | Built (new, read only) |
| 7 | Understand revenue | `/operator/analytics` (gross per day, occupancy by hour, conversion, per-lot table, CSV export) | Built (redesigned) |
| 8 | Settle and pay out | none | Not built |

On a desktop the operator console has a left sidebar. On a phone it uses the bottom tab bar.

## Not built yet (the honest list)
- Spending credit at checkout, refunds, payouts and settlement.
- Gate scanner and check-in screen, extend stay, overstay charges.
- A road route on the map. The live trip draws a straight dotted line and hands turn-by-turn to the maps app. Returning a route polyline needs the Google Routes field mask or the Mappls adapter.
- Push or email notifications.
- Operator zone editor, reservation quota editor, team members and roles.
- DPDP consent capture, retention and deletion. The trip screen only reads location after a tap and while it is open.
- Hindi, Gujarati and Marathi strings for the redesign were written by Claude and need native review (`apps/web/lib/i18n-redesign.ts`).

## Needs a decision
1. Referral amounts and the minimum first booking (`lib/referral.ts`).
2. Whether credit may be spent on any lot or only on off-peak bookings.
3. Migration `0010_referrals.sql` must be applied to the Supabase project before `/rewards` shows codes. Until then `/rewards` shows a "not switched on" note and nothing else breaks.
