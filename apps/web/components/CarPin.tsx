"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "./I18n";

export function CarPin({ reservationId, note: n0, lat: la0, lng: ln0 }: { reservationId: string; note?: string | null; lat?: number | null; lng?: number | null }) {
  const { t } = useT();
  const router = useRouter();
  const [note, setNote] = useState(n0 ?? "");
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(la0 != null && ln0 != null ? { lat: la0, lng: ln0 } : null);
  const [msg, setMsg] = useState("");
  function locate() {
    navigator.geolocation?.getCurrentPosition((p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setMsg("Location permission was denied."), { enableHighAccuracy: true });
  }
  async function save() {
    const r = await fetch("/api/pin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId, note: note || undefined, lat: pos?.lat, lng: pos?.lng }) });
    setMsg(r.ok ? t("pinSaved") : (await r.json()).error ?? "Error");
    if (r.ok) router.refresh();
  }
  return (
    <div data-testid="car-pin" style={{ marginTop: 10 }}>
      <strong>📍 {t("findCar")}</strong>
      <label className="f" style={{ marginTop: 8 }}>{t("carNote")}<input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="chips">
        <button type="button" className="chip" onClick={locate}>🛰️ {t("useLocation")}{pos ? " ✓" : ""}</button>
        <button type="button" className="chip on" onClick={save}>{t("savePin")}</button>
        {pos && <a className="chip" href={`https://www.google.com/maps/dir/?api=1&destination=${pos.lat},${pos.lng}&travelmode=walking`} target="_blank" rel="noreferrer">🚶 {t("openMap")}</a>}
      </div>
      {msg && <p role="status" className="muted">{msg}</p>}
    </div>
  );
}
