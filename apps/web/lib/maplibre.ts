import * as maplibregl from "maplibre-gl";

let ready = false;
/** Call before creating a map. Points maplibre at the worker copied into /public by scripts/copy-maplibre-worker.mjs. */
export function ensureMapWorker() {
  if (ready) return;
  maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  ready = true;
}
