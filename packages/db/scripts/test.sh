#!/usr/bin/env bash
# Applies migrations to a scratch database and runs the SQL assertions.
# Usage:
#   packages/db/scripts/test.sh                 # starts a throwaway local cluster
#   DATABASE_URL=postgres://... packages/db/scripts/test.sh   # use an existing empty database (CI)
# If PostGIS is not installed, lines tagged "-- @postgis" are skipped and the run says so.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'cleanup' EXIT

cleanup() {
  if [[ -n "${PGDATA_DIR:-}" && -d "${PGDATA_DIR:-}" ]]; then
    runuser -u pgtest -- "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -m immediate stop >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK"
}

if [[ -z "${DATABASE_URL:-}" ]]; then
  PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
  id pgtest >/dev/null 2>&1 || useradd -m pgtest
  PGDATA_DIR="$WORK/data"
  mkdir -p "$PGDATA_DIR" && chown pgtest "$WORK" "$PGDATA_DIR" && chmod 755 "$WORK"
  runuser -u pgtest -- "$PGBIN/initdb" -D "$PGDATA_DIR" -A trust -U postgres >/dev/null
  runuser -u pgtest -- "$PGBIN/pg_ctl" -D "$PGDATA_DIR" -o "-p 54329 -k $WORK" -l "$WORK/pg.log" -w start >/dev/null
  DATABASE_URL="postgresql://postgres@127.0.0.1:54329/postgres"
fi

PSQL=(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q)

HAS_POSTGIS=$("${PSQL[@]}" -Atc "select count(*) from pg_available_extensions where name = 'postgis'")
prep() { if [[ "$HAS_POSTGIS" == "0" ]]; then grep -v -- '-- @postgis' "$1"; else cat "$1"; fi; }
[[ "$HAS_POSTGIS" == "0" ]] && echo "NOTE: PostGIS not available here; skipping lines tagged @postgis (geography column and GiST index are NOT validated)."

"${PSQL[@]}" -f "$HERE/tests/00_supabase_stub.sql"
for f in "$HERE"/migrations/*.sql; do
  echo "applying $(basename "$f")"
  prep "$f" | "${PSQL[@]}"
done
echo "loading TEST FIXTURE (synthetic, test database only)"
(echo "set app.allow_synthetic = 'on';"; prep "$HERE/tests/fixtures/test_fixture_synthetic.sql") | "${PSQL[@]}"
OUT="$WORK/assert.log"
for t in 10_assertions 20_reservations 30_feeds 40_onboarding; do
  if psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$HERE/tests/$t.sql" >"$OUT" 2>&1; then
    grep -E "PASS|ALL DB" "$OUT"
  else
    grep -E "PASS|FAIL|ERROR|CONTEXT" "$OUT" || cat "$OUT"
    exit 1
  fi
done
