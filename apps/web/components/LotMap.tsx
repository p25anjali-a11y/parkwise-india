"use client";
import "maplibre-gl/dist/maplibre-gl.css";
import * as maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

export type MapLot = { id: string; name: string; lat: number; lng: number; label: string };

/** Raster OpenStreetMap tiles for the demo. Swap for Mappls or Ola Maps tiles behind the routing provider later. */
const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

export function LotMap({ lots, centre }: { lots: MapLot[]; centre: { lat: number; lng: number } }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = new maplibregl.Map({ container: el.current, style: STYLE, center: [centre.lng, centre.lat], zoom: 10.5 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    for (const l of lots) {
      new maplibregl.Marker({ color: l.label === "Nearly full" ? "#c0392b" : l.label === "Tight" ? "#e67e22" : "#27ae60" })
        .setLngLat([l.lng, l.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<a href="/lots/${l.id}"><strong>${l.name.replace(/[<>&"]/g, "")}</strong></a><br/>${l.label}`))
        .addTo(map);
    }
    return () => map.remove();
  }, [lots, centre.lat, centre.lng]);
  return <div ref={el} data-testid="lot-map" style={{ height: 360, borderRadius: 8 }} />;
}
