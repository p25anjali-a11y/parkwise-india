# Status: what is real, what is mocked, what is missing

Everything below is as of the end of milestone 12. "Tested" means unit tests, DB assertions on a real Postgres, or Playwright against a local build. Nothing here has handled real parking data or real money.

## Real versus mocked

| Area | State | Evidence and caveats |
|---|---|---|
| Database, RLS, auth tables | **Real.** Supabase project in Mumbai, migrations 0001 to 0005 applied | 23 tables with RLS and 34 policies confirmed on the live project; DB assertions run on PostGIS in CI. Reservation and feed functions were verified for existence and privileges on the live DB, and behaviour in CI only |
| Auth (email and password) | Built, **not exercised signed-in** | No account has been created yet; email confirmation is on |
| Occupancy data | **Synthetic.** 15 invented lots, 43,965 snapshots | Names are real places; capacities, tariffs and counts are invented. Flagged `is_synthetic` and labelled in the UI |
| Feeds: signed webhook, CSV | Built and tested | No operator is connected. Webhook secrets need `FEED_ENCRYPTION_KEY` |
| Feeds: FASTag, ANPR/barrier vendors, external availability | **Stubs** | Always throw "requires partnership" |
| Forecast | TypeScript baseline, **trained on synthetic data only** | Backtest numbers are synthetic; no better than persistence at 30 minutes. Congestion coefficient is a hand-set prior. Python service is a **stub** (persistence) |
| Pricing engine | Real logic, demo parameters | Defaults (₹60/hr base, tiers, caps) are placeholders, not market-tested |
| Quotes | Built; persisted only when the service key is set | Immutable `price_quotes` |
| Reservations and holds | Built; DB functions tested in CI | Not run end to end on the live site (needs service key). No parallel-session concurrency test |
| Payments | **Mock UPI** by default; Razorpay test-mode adapter written | Adapter tested with fake responses only. Refunds are manual |
| Routing / ETA | **Mock** by default; Google Routes adapter written | Untested with a live key. Mappls and Ola Maps adapters **not built** |
| Traffic | TomTom adapter written, key-gated | Untested with a live key. No key means no congestion signal. HERE not built |
| Weather | Open-Meteo adapter written (no key) | Untested against the live API from this environment. Free for non-commercial use only |
| Calendar and events | CSV import built; **no real dates loaded** | Synthetic rows only. Admin must load and verify real holidays and fixtures |
| Map tiles | OpenStreetMap raster tiles | Demo only; not for production traffic |
| Alerts | In-app, derived on read | No email, SMS or push |
| Analytics | Built (occupancy by hour, reservations, pricing) | Gross figures include test payments |
| Admin and demo mode | Built (approvals, audit, health, simulate busy Saturday / IPL night) | Not exercised signed-in |
| PWA | Manifest, icons, shell-only service worker | Prices and availability are never cached |
| CI | Typecheck, lint, tests, backtest, build, Playwright, Python tests, DB tests | Scheduled jobs workflow needs repo secrets |
| Privacy (DPDP) | **Not implemented beyond schema** | `consents` table exists; no consent capture, retention job or deletion flow |

## Keys and accounts still needed

| Item | Needed for | Required now? |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` (Vercel env) | Saved quotes, reservations, feeds, crons, admin import, demo mode | **Yes** for anything beyond browsing |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Vercel env) | Everything | **Yes** |
| `CRON_SECRET` (Vercel env and GitHub secret) plus `APP_URL` (GitHub secret) | Hourly forecast, ingestion and hold expiry | Yes for live forecasts |
| `FEED_ENCRYPTION_KEY` | Operator webhook secrets | Before onboarding an operator |
| Supabase Auth Site URL set to the Vercel URL | Email confirmation links | Yes |
| Razorpay test keys and webhook secret | Real UPI test checkout | Optional (mock works without) |
| `GOOGLE_MAPS_API_KEY` (Routes API) | Traffic-aware ETA | Optional |
| `TOMTOM_API_KEY` | Congestion signal | Optional |
| Mappls and Ola Maps keys | Not usable: adapters not built | Later |
| Operator and partner agreements | FASTag, vendor feeds, real occupancy | For launch |

## Known limitations

- The driver's "arrive in" choice is not yet linked to the routing ETA; the ETA button is informational.
- Forecasts and quotes use only synthetic history until real feeds exist; treat every number as a demo.
- In-memory rate limiting is per serverless instance and only blunts bursts.
- Content-Security-Policy is report-only until checked against real traffic.
- Vercel Hobby crons run once a day, so hourly jobs run from GitHub Actions.
- Refunds, payouts and settlement are not automated; a payment that arrives after a hold lapses is flagged `refund_needed` for manual handling.
- No consent capture for location use, no data retention or deletion jobs.
- No two-wheeler or EV booking flows (cars first by decision); zones exist in the schema.
- Municipal tariff caps are per-lot numbers set by hand, not sourced.

## Two-week backlog (priority order)

1. Add the Vercel and GitHub secrets above; create a platform-admin account; walk the full driver flow (sign up, search, quote, reserve, mock pay) and fix what breaks.
2. Link arrival time to routing ETA (arrival = now + ETA, refreshed) and add a Playwright flow against a seeded preview.
3. Load real calendar and event data from official sources; verify Open-Meteo licensing for commercial use or choose another weather source.
4. Pilot one real mall or hospital: signed webhook or CSV feed, one week of snapshots, then retrain and re-run the backtest on real data.
5. Build the Mappls adapter against their documentation, and run the Google and TomTom adapters with live keys.
6. Razorpay test mode end to end with webhook; automate refunds for `refund_needed`.
7. DPDP basics: location consent capture, retention job, deletion request flow, privacy notice.
8. Concurrency test for simultaneous reservations (parallel sessions) and a load test of the quote path.
9. Enforce CSP; move rate limiting to a shared store or edge.
10. Notifications (email first) for operator alerts and driver reservation confirmations.
