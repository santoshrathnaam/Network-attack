"""
Smoke and Integration Tests for Module 2 Threat Forecasting.

Run with:
    python -m unittest module2_forecast.tests.test_forecast -v
"""

import unittest
from shared import config
from module1_traffic.baseline import AdaptiveBaseline
from module1_traffic.feature_extractor import process_traffic
from module1_traffic.traffic_generator import generate_demo_traffic

from module2_forecast.model import ThreatModel
from module2_forecast.trajectory import TrajectoryTracker
from module2_forecast.predictor import ThreatPredictor, predict, reset_default_predictor

# Import Module 3 input contract to ensure exact inter-module compatibility
from module3.schemas import ThreatStateInput


class Module2ModelTests(unittest.TestCase):
    def test_threat_score_weights_sum_to_one(self):
        total_weight = sum(config.THREAT_SCORE_WEIGHTS.values())
        self.assertAlmostEqual(total_weight, 1.0, places=4)

    def test_quiet_traffic_produces_low_threat_score(self):
        model = ThreatModel()
        anomalies = {"traffic": 0.05, "syn": 0.02, "source": 0.04, "connection": 0.03}
        features = {"syn_rate": 0.10, "port_entropy": 0.5, "failed_connections": 0}
        
        assessment = model.evaluate(anomalies, features)
        self.assertLess(assessment.threat_score, 0.20)
        self.assertEqual(assessment.threat_momentum, 0.0)

    def test_escalating_anomalies_increase_momentum(self):
        model = ThreatModel()
        features = {"syn_rate": 0.85, "port_entropy": 1.2, "failed_connections": 10}

        # First quiet window
        a1 = model.evaluate({"traffic": 0.1, "syn": 0.1, "source": 0.1, "connection": 0.1}, features)
        # Second spiked window
        a2 = model.evaluate({"traffic": 0.8, "syn": 0.9, "source": 0.7, "connection": 0.8}, features)

        self.assertGreater(a2.threat_score, a1.threat_score)
        self.assertGreater(a2.threat_momentum, 0.2)


class Module2TrajectoryTests(unittest.TestCase):
    def test_stage_transition_boundaries(self):
        tracker = TrajectoryTracker()
        features = {"syn_rate": 0.2, "failed_connections": 0}
        anomalies = {"syn": 0.1, "traffic": 0.1, "source": 0.1, "connection": 0.1}

        tf1 = tracker.evaluate_trajectory(0.10, 0.0, features, anomalies)
        self.assertEqual(tf1.current_stage, "NORMAL")

        tf2 = tracker.evaluate_trajectory(0.35, 0.05, features, anomalies)
        self.assertEqual(tf2.current_stage, "ANOMALY")

        tf3 = tracker.evaluate_trajectory(0.55, 0.05, features, anomalies)
        self.assertEqual(tf3.current_stage, "SCANNING")

        tf4 = tracker.evaluate_trajectory(0.78, 0.05, features, anomalies)
        self.assertEqual(tf4.current_stage, "ATTACK IMMINENT")

        tf5 = tracker.evaluate_trajectory(0.92, 0.02, features, anomalies)
        self.assertEqual(tf5.current_stage, "DDoS")


class Module2PredictorIntegrationTests(unittest.TestCase):
    def setUp(self):
        reset_default_predictor()

    def test_predict_output_contract_shape(self):
        predictor = ThreatPredictor()
        m1_sample = {
            "timestamp": "2026-08-26T19:05:00",
            "baseline_ready": True,
            "features": {
                "packets_per_second": 1840,
                "bytes_per_second": 284000,
                "avg_packet_size": 154.3,
                "unique_source_ips": 73,
                "unique_destination_ips": 8,
                "syn_rate": 0.82,
                "failed_connections": 143,
                "connection_rate": 912,
                "port_entropy": 4.72,
            },
            "anomalies": {
                "traffic": 0.72,
                "syn": 0.81,
                "source": 0.64,
                "connection": 0.77,
            },
        }

        forecast = predictor.predict(m1_sample)

        required_keys = {
            "timestamp",
            "threat_score",
            "threat_momentum",
            "attack_probability",
            "predicted_attack",
            "current_stage",
            "next_stage",
            "time_to_escalation_minutes",
            "affected_asset",
            "evidence",
            "forecast_probabilities",
        }
        self.assertTrue(required_keys.issubset(set(forecast.keys())))

    def test_hand_off_contract_validates_with_module3_pydantic_schema(self):
        """Verify Module 2 payload passes Module 3's ThreatStateInput schema validation strictly."""
        predictor = ThreatPredictor()
        m1_sample = {
            "timestamp": "2026-08-26T19:05:00",
            "baseline_ready": True,
            "features": {"syn_rate": 0.9, "failed_connections": 50},
            "anomalies": {"traffic": 0.8, "syn": 0.9, "source": 0.7, "connection": 0.85},
        }

        payload = predictor.predict(m1_sample)

        # Validate with Module 3 ThreatStateInput
        parsed_schema = ThreatStateInput(**payload)
        self.assertGreaterEqual(parsed_schema.threat_score, 0.0)
        self.assertLessEqual(parsed_schema.threat_score, 1.0)
        self.assertEqual(parsed_schema.attack_type, payload["predicted_attack"].upper())

    def test_full_demo_stream_integration(self):
        """Run standard demo stream through Module 1 & Module 2 end to end."""
        baseline = AdaptiveBaseline()
        predictor = ThreatPredictor()

        results = []
        for stage_label, records in generate_demo_traffic():
            m1_out = process_traffic(records, baseline=baseline)
            forecast = predictor.predict(m1_out)
            results.append((stage_label, forecast["threat_score"], forecast["current_stage"]))

        # First stage should be low threat, last stage should be high threat DDoS
        self.assertLess(results[0][1], 0.35)
        self.assertGreater(results[-1][1], 0.75)
        self.assertEqual(results[-1][2], "DDoS")


if __name__ == "__main__":
    unittest.main()
