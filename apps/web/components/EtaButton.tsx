"use client";
import { useState } from "react";

type Eta = { minutes: number; km: number; provider: string; isMock: boolean; trafficAware: boolean };

export function EtaButton({ lotId }: { lotId: string }) {
  const [eta, setEta] = useState<Eta | null>(null);
  const [err, setErr] = useState("");
  function go() {
    setErr("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const r = await fetch(`/api/eta?lotId=${lotId}&lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`);
        if (r.ok) setEta(await r.json());
        else setErr("Could not get an ETA right now.");
      },
      () => setErr("Location permission is needed to estimate your drive."),
    );
  }
  return (
    <div>
      <button onClick={go}>Estimate my drive time</button>
      {eta && (
        <p data-testid="eta">
          About {eta.minutes} min ({eta.km} km){eta.isMock ? " · rough estimate, no live routing configured" : eta.trafficAware ? " · includes traffic" : ""}
        </p>
      )}
      {err && <p role="alert">{err}</p>}
    </div>
  );
}
