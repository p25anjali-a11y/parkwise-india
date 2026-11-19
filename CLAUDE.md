# Parkwise India: working notes for any Claude session

Two-sided dynamic parking marketplace for Mumbai and Ahmedabad. Drivers search, see a demand-based price, pay by UPI (mock for now) and hold a space for 15 minutes. Parking-place operators manage lots, price limits and feeds. A platform admin approves and audits. Dark UI, English / Hindi / Gujarati / Marathi.

Read these first, in order: `docs/STATUS.md` (what is real, mocked, missing), `docs/ARCHITECTURE.md`, `docs/DATA_SOURCES.md`, `README.md`. The original brief and prompt pack live in the Claude Project "EAI".

## Stack and layout
- pnpm monorepo. `apps/web` is Next.js 15 + TypeScript. `packages/pricing` (pure pricing engine), `packages/providers` (weather, traffic, routing, payments, CSV parsers), `packages/forecast`, `packages/db` (Supabase migrations, seeds, SQL tests), `services/` (Python forecast stub), `e2e/` (Playwright).
- Hosting: Vercel (web), Supabase (Postgres, Auth, RLS, PostGIS, Mumbai region), GitHub Actions (CI and hourly jobs, because Vercel Hobby crons are daily).
- Commands: `pnpm -r typecheck`, `pnpm exec vitest run`, `pnpm --filter web build`, `pnpm --filter web exec next start`. DB tests: `packages/db/scripts/test.sh` (needs Postgres). E2E: `pnpm exec playwright test` (build with NEXT_PUBLIC_SUPABASE_* empty, or the "not configured" test fails locally).

## Rules that must not be broken
1. **Real vs simulated.** Real data is never invented. Parking occupancy for the 18 demo places is SIMULATED (`is_synthetic` lots, computed on read in `apps/web/lib/simulated-occupancy.ts`, never stored, never fed to the forecast) and every screen labels it. Weather (Open-Meteo) and traffic (TomTom) are live; missing or stale inputs are skipped and listed, never guessed. Freshness limits are in `packages/pricing/src/freshness.ts`.
2. **Money is integer paise.** Quotes (`price_quotes`) are immutable. A quote is locked for 15 minutes.
3. **Pricing order:** tier by occupancy, then rain and traffic uplift (capped at 0.10 total), event uplift, smoothing (+0.15 / -0.20 per interval), multiplier clamp 0.8 to 2.0, operator min/max, municipal cap. Change it only with tests in `packages/pricing`.
4. **Database.** Every table has RLS. Write functions are SECURITY INVOKER and granted to `service_role` only. Roles are changed only through `/api/operator/join` (own profile, service role) or by hand in SQL. New migrations go in `packages/db/migrations/` with the next number (latest: 0009); add SQL tests in `packages/db/tests/` and list them in `scripts/test.sh`.
5. **No card data.** Never collect or store card numbers. Payments go through Razorpay's hosted screen. Plates are stored as a hash plus the last four characters.
6. **Secrets.** Never commit keys or `.env*`. Env var names: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `FEED_ENCRYPTION_KEY`, optional `TOMTOM_API_KEY`, `GOOGLE_MAPS_API_KEY`, Razorpay keys. Values live in Vercel and GitHub secrets. GitHub secrets for the hourly jobs: `APP_URL`, `CRON_SECRET`.
7. **UI.** Dark only, gold accent, line icons, no emoji. Every new string goes in all four languages in `apps/web/lib/i18n.ts`. Keep tap targets at least 44px.
8. **Workflow.** Branch, small PR into `main`, wait for CI (verify, db, e2e), then squash-merge. Merging to `main` deploys to production on Vercel. Coordinate with teammates before touching the same files, and rebase often.

## Features built (see STATUS.md for caveats)
Search with filters and sort, lot page with price quote and "why this price", best time to arrive, price alerts, saved cars, QR entry pass, find-my-car pin, valet requests, wait-list, EV bays, live lot simulation, operator dashboard with revenue forecast, valet queue and feeds, admin approvals and CSV import.

## Not built or not proven
Real lots and live occupancy (none exist yet), live-key behaviour of TomTom / Google / Razorpay adapters, signed-in flows on the live site, push or email notifications, refunds and payouts, DPDP consent and deletion, EV bay booking, scanner screen for QR passes.

## Demo data scripts (run in the Supabase SQL editor)
`packages/db/seed/real_places.sql` (18 real places, simulated counts), `demo_ev_bays.sql`, `remove_simulated_lots.sql` (suspend or delete demo lots once real ones arrive).
