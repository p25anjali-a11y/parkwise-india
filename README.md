# Parkwise India

Two-sided dynamic parking marketplace for India: drivers see predicted availability and a locked price at their arrival time; operators get a dashboard, a transparent pricing engine and forecasts.

Launch cities: **Mumbai and Ahmedabad** (the strategy brief assumed Bengaluru; this was changed by the product owner). Source of truth for the business: the product brief in the project docs.

## Status

| Milestone | State |
|---|---|
| 1 Repo, CI, hello-world app | Done locally; not yet pushed or deployed |
| 6 Pricing engine + tests | Done (38 tests) |
| 7 Forecast baseline + backtest gate | Done on synthetic data (17 tests) |
| 2 Schema, seed, auth | Next |
| 3, 4, 5, 8 to 12 | Not started |

Everything runs on **synthetic data and mocks** today. No real provider is integrated.

## Local setup

```bash
corepack enable
pnpm install
pnpm typecheck && pnpm lint && pnpm test
pnpm backtest          # forecast backtest on synthetic data; exits 1 on regression
pnpm --filter @parkwise/web dev
```

Copy `.env.example` to `.env.local` when keys become relevant. Missing keys will fall back to labelled mocks.

## Layout

`apps/web` Next.js app · `packages/pricing` · `packages/forecast` · `packages/db`, `ingestion`, `providers` (placeholders) · `services/forecast` (Python stub, planned) · `docs/`

## Vercel cron limits

Hobby accepts cron schedules at most once per day, with timing only guaranteed within the hour; more frequent expressions fail the deploy. The 2 to 5 minute traffic poller therefore needs a **Pro plan**, or an external trigger (for example a GitHub Actions schedule or Inngest) calling the cron route. `vercel.json` currently sets only the Mumbai region (`bom1`); schedules are added with the ingestion slice.

## Branching and protection (guidance)

Work on `develop`, PR into `main` using Conventional Commits. Suggested protection on `main`: require PR review, require the `CI / verify` check, block force pushes, require linear history.

## Privacy (not legal advice)

Design aims at India's DPDP Act 2023: consent before using location, vehicle numbers stored only as keyed hashes, minimal personal data, documented retention, deletion on request. Not yet implemented.
