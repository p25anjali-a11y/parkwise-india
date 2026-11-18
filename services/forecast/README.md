# Forecast service (stub)

Python HTTP service implementing the forecast contract. **It is a stub, not a trained model.** It returns a persistence
forecast (current count carried forward) with an interval that widens over the horizon, labelled `python-stub-persistence-v0`.

The model used today is the TypeScript baseline in `packages/forecast`. This service exists so a real model
(per-lot gradient boosting retrained from `capacity_snapshots`) can drop in behind the same contract.

```
python3 services/forecast/app.py                 # port 8080, stdlib only
cd services/forecast && python3 -m unittest -q   # tests
```

`POST /forecast` body: `{lotId, capacity, targetTime, now?, live?: {occupied}, feedAgeMin?}` → quantiles `p10/p50/p90`, `pFull`, `confidence`, `modelVersion`, `coldStart`, `stale`.
`GET /health` → `{status, modelVersion, isStub: true}`.

The web app calls it through `HttpForecastService` in `packages/forecast` when `FORECAST_SERVICE_URL` is set (not wired into the cron yet).
