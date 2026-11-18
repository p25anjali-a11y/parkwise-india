import { describe, expect, it } from "vitest";
import { parseCalendarCsv, parseEventsCsv } from "./calendar";
import { OpenMeteoWeatherProvider, selectTrafficProvider, TomTomTrafficProvider } from "./signals";

const P = { lat: 19.07, lng: 72.87 };
const json = (o: unknown, status = 200) => (async () => new Response(JSON.stringify(o), { status })) as unknown as typeof fetch;

describe("open-meteo", () => {
  it("parses hourly rain probability into 0..1", async () => {
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ hourly: { time: ["2026-11-20T00:00", "2026-11-20T01:00", "2026-11-20T02:00"], precipitation_probability: [10, 85, null] } }));
    }) as unknown as typeof fetch;
    const r = await new OpenMeteoWeatherProvider(f).rainForecast(P, 24);
    expect(url).toContain("hourly=precipitation_probability");
    expect(r).toHaveLength(2);
    expect(r[1]!.probability).toBe(0.85);
    expect(r[1]!.validAt.toISOString()).toBe("2026-11-20T01:00:00.000Z");
  });
  it("rejects malformed and failed responses", async () => {
    await expect(new OpenMeteoWeatherProvider(json({})).rainForecast(P, 24)).rejects.toThrow("no hourly");
    await expect(new OpenMeteoWeatherProvider(json({}, 500)).rainForecast(P, 24)).rejects.toThrow("500");
  });
});

describe("tomtom", () => {
  it("turns speeds into a congestion index and uses the documented endpoint", async () => {
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return new Response(JSON.stringify({ flowSegmentData: { currentSpeed: 12, freeFlowSpeed: 40 } }));
    }) as unknown as typeof fetch;
    const r = await new TomTomTrafficProvider("k", f).congestionAt(P);
    expect(url).toContain("/traffic/services/4/flowSegmentData/absolute/10/json");
    expect(url).toContain("point=19.07,72.87");
    expect(r.congestionIndex).toBe(0.7);
  });
  it("clamps and rejects bad data", async () => {
    const fast = await new TomTomTrafficProvider("k", json({ flowSegmentData: { currentSpeed: 60, freeFlowSpeed: 40 } })).congestionAt(P);
    expect(fast.congestionIndex).toBe(0);
    await expect(new TomTomTrafficProvider("k", json({})).congestionAt(P)).rejects.toThrow("no flow data");
  });
  it("is absent without a key (no invented congestion)", () => {
    expect(selectTrafficProvider({})).toBeNull();
    expect(selectTrafficProvider({ TOMTOM_API_KEY: "x" })?.name).toBe("tomtom");
  });
});

describe("csv importers", () => {
  it("parses calendar rows and reports bad ones", () => {
    const r = parseCalendarCsv("starts_on,ends_on,name,kind,weight\n# comment\n2026-12-25,2026-12-25,Christmas,holiday,1\n2026-13-01,2026-12-01,Bad,holiday\n2026-11-20,2026-11-19,Backwards,holiday\n2026-11-20,2026-11-20,X,party\n");
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(3);
  });
  it("parses events and normalises timestamps", () => {
    const r = parseEventsCsv("city,name,venue,starts_at,ends_at,expected_attendance,impact\nMumbai,Match,Wankhede,2026-12-01T19:30:00+05:30,2026-12-01T23:30:00+05:30,33000,0.9\nMumbai,Bad,V,nope,2026-12-01T23:30:00+05:30,1,0.5\nMumbai,Hot,V,2026-12-01T10:00:00+05:30,2026-12-01T12:00:00+05:30,10,3\n");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]!.starts_at).toBe("2026-12-01T14:00:00.000Z");
    expect(r.errors).toHaveLength(2);
  });
});
