import type { StyleSpecification } from "maplibre-gl";

/** Raster OpenStreetMap tiles for the demo. Swap for Mappls or Ola Maps tiles behind the routing provider later. */
export const OSM_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-brightness-max": 0.62, "raster-saturation": -0.45, "raster-contrast": 0.1 } }],
};

export type Tone = "good" | "warn" | "bad" | "none";
export const toneOf = (label: string): Tone => (label === "Nearly full" ? "bad" : label === "Tight" ? "warn" : label === "Likely space" ? "good" : "none");
export const mapsDirections = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
