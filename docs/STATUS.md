# Status: what is real, what is mocked, what is missing

**Update, 22 Nov 2026.** Interface redesign: map-first Find parking, desktop nav, live trip screen, rewards and referrals (migration 0010, not yet applied to Supabase), operator overview KPIs, revenue page with CSV export, reservations list. Fixed the MapLibre worker URL (maps could not draw tiles in production builds). See `docs/USER_JOURNEY.md`.

**Update, 19 Nov 2026 evening.** Since milestone 13: migrations 0006 to 0009 are applied; 18 real places with SIMULATED occupancy replace the 12 invented lots; the app is two-sided (driver and operator sign-up, switching, operator tab bar); dark gold interface in four languages; best time to arrive, price alerts, saved cars, QR entry pass, operator revenue forecast, valet requests, EV bays, find-my-car pin and wait-list are built. Live site behaviour with signed-in accounts has not been verified. See `CLAUDE.md` for working rules.

Everything below is as of the end of milestone 13 (19 Nov 2026). "Tested" means unit tests, DB assertions on a real Postgres, or Playwright against a local build. Nothing here has handled real parking data or real money.

## Real versus mocked

| Area | State | Evidence and caveats |
|---|---|---|
| Database, RLS, auth tables | **Real.** Supabase project in Mumbai, migrations 0001, 0002, 0004, 0005 and 0006 applied (0003 was the demo seed, now a test-only fixture; 0006 purged it, verified live: 0 lots, 0 synthetic rows, guard trigger present) | 23 tables with RLS and 34 policies confirmed on the live project; DB assertions run on PostGIS in CI. Reservation and feed functions were verified for existence and privileges on the live DB, and behaviour in CI only |
| Auth (email and password) | Built, **not exercised signed-in** | No account has been created yet; email confirmation is on |
| Lots and occupancy | **Real lots: none loaded yet.** Optional **simulated** demo lots (12, labelled "[SIMULATED]") exist only if `seed/simulated_lots.sql` is applied; their occupancy is invented and computed on read | Simulated lots use LIVE weather (Open-Meteo) and live traffic (TomTom, needs key) and real events; every page and saved quote is marked SIMULATED. Real lots never fall back to a simulation |
| Feeds: signed webhook, CSV | Built and tested | No operator is connected. Webhook secrets need `FEED_ENCRYPTION_KEY` |
| Feeds: FASTag, ANPR/barrier vendors, external availability | **Stubs** | Always throw "requires partnership" |
| Forecast | TypeScript baseline, fitted per lot from that lot's **real** recorded occupancy | Needs real history (cold-start flagged); never used when stale or cold-start. The synthetic generator is a test fixture, not exported |
| Pricing engine | Real logic, **freshness-gated** | Only real inputs count: occupancy under 30 min old (or a fresh forecast), traffic under 30 min, weather under 3 h, imported or operator events. Missing or stale inputs are skipped, listed on the quote, and the price falls back to base tariff. Default tariff/tiers are still unvalidated placeholders |
| Quotes | Built; persisted only when the service key is set | Immutable `price_quotes` |
| Reservations and holds | Built; DB functions tested in CI | Not run end to end on the live site (needs service key). No parallel-session concurrency test |
| Payments | **Mock UPI** by default; Razorpay test-mode adapter written | Adapter tested with fake responses only. Refunds are manual |
| Routing / ETA | **Mock** by default; Google Routes adapter written | Untested with a live key. Mappls and Ola Maps adapters **not built** |
| Traffic | TomTom adapter written, key-gated | Untested with a live key. No key means no congestion signal. HERE not built |
| Weather | Open-Meteo adapter written (no key); runs hourly once an approved lot exists | Untested against the live API from this environment. Free for non-commercial use only |
| Calendar and events | CSV import built; **no dates loaded** | Admin must load and verify real holidays and fixtures; until then no event uplift is applied |
| Map tiles | OpenStreetMap raster tiles | Demo only; not for production traffic |
| Alerts | In-app, derived on read | No email, SMS or push |
| Analytics | Built (occupancy by hour, reservations, pricing) | Gross figures include test payments |
| Admin | Built (approvals, audit, health, CSV import). Demo mode removed | Not exercised signed-in |
| PWA | Manifest, icons, shell-only service worker | Prices and availability are never cached |
| CI | Typecheck, lint, tests, backtest, build, Playwright, Python tests, DB tests | Scheduled jobs workflow needs repo secrets |
| Privacy (DPDP) | **Not implemented beyond schema** | `consents` table exists; no consent capture, retention job or deletion flow |

## Keys and accounts still needed

| Item | Needed for | Required now? |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` (Vercel env) | Saved quotes, reservations, feeds, crons, admin import | **Yes** for anything beyond browsing |
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
- No real lots or live occupancy are loaded yet. Until a lot connects a feed, its price is its base tariff plus any fresh traffic, weather and event signals.
- Public sources checked 19 Nov 2026: no open real-time parking occupancy API exists for Mumbai or Ahmedabad. TomTom, HERE and Parkopedia sell it (India coverage unconfirmed); ParkNav does not cover India; MCGM's open data is static and its download is blocked from here; Ahmedabad's AmdaPark has no public API.
- In-memory rate limiting is per serverless instance and only blunts bursts.
- Content-Security-Policy is report-only until checked against real traffic.
- Vercel Hobby crons run once a day, so hourly jobs run from GitHub Actions.
- Refunds, payouts and settlement are not automated; a payment that arrives after a hold lapses is flagged `refund_needed` for manual handling.
- No consent capture for location use, no data retention or deletion jobs.
- No two-wheeler or EV booking flows (cars first by decision); zones exist in the schema.
- Municipal tariff caps are per-lot numbers set by hand, not sourced.

## Two-week backlog (priority order)

1. Add the Vercel and GitHub secrets above; create a platform-admin account; walk the full driver flow (sign up, search, quote, reserve, mock pay) and fix what breaks.
2. Link arrival time to routing ETA (arrival = now + ETA, refreshed) and add a Playwright flow against a test database.
3. Load real calendar and event data from official sources; verify Open-Meteo licensing for commercial use or choose another weather source.
4. Pilot one real mall or hospital: signed webhook or CSV feed, one week of snapshots, then retrain and re-run the backtest on real data.
5. Build the Mappls adapter against their documentation, and run the Google and TomTom adapters with live keys.
6. Razorpay test mode end to end with webhook; automate refunds for `refund_needed`.
7. DPDP basics: location consent capture, retention job, deletion request flow, privacy notice.
8. Concurrency test for simultaneous reservations (parallel sessions) and a load test of the quote path.
9. Enforce CSP; move rate limiting to a shared store or edge.
10. Notifications (email first) for operator alerts and driver reservation confirmations.
