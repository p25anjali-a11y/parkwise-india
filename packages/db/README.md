# @parkwise/db

SQL migrations in `migrations/` (applied in order), assertions in `tests/`.

- `pnpm db:test` applies everything to a scratch Postgres and runs RLS, trigger and seed assertions.
- Locally PostGIS may be missing; lines tagged `-- @postgis` are skipped and CI validates them against a PostGIS image.
- The demo seed is a test fixture only (`tests/fixtures/`). Migration 0006 purges it from real databases and blocks synthetic lots from being inserted outside a test session.
