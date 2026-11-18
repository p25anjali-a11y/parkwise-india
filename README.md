# Parkwise India

Two-sided dynamic parking marketplace for India: drivers see predicted availability and a locked price at their arrival time; operators get a dashboard, a transparent pricing engine and forecasts.

Launch cities: **Mumbai and Ahmedabad** (the strategy brief assumed Bengaluru; this was changed by the product owner). Source of truth for the business: the product brief in the project docs.

## Status

Milestones 1 to 12 are built. See [docs/STATUS.md](docs/STATUS.md) for the honest table of what is real, what is mocked, the keys still needed, known limitations and the two-week backlog.

The app uses **real data only**: no lots are loaded until an operator or partner adds them, and stale or missing inputs are never guessed. Payments and routing are labelled mocks until keys are added; no real provider has been run with a live key and no real money has moved.

## Local setup

```bash
corepack enable
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm backtest          # forecast backtest on a synthetic test fixture (model regression check only); exits 1 on regression
pnpm --filter @parkwise/web dev
pnpm e2e               # Playwright; set E2E_CHANNEL=chrome to use a system Chrome
pnpm db:test           # applies migrations to a scratch Postgres and runs the SQL assertions
```

Copy `.env.example` to `.env.local` when keys become relevant. Missing keys will fall back to labelled mocks.

## Layout

`apps/web` Next.js app · `packages/pricing` · `packages/forecast` · `packages/db` (migrations and SQL tests), `ingestion`, `providers` · `services/forecast` (Python stub) · `e2e` (Playwright) · `docs/`

## Vercel cron limits

Hobby accepts cron schedules at most once per day, with timing only guaranteed within the hour; more frequent expressions fail the deploy. The 2 to 5 minute traffic poller therefore needs a **Pro plan**, or an external trigger (for example a GitHub Actions schedule or Inngest) calling the cron route. `vercel.json` currently sets only the Mumbai region (`bom1`); hourly jobs (ingestion, forecasts, hold expiry) run from `.github/workflows/forecast-cron.yml` instead.

## Branching and protection (guidance)

Work on `develop`, PR into `main` using Conventional Commits. Suggested protection on `main`: require PR review, require the `CI / verify` check, block force pushes, require linear history.

## Privacy (not legal advice)

Design aims at India's DPDP Act 2023: consent before using location, vehicle numbers stored only as keyed hashes, minimal personal data, documented retention, deletion on request. Only the schema exists (`consents`); capture, retention and deletion flows are not implemented.
