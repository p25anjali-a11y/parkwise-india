# Data sources

Nothing below is integrated yet. Rows describe the plan and what still has to be verified. "Real or mock" will be updated as each adapter lands. Do not treat any row as working until it says **real, verified**.

| Source | Purpose | Method | Refresh | Cost | ToS status | Real or mock |
|---|---|---|---|---|---|---|
| Operator webhook (HMAC) | Entry and exit events | Partner / first-party | Real time | None | Contract with operator | Built: signed (timestamp.body HMAC-SHA256), 5-min replay window, idempotent; DB path tested. Secrets stored AES-256-GCM encrypted. No operator is connected yet |
| CSV upload | Lots with no tech | First-party | Manual | None | n/a | Built (absolute counts; stale snapshots do not overwrite newer live state) |
| FASTag (NETC) | Entry and exit via tag reads | Partner (acquirer or operator) | Real time | Commercial agreement | Needs agreement | Stub only (always throws; labelled "requires partnership") |
| Park+ / Parkr style vendors | Occupancy from vendor systems | Partner | Unknown | Unknown | **Requires partnership**; no public API assumed | Stub only, planned |
| Mappls | Predictive ETA, walking distance | API | Per request, cached 5-min buckets | Free tier then paid; verify | Verify storage terms before keeping responses beyond cache window | Not built |
| Ola Maps | Traffic-aware ETA, two-wheeler | API | Per request | Free tier limits have changed over time; verify current | Verify | Not built |
| Google Distance Matrix | Optional routing | API | Per request | Paid | Verify | Adapter built (Routes API), unit-tested with fake fetch, not run with a live key |
| HERE or TomTom traffic | Congestion near each lot | API | 2 to 5 min | Free tier then paid; verify | Verify | TomTom adapter built (Flow Segment Data), unit-tested with fake fetch, not run with a live key. HERE not built. No key means no congestion signal (nothing invented) |
| TomTom Parking Availability | Third-party availability | API | About 10 min | Paid | Enable only if the market-coverage endpoint lists India | Not built |
| Open-Meteo | Rain forecast | API, no key | Hourly | Free for non-commercial use only; commercial launch needs a paid plan or another provider | Verify | Adapter built (hourly precipitation probability), unit-tested with fake fetch; not yet run against the live API from this environment |
| India calendar, festivals, IPL dates | Day-type effects | Manual admin table | As edited | None | n/a | Not built |
| Events | Demand spikes | Manual entry first; scrape only where robots.txt and ToS allow | Daily | None | Do not scrape BookMyShow, District or similar if they forbid it | Not built |
| Municipal smart-parking feeds (NDMC, ParkHyderabad, Chennai, Gurugram, BMC, Ahmedabad) | Context, possible partners | Research | n/a | n/a | Do not scrape official apps | Research pending |

## Real signals, simulated lots (optional demo)
Weather and traffic are always live and real. Parking lots and their occupancy are real when an operator supplies them. For demos there is one explicit, labelled exception: `packages/db/seed/simulated_lots.sql` adds 12 lots named "[SIMULATED] ..." (flagged `is_synthetic`). Their occupancy is never stored; the app computes it on read from the real clock, live rain probability and real event windows (`apps/web/lib/simulated-occupancy.ts`), and every page and saved quote says SIMULATED. Real lots can never fall back to a simulation, forecasts are never trained on it, and `seed/remove_simulated_lots.sql` hides it again. The rest of this section describes real lots.

The app never loads synthetic data otherwise. The demo seed now lives in `packages/db/tests/fixtures/` and is loaded only by `pnpm db:test`; a database trigger refuses synthetic lots elsewhere. `packages/forecast/src/synthetic.ts` is a test fixture and is not exported.

### Freshness limits (packages/pricing/src/freshness.ts)
| Input | Max age | Real source |
|---|---|---|
| Live occupancy | 30 min | Partner feed (webhook or CSV) or our own reservations |
| Occupancy forecast | 3 h since generated | Fitted from that lot's real snapshots; not used when stale or cold-start |
| Traffic | 30 min, and arrival within 60 min | TomTom flow (needs key) |
| Weather | 3 h | Open-Meteo (no key; free tier is non-commercial) |
Older data counts as missing. Each quote records which inputs were used, stale or missing (`price_quotes.data_inputs`).

### Public sources checked on 19 Nov 2026
- TomTom Parking Availability: 10-minute refresh, sales-only access; India coverage not confirmed. TomTom traffic flow lists India.
- HERE Parking, Parkopedia: commercial; India coverage not confirmed.
- ParkNav: North America and Europe only.
- Google Maps Platform: a PLENTY / SOMEWHAT_DIFFICULT / DIFFICULT rating in the Geocoding API (EEA-documented); no live occupancy.
- MCGM open parking data v1.1: static lots, capacities and tariffs; no live occupancy; age and licence unstated. Not loaded.
- Ahmedabad AMC / AmdaPark: availability and booking in AMC's app, no public API found.

## Onboarding a real lot
1. Fill `docs/templates/lots.csv` (name, city, address, category, coordinates, car capacity, base rate, optional municipal cap, operator, `data_source`, `data_as_of`) and import it on the admin page ("Real lots"). Every lot shows its source and date to drivers.
2. Send occupancy: upload `docs/templates/occupancy.csv` on the lot's Integrations page, or connect the signed webhook. The first count creates the live state; until then the lot shows "No live availability" and its base tariff.
3. Add real events and holidays on the same admin page.
