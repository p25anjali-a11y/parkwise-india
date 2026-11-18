import unittest

from app import MODEL_VERSION, forecast

NOW = "2026-11-20T10:00:00Z"


class ForecastStubTest(unittest.TestCase):
    def test_persistence_with_ordered_bounded_quantiles(self):
        r = forecast({"lotId": "l", "capacity": 400, "targetTime": "2026-11-20T11:00:00Z", "now": NOW, "live": {"occupied": 200}})
        self.assertEqual(r["p50"], 200)
        self.assertLessEqual(r["p10"], r["p50"])
        self.assertLessEqual(r["p50"], r["p90"])
        self.assertLessEqual(r["p90"], 400)
        self.assertGreaterEqual(r["p10"], 0)
        self.assertEqual(r["modelVersion"], MODEL_VERSION)

    def test_interval_widens_with_horizon(self):
        near = forecast({"lotId": "l", "capacity": 400, "targetTime": "2026-11-20T10:15:00Z", "now": NOW, "live": {"occupied": 200}})
        far = forecast({"lotId": "l", "capacity": 400, "targetTime": "2026-11-20T16:00:00Z", "now": NOW, "live": {"occupied": 200}})
        self.assertGreater(far["p90"] - far["p10"], near["p90"] - near["p10"])

    def test_full_lot_is_probably_full(self):
        r = forecast({"lotId": "l", "capacity": 100, "targetTime": "2026-11-20T10:30:00Z", "now": NOW, "live": {"occupied": 100}})
        self.assertEqual(r["confidence"], "Probably full")
        self.assertGreaterEqual(r["pFull"], 0.4)

    def test_no_live_count_is_cold_start(self):
        r = forecast({"lotId": "l", "capacity": 100, "targetTime": "2026-11-20T10:30:00Z", "now": NOW})
        self.assertTrue(r["coldStart"])

    def test_stale_flag_and_validation(self):
        r = forecast({"lotId": "l", "capacity": 100, "targetTime": NOW, "now": NOW, "live": {"occupied": 10}, "feedAgeMin": 30})
        self.assertTrue(r["stale"])
        with self.assertRaises(ValueError):
            forecast({"lotId": "l", "capacity": 0, "targetTime": NOW})


if __name__ == "__main__":
    unittest.main()
