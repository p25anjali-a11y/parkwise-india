"""Forecast service STUB.

Implements the HTTP contract the web app can call (POST /forecast, GET /health) so a real model service
(gradient boosting, per-lot, retrained from capacity_snapshots) can replace it without changing callers.

This stub is NOT a trained model. It returns a persistence forecast (current occupancy carried forward) with an
interval that widens with the horizon, and says so in `modelVersion`. The TypeScript baseline in packages/forecast
is the model actually used today.

Run: python3 services/forecast/app.py   (stdlib only, port 8080)
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

MODEL_VERSION = "python-stub-persistence-v0"


def _parse_time(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def forecast(req: dict) -> dict:
    """Pure function so it can be unit tested without a server."""
    capacity = int(req["capacity"])
    if capacity <= 0:
        raise ValueError("capacity must be positive")
    target = _parse_time(req["targetTime"])
    now = _parse_time(req["now"]) if req.get("now") else datetime.now(timezone.utc)
    live = req.get("live")
    horizon_h = max(0.0, (target - now).total_seconds() / 3600)
    base = float(live["occupied"]) if live else capacity * 0.5
    sigma = capacity * min(0.35, 0.05 + 0.04 * horizon_h) if live else capacity * 0.3

    def clamp(x: float) -> int:
        return int(round(min(float(capacity), max(0.0, x))))

    p50 = clamp(base)
    p10 = clamp(base - 1.2816 * sigma)
    p90 = clamp(base + 1.2816 * sigma)
    z = (capacity - base) / sigma if sigma > 0 else 99.0
    p_full = round(0.5 * math.erfc(z / math.sqrt(2)), 4)
    free_p10 = capacity - p10
    label = "Probably full" if p_full >= 0.5 else "Tight" if (p_full >= 0.1 or free_p10 < capacity * 0.1) else "Likely space"
    return {
        "lotId": req["lotId"],
        "targetTime": target.isoformat().replace("+00:00", "Z"),
        "capacity": capacity,
        "p10": p10,
        "p50": p50,
        "p90": p90,
        "pFull": p_full,
        "confidence": label,
        "modelVersion": MODEL_VERSION,
        "coldStart": live is None,
        "stale": bool(req.get("feedAgeMin", 0) and req["feedAgeMin"] > 15),
    }


class Handler(BaseHTTPRequestHandler):
    def _send(self, status: int, payload: dict) -> None:
        data = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            self._send(200, {"status": "ok", "modelVersion": MODEL_VERSION, "isStub": True})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/forecast":
            return self._send(404, {"error": "not found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length > 100_000:
                return self._send(413, {"error": "too large"})
            self._send(200, forecast(json.loads(self.rfile.read(length))))
        except (KeyError, ValueError, TypeError, json.JSONDecodeError) as e:
            self._send(400, {"error": f"bad request: {e}"})


if __name__ == "__main__":
    HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
