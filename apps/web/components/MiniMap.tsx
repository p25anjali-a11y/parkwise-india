"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { ensureMapWorker } from "../lib/maplibre";
import { useEffect, useRef } from "react";
import { OSM_STYLE, toneOf } from "../lib/map-style";

/** Small non-draggable map with one price pin, for the lot page. */
export function MiniMap({ lat, lng, label, rate, name }: { lat: number; lng: number; label: string; rate: number; name: string }) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!host.current) return;
    ensureMapWorker();
    const m = new maplibregl.Map({ container: host.current, style: OSM_STYLE, center: [lng, lat], zoom: 14.5, attributionControl: { compact: true } });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    const el = document.createElement("div");
    el.className = `pin ${toneOf(label)} sel`;
    el.textContent = `₹${Math.round(rate / 100)}`;
    el.setAttribute("role", "img");
    el.setAttribute("aria-label", name);
    new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([lng, lat]).addTo(m);
    return () => m.remove();
  }, [lat, lng, label, rate, name]);
  return <div className="minimap"><div ref={host} className="maphost" data-testid="lot-minimap" /></div>;
}
