# @parkwise/db

SQL migrations in `migrations/` (applied in order), assertions in `tests/`.

- `pnpm db:test` applies everything to a scratch Postgres and runs RLS, trigger and seed assertions.
- Locally PostGIS may be missing; lines tagged `-- @postgis` are skipped and CI validates them against a PostGIS image.
- All seeded rows are flagged `is_synthetic`.
