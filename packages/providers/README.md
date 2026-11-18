# @parkwise/providers

Provider interfaces with labelled mocks and real adapters.

| Interface | Implementations | Status |
|---|---|---|
| `RoutingProvider` | `MockRoutingProvider` (estimate, labelled), `GoogleRoutingProvider` (Routes API, traffic-aware), `FallbackRoutingProvider` | Google adapter written to the published contract and unit-tested with a fake fetch; **not yet run with a live key** |
| Mappls, Ola Maps routing | not built | Need verified API contracts and keys; `selectRoutingProvider` reports these keys as unsupported |
| `TrafficSignalProvider`, `ParkingFeedProvider`, events | not built | Milestones 9 and 10 |
