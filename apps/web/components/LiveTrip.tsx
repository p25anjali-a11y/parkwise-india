"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { ensureMapWorker } from "../lib/maplibre";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { haversineKm } from "../lib/geo";
import { OSM_STYLE, mapsDirections } from "../lib/map-style";
import { AvailabilityAtArrival } from "./AvailabilityAtArrival";
import { useT } from "./I18n";
import { ICON } from "./icons";

type Eta = { minutes: number; km: number; provider: string; isMock: boolean; trafficAware: boolean };
type Pos = { lat: number; lng: number };
const ETA_EVERY_MS = 30_000;
const ARRIVED_KM = 0.15;
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

/**
 * Live trip: your position, the lot, the drive time and the space expected when you arrive.
 * Location is read only after you tap Start and only while this screen is open. The line on the map is straight, not a road route;
 * turn-by-turn is handed to your maps app.
 */
export function LiveTrip({ lot }: { lot: { id: string; name: string; lat: number; lng: number } }) {
  const { t } = useT();
  const [pos, setPos] = useState<Pos | null>(null);
  const [eta, setEta] = useState<Eta | null>(null);
  const [etaAt, setEtaAt] = useState(0);
  const [err, setErr] = useState("");
  const [on, setOn] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const you = useRef<maplibregl.Marker | null>(null);
  const watch = useRef<number | null>(null);
  const last = useRef(0);

  useEffect(() => {
    if (!host.current) return;
    ensureMapWorker();
    const m = new maplibregl.Map({ container: host.current, style: OSM_STYLE, center: [lot.lng, lot.lat], zoom: 14, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const el = document.createElement("div");
    el.className = "pin good sel";
    el.textContent = "P";
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", lot.name);
    new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([lot.lng, lot.lat]).addTo(m);
    m.on("load", () => {
      m.addSource("path", { type: "geojson", data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [] } } });
      m.addLayer({ id: "path", type: "line", source: "path", paint: { "line-color": "#c9a96a", "line-width": 3, "line-dasharray": [2, 2] } });
    });
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [lot.lat, lot.lng, lot.name]);

  const fetchEta = useCallback(async (p: Pos) => {
    last.current = Date.now();
    try {
      const r = await fetch(`/api/eta?lotId=${lot.id}&lat=${p.lat}&lng=${p.lng}`);
      if (!r.ok) throw new Error("eta");
      setEta(await r.json());
      setEtaAt(Date.now());
      setErr("");
    } catch {
      setErr(t("etaFailed"));
    }
  }, [lot.id, t]);

  // New position: move the dot, redraw the line, refit, and refresh the ETA at most every 30 s.
  useEffect(() => {
    const m = map.current;
    if (!pos || !m) return;
    if (!you.current) {
      const dot = document.createElement("div");
      dot.className = "you";
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", t("youAreHere"));
      you.current = new maplibregl.Marker({ element: dot }).setLngLat([pos.lng, pos.lat]).addTo(m);
    } else you.current.setLngLat([pos.lng, pos.lat]);
    const draw = () => {
      const src = m.getSource("path") as maplibregl.GeoJSONSource | undefined;
      src?.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: [[pos.lng, pos.lat], [lot.lng, lot.lat]] } });
    };
    if (m.isStyleLoaded()) draw(); else m.once("load", draw);
    m.fitBounds(new maplibregl.LngLatBounds([pos.lng, pos.lat], [lot.lng, lot.lat]), { padding: 70, maxZoom: 16, duration: 600 });
    if (Date.now() - last.current >= ETA_EVERY_MS) void fetchEta(pos);
  }, [pos, lot.lat, lot.lng, fetchEta, t]);

  function start() {
    setErr("");
    if (!navigator.geolocation) return setErr(t("locationDenied"));
    setOn(true);
    watch.current = navigator.geolocation.watchPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => { setErr(t("locationDenied")); setOn(false); },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20_000 },
    );
  }
  function stop() {
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    watch.current = null;
    setOn(false);
    you.current?.remove();
    you.current = null;
    setPos(null);
  }
  useEffect(() => () => { if (watch.current !== null) navigator.geolocation.clearWatch(watch.current); }, []);

  // Keep the countdown honest between ETA refreshes.
  const [tick, setTick] = useState(0);
  useEffect(() => { const i = setInterval(() => setTick((n) => n + 1), 15_000); return () => clearInterval(i); }, []);
  void tick;
  const minsLeft = eta ? Math.max(0, eta.minutes - Math.floor((Date.now() - etaAt) / 60_000)) : null;
  const arrivesAt = minsLeft !== null ? clock(Date.now() + minsLeft * 60_000) : null;
  const dist = pos ? haversineKm(pos, lot) : null;
  const arrived = dist !== null && dist < ARRIVED_KM;

  function share() {
    const text = t("shareEtaText", { lot: lot.name, time: arrivesAt ?? "", min: minsLeft ?? "" });
    if (typeof navigator.share === "function") void navigator.share({ text }).catch(() => undefined);
    else window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="tripmap"><div ref={host} className="maphost" data-testid="trip-map" /></div>
      {!on && (
        <div className="card">
          <h2>{t("tripStartTitle")}</h2>
          <p className="muted">{t("tripPrivacy")}</p>
          <button type="button" className="btn block" onClick={start}>{ICON.locate}&nbsp;{t("tripStart")}</button>
          <a href={mapsDirections(lot.lat, lot.lng)} target="_blank" rel="noopener noreferrer" className="btn ghost block" style={{ marginTop: 8 }}>{t("openInMaps")}</a>
        </div>
      )}
      {on && (
        <>
          {arrived && (
            <div className="banner" role="status" data-testid="arrived">
              <strong>{t("arrivedTitle")}</strong>
              <p className="muted" style={{ margin: "4px 0 10px" }}>{t("arrivedSub")}</p>
              <Link href="/driver/reservations" className="btn block">{t("showPass")}</Link>
            </div>
          )}
          <div className="card" data-testid="trip-eta">
            {eta && minsLeft !== null ? (
              <>
                <div className="bigeta"><b>{minsLeft}</b><span>{t("minutes")}</span>{arrivesAt && <span>· {t("arriveBy", { time: arrivesAt })}</span>}</div>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {dist !== null ? `${dist.toFixed(1)} km ${t("straightLine")} · ` : ""}{eta.km} km {t("byRoad")}
                  {eta.isMock ? ` · ${t("etaRough")}` : eta.trafficAware ? ` · ${t("etaTraffic")}` : ""}
                </p>
              </>
            ) : <p className="muted" style={{ margin: 0 }}>{t("locating")}</p>}
          </div>
          {eta && <div className="card"><h2>{t("atArrival")}</h2><AvailabilityAtArrival lotId={lot.id} arrivalInMin={Math.max(0, Math.round((minsLeft ?? eta.minutes) / 5) * 5)} /></div>}
          <div className="card">
            <div style={{ display: "grid", gap: 8 }}>
              <a href={mapsDirections(lot.lat, lot.lng)} target="_blank" rel="noopener noreferrer" className="btn block">{ICON.nav}&nbsp;{t("openInMaps")}</a>
              <button type="button" className="btn ghost block" onClick={share} disabled={!arrivesAt}>{ICON.share}&nbsp;{t("shareEta")}</button>
              <button type="button" className="btn ghost block" onClick={stop}>{t("tripStop")}</button>
            </div>
            <p className="muted" style={{ marginBottom: 0 }}>{t("tripNote")}</p>
          </div>
        </>
      )}
      {err && <p role="alert" className="err">{err}</p>}
    </div>
  );
}
