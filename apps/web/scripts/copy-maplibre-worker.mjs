// maplibre-gl 6 looks for its worker next to the file that imports it. A bundled Next.js app has no such sibling, so the
// worker fails to load and tiles never draw. Serve the worker from /public and point maplibre at it (see lib/maplibre.ts).
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");
mkdirSync(out, { recursive: true });
copyFileSync(join(dist, "maplibre-gl-worker.mjs"), join(out, "maplibre-gl-worker.mjs"));
