"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { ensureMapWorker } from "../lib/maplibre";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { haversineKm } from "../lib/geo";
import { OSM_STYLE, mapsDirections, toneOf } from "../lib/map-style";
import { useT } from "./I18n";
import { ICON } from "./icons";

export type ExplorerLot = {
  id: string; name: string; category: string; lat: number; lng: number; km: number;
  /** Paise per hour, right now. */
  rate: number; label: string; simulated: boolean; hasEv: boolean; occ: number | null;
};
type Sort = "near" | "cheap" | "space";
const CATS = [["", "catAll"], ["mall", "catMall"], ["stadium", "catStadium"], ["hospital", "catHospital"], ["other", "catOther"]] as const;

export function SearchExplorer({ lots, centre, city, cities }: { lots: ExplorerLot[]; centre: { lat: number; lng: number }; city: string; cities: string[] }) {
  const { t, tl } = useT();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [ev, setEv] = useState(false);
  const [sort, setSort] = useState<Sort>("near");
  const [sel, setSel] = useState<string | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [geoErr, setGeoErr] = useState("");
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const youMarker = useRef<maplibregl.Marker | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = lots
      .filter((l) => (!cat || l.category === cat || (cat === "other" && !["mall", "stadium", "hospital"].includes(l.category))) && (!ev || l.hasEv) && (!needle || l.name.toLowerCase().includes(needle)))
      .map((l) => ({ ...l, d: me ? haversineKm(me, l) : l.km }));
    if (sort === "cheap") rows.sort((a, b) => a.rate - b.rate);
    else if (sort === "space") rows.sort((a, b) => (a.occ ?? 2) - (b.occ ?? 2));
    else rows.sort((a, b) => a.d - b.d);
    return rows;
  }, [lots, q, cat, ev, sort, me]);
  const cheapest = useMemo(() => Math.min(...lots.map((l) => l.rate)), [lots]);

  // Create the map once.
  useEffect(() => {
    if (!host.current) return;
    ensureMapWorker();
    const m = new maplibregl.Map({ container: host.current, style: OSM_STYLE, center: [centre.lng, centre.lat], zoom: 11, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [centre.lat, centre.lng]);

  // Redraw price pins when the visible set or the selection changes.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    for (const mk of markers.current) mk.remove();
    markers.current = shown.map((l) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `pin ${toneOf(l.label)}${l.id === sel ? " sel" : ""}`;
      el.textContent = `₹${Math.round(l.rate / 100)}`;
      el.setAttribute("aria-label", `${l.name}, ₹${Math.round(l.rate / 100)} ${t("perHour")}`);
      el.addEventListener("click", (e) => { e.stopPropagation(); setSel(l.id); document.getElementById(`lot-${l.id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" }); });
      return new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([l.lng, l.lat]).addTo(m);
    });
  }, [shown, sel, t]);

  // Fit the map to the results (not on every selection).
  const key = shown.map((s) => s.id).join(",");
  useEffect(() => {
    const m = map.current;
    if (!m || shown.length === 0) return;
    const b = new maplibregl.LngLatBounds();
    shown.forEach((l) => b.extend([l.lng, l.lat]));
    if (me) b.extend([me.lng, me.lat]);
    m.fitBounds(b, { padding: { top: 60, bottom: 90, left: 50, right: 50 }, maxZoom: 14, duration: 500 });
  }, [key, me]);

  function select(id: string) {
    setSel(id);
    const l = lots.find((x) => x.id === id);
    if (l && map.current) map.current.easeTo({ center: [l.lng, l.lat], zoom: Math.max(map.current.getZoom(), 13), duration: 450 });
  }

  function nearMe() {
    setGeoErr("");
    if (!navigator.geolocation) return setGeoErr(t("locationDenied"));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude };
        setMe(here);
        setSort("near");
        const dot = document.createElement("div");
        dot.className = "you";
        dot.setAttribute("role", "img");
        dot.setAttribute("aria-label", t("youAreHere"));
        youMarker.current?.remove();
        if (map.current) youMarker.current = new maplibregl.Marker({ element: dot }).setLngLat([here.lng, here.lat]).addTo(map.current);
      },
      () => setGeoErr(t("locationDenied")),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  const selected = shown.find((s) => s.id === sel) ?? null;
  const SORTS: [Sort, string][] = [["near", "sortNear"], ["cheap", "sortCheap"], ["space", "sortSpace"]];
  return (
    <main className="explorer">
      <section className="xmap" aria-label={t("mapLabel")}>
        <div ref={host} className="maphost" data-testid="lot-map" />
        <div className="mapctl">
          <button type="button" className="chip" onClick={nearMe}>{ICON.locate}&nbsp;{t("nearMe")}</button>
        </div>
        {selected && (
          <div className="pcard" data-testid="map-preview">
            <div className="rowb">
              <strong>{selected.name}</strong>
              <span className="price" style={{ fontSize: 22 }}>₹{Math.round(selected.rate / 100)}<small style={{ fontSize: 13 }}>{t("perHour")}</small></span>
            </div>
            <div className="rowb" style={{ marginTop: 8 }}>
              <span className={`pill ${toneOf(selected.label) === "good" ? "green" : toneOf(selected.label) === "warn" ? "orange" : toneOf(selected.label) === "bad" ? "red" : "grey"}`}>{tl(selected.label)}</span>
              <Link href={`/lots/${selected.id}`} className="btn" style={{ minHeight: 44 }}>{t("viewLot")}</Link>
            </div>
          </div>
        )}
      </section>
      <section className="xlist" aria-label={t("findTitle")}>
        <div className="xfilters">
          <div className="chips" role="group" aria-label={t("cityLabel")}>
            {cities.map((c) => <Link key={c} href={`/search?city=${c}`} className={c === city ? "chip on" : "chip"}>{c}</Link>)}
          </div>
          <div className="xsearch">
            {ICON.search}
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlace")} aria-label={t("searchPlace")} />
          </div>
          <div className="chips">
            {CATS.map(([k, key]) => <button key={k} type="button" className={cat === k ? "chip on" : "chip"} onClick={() => setCat(k)}>{t(key)}</button>)}
            <button type="button" className={ev ? "chip on" : "chip"} onClick={() => setEv(!ev)} aria-pressed={ev}>{t("evFilter")}</button>
          </div>
          <div className="chips" role="group" aria-label={t("sortLabel")}>
            {SORTS.map(([k, key]) => <button key={k} type="button" className={sort === k ? "chip on" : "chip"} onClick={() => setSort(k)}>{t(key)}</button>)}
          </div>
        </div>
        {geoErr && <p role="alert" className="err">{geoErr}</p>}
        <div className="xhead"><span className="muted">{t("placesCount", { n: shown.length })}</span></div>
        <p className="muted" style={{ marginTop: 0 }}>{t("simulatedNote")}</p>
        {shown.length === 0 && <div className="card">{t("noResults")}</div>}
        {shown.map((r) => (
          <div key={r.id} id={`lot-${r.id}`} data-testid="result" className={r.id === sel ? "lotrow sel" : "lotrow"} role="button" tabIndex={0} aria-pressed={r.id === sel}
            onClick={() => select(r.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(r.id); } }}>
            <div className="rowb">
              <h3 style={{ margin: 0 }}>{r.name}</h3>
              <span className="price">₹{Math.round(r.rate / 100)}<small style={{ fontSize: 14 }}>{t("perHour")}</small></span>
            </div>
            <div className="meta">{r.category} · {r.d.toFixed(1)} {me ? t("kmFromYou") : t("nearCentre")}</div>
            <span className={`pill ${toneOf(r.label) === "good" ? "green" : toneOf(r.label) === "warn" ? "orange" : toneOf(r.label) === "bad" ? "red" : "grey"}`}>{tl(r.label)}</span>{" "}
            {r.simulated && <span className="pill demo">{t("simulatedBadge")}</span>} {r.hasEv && <span className="pill orange">EV</span>} {r.rate === cheapest && <span className="pill green">{t("cheaper")}</span>}
            <div className="acts">
              <Link href={`/lots/${r.id}`} className="btn" onClick={(e) => e.stopPropagation()}>{t("viewLot")}</Link>
              <a href={mapsDirections(r.lat, r.lng)} target="_blank" rel="noopener noreferrer" className="chip" onClick={(e) => e.stopPropagation()}>{ICON.nav}&nbsp;{t("directions")}</a>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
