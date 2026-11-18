# Architecture

Status legend: **built** = code exists and is tested; **mock** = a labelled stand-in is used unless a key is present; **stub** = needs a partnership. See STATUS.md for evidence.

```mermaid
flowchart LR
  subgraph Sources
    OP[Operator feeds: signed webhook, CSV - built] -->| ING
    TR[Traffic: TomTom - built, key-gated] -->| ING
    WX[Open-Meteo - built] -->| ING
    CAL[Calendar + events: CSV import - built] -->| ING
  end
  ING[packages/ingestion - built] --> DB[(Supabase Postgres + PostGIS)]
  DB --> FC[packages/forecast - built]
  RT[RoutingProvider: mock, Google - built; Mappls, Ola - not built] --> ETA[arrival time = now + ETA]
  ETA --> FC
  FC --> PR[packages/pricing - built]
  PR --> Q[(price_quotes, immutable)]
  Q --> APP[apps/web: driver PWA + operator dashboard]
  DB --> APP
  APP --> PAY[PaymentProvider: mock UPI, Razorpay test - built]
```

## Decisions so far
- **Money is integer paise** end to end.
- **Pricing and forecast are pure TypeScript packages** with no I/O, so they run in the web app, cron jobs and tests alike.
- **`quote()` takes predicted occupancy as an input**; the caller gets it from `ForecastService` at `now + ETA`.
- **Forecast model** is an hour-of-week profile fitted on unflagged days with recency weighting, per-daypart flag effects (holiday, festival, event, rain) learned from history, a live-count residual that fades with horizon, and an interval calibrated on synthetic data (`SIGMA_SCALE`). The congestion coefficient is a hand-set prior, not learned.
- **Backtest gate** (`pnpm backtest`) fails CI when MAE, 80% interval coverage or Brier score regress past `packages/forecast/thresholds.json`.

## Server-side writes
Clients (anon and authenticated roles) cannot write reservations, payments, quotes, occupancy or feed secrets. Those go through the Next.js server with the service-role key, calling SECURITY INVOKER SQL functions (`create_hold`, `confirm_payment`, `ingest_occupancy_events`, ...) that are granted to `service_role` only. Zone inventory is serialised with a row lock and guarded by the `reserved_within_quota` constraint.

## Not yet built
See "Known limitations" and the backlog in STATUS.md: DPDP consent and deletion flows, refunds, notifications, Mappls and Ola adapters, real data and live-key verification of every external adapter.
