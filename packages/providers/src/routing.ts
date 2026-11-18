export interface LatLng {
  lat: number;
  lng: number;
}

export interface EtaResult {
  /** Driving time in minutes, rounded up. */
  minutes: number;
  km: number;
  /** Which provider produced this. "mock" means an estimate, not a routing result. */
  provider: string;
  isMock: boolean;
  /** True when the provider accounted for live or predicted traffic. */
  trafficAware: boolean;
}

export interface RoutingProvider {
  readonly name: string;
  readonly isMock: boolean;
  eta(from: LatLng, to: LatLng, departAt?: Date): Promise<EtaResult>;
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * MOCK. Straight-line distance times a road factor at an assumed urban speed. Not a routing result,
 * and it knows nothing about traffic. Used when no routing key is configured.
 */
export class MockRoutingProvider implements RoutingProvider {
  readonly name = "mock";
  readonly isMock = true;
  constructor(private readonly roadFactor = 1.35, private readonly kmh = 22) {}
  async eta(from: LatLng, to: LatLng): Promise<EtaResult> {
    const km = haversineKm(from, to) * this.roadFactor;
    return { minutes: Math.max(1, Math.ceil((km / this.kmh) * 60)), km: Math.round(km * 10) / 10, provider: "mock", isMock: true, trafficAware: false };
  }
}

type Fetch = typeof fetch;

/**
 * Google Routes API (computeRoutes) with traffic-aware routing. Needs GOOGLE_MAPS_API_KEY with the Routes API enabled.
 * Verified against Google's published request and response shape; not yet exercised with a live key.
 */
export class GoogleRoutingProvider implements RoutingProvider {
  readonly name = "google";
  readonly isMock = false;
  constructor(private readonly apiKey: string, private readonly doFetch: Fetch = fetch) {}

  async eta(from: LatLng, to: LatLng, departAt?: Date): Promise<EtaResult> {
    const body: Record<string, unknown> = {
      origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
      destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
      travelMode: "DRIVE",
      routingPreference: "TRAFFIC_AWARE",
    };
    // Google rejects departure times in the past.
    if (departAt && departAt.getTime() > Date.now() + 60_000) body.departureTime = departAt.toISOString();
    const res = await this.doFetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": this.apiKey, "X-Goog-FieldMask": "routes.duration,routes.distanceMeters" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google Routes API ${res.status}`);
    const json = (await res.json()) as { routes?: { duration?: string; distanceMeters?: number }[] };
    const r = json.routes?.[0];
    const seconds = r?.duration ? Number.parseFloat(r.duration.replace("s", "")) : Number.NaN;
    if (!r || !Number.isFinite(seconds)) throw new Error("Google Routes API returned no route");
    return { minutes: Math.max(1, Math.ceil(seconds / 60)), km: Math.round(((r.distanceMeters ?? 0) / 1000) * 10) / 10, provider: "google", isMock: false, trafficAware: true };
  }
}

/** Wraps a provider so a failure degrades to the labelled mock estimate instead of breaking search. */
export class FallbackRoutingProvider implements RoutingProvider {
  readonly name: string;
  readonly isMock = false;
  constructor(private readonly primary: RoutingProvider, private readonly fallback: RoutingProvider = new MockRoutingProvider()) {
    this.name = `${primary.name}+fallback`;
  }
  async eta(from: LatLng, to: LatLng, departAt?: Date): Promise<EtaResult> {
    try {
      return await this.primary.eta(from, to, departAt);
    } catch {
      return this.fallback.eta(from, to, departAt);
    }
  }
}

/**
 * Picks a provider from environment. Mappls and Ola Maps adapters are NOT built yet (they need verified API
 * contracts and keys), so those keys are ignored and reported by `unsupported`.
 */
export function selectRoutingProvider(env: Record<string, string | undefined>, doFetch?: Fetch): { provider: RoutingProvider; unsupported: string[] } {
  const unsupported: string[] = [];
  if (env.MAPPLS_REST_KEY) unsupported.push("MAPPLS_REST_KEY (adapter not built)");
  if (env.OLA_MAPS_API_KEY) unsupported.push("OLA_MAPS_API_KEY (adapter not built)");
  if (env.GOOGLE_MAPS_API_KEY) return { provider: new FallbackRoutingProvider(new GoogleRoutingProvider(env.GOOGLE_MAPS_API_KEY, doFetch)), unsupported };
  return { provider: new MockRoutingProvider(), unsupported };
}
