"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { freeRangeFromBays } from "../lib/availability-range";
import { useT } from "./I18n";
import { ICON } from "./icons";

type Eta = { minutes: number; km: number };
type Avail = { available: true; freeBays: { pessimistic: number; optimistic: number }; simulated?: boolean } | { available: false };

/**
 * On the map preview: how long it takes to get there from where you are, what time you will arrive, and roughly how many
 * spaces will be free then (a range). Needs your location, which is only asked for when you tap the button.
 */
export function ArrivalPreview({ lotId, me, onLocate }: { lotId: string; me: { lat: number; lng: number } | null; onLocate: () => void }) {
  const { t } = useT();
  const [eta, setEta] = useState<Eta | null>(null);
  const [av, setAv] = useState<Avail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setEta(null); setAv(null); setFailed(false);
    if (!me) return;
    let live = true;
    void (async () => {
      try {
        const r = await fetch(`/api/eta?lotId=${lotId}&lat=${me.lat}&lng=${me.lng}`);
        if (!r.ok) throw new Error("eta");
        const e = (await r.json()) as Eta;
        if (!live) return;
        setEta(e);
        const a = await fetch(`/api/availability?lotId=${lotId}&arrivalInMin=${Math.round(e.minutes / 5) * 5}`);
        if (live && a.ok) setAv((await a.json()) as Avail);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => { live = false; };
  }, [lotId, me?.lat, me?.lng]);
  if (!me) return <button type="button" className="chip" style={{ minHeight: 44, marginTop: 8 }} onClick={onLocate}>{ICON.locate}&nbsp;{t("needLocation")}</button>;
  if (failed) return <p className="muted" style={{ margin: "8px 0 0" }}>{t("etaFailed")}</p>;
  if (!eta) return <p className="muted" style={{ margin: "8px 0 0" }}>…</p>;
  const arrive = new Date(Date.now() + eta.minutes * 60_000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
  const [lo, hi] = av && av.available ? freeRangeFromBays(av.freeBays.pessimistic, av.freeBays.optimistic) : [0, 0];
  return (
    <div data-testid="arrival-preview" style={{ marginTop: 8 }}>
      <div className="rowb">
        <span><b>{eta.minutes} {t("minutes")}</b> · {eta.km} km</span>
        <span className="muted">{t("arriveBy", { time: arrive })}</span>
      </div>
      {av && av.available && hi > 0 && <p style={{ margin: "4px 0 0" }}>{t("spacesThen", { lo, hi })}{av.simulated ? <> <span className="pill demo">{t("simulatedBadge")}</span></> : null}</p>}
      <Link href={`/trip/${lotId}`} className="btn blue block" style={{ minHeight: 44, marginTop: 8 }}>{ICON.nav}&nbsp;{t("startNav")}</Link>
    </div>
  );
}
