import { quote, DEFAULT_RULES } from "@parkwise/pricing";

export const dynamic = "force-static";

export default function Home() {
  // Smoke check that workspace packages resolve in the app. Demo numbers only.
  const q = quote({
    lotId: "demo",
    zoneId: "demo",
    rules: DEFAULT_RULES,
    predictedOccupancy: 0.72,
    arrivalTime: new Date("2026-01-01T12:00:00Z"),
    durationMin: 120,
  });
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <h1>Parkwise India</h1>
      <p><a href="/search">Find parking in Mumbai or Ahmedabad</a> · <a href="/login">Sign in</a></p>
      <p>
        Pricing package check (demo data, not a real lot): at 72% predicted occupancy, 2 hours costs ₹{(q.total / 100).toFixed(0)} ({q.multiplier}x).
      </p>
    </main>
  );
}
