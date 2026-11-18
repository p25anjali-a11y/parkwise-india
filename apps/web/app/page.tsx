export const dynamic = "force-static";

export default function Home() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: 24 }}>
      <h1>Parkwise India</h1>
      <p><a href="/search">Find parking in Mumbai or Ahmedabad</a> · <a href="/login">Sign in</a></p>
      <p>Prices move with real occupancy, traffic, weather and events. When a lot has no fresh live data, you see its base tariff and we say so.</p>
    </main>
  );
}
