"""
test_simulator.py: Unit tests for Module 3 Counterfactual Simulator
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

import unittest
from counterfactual import simulate
from simulator import StateTransitionModel, CounterfactualSimulator


class TestCounterfactualSimulator(unittest.TestCase):

    def setUp(self):
        self.sample_input = {
            "current_risk": 0.87,
            "momentum": 0.18,
            "current_stage": "SCANNING",
            "affected_asset": "API_GATEWAY"
        }

    def test_simulate_output_schema(self):
        result = simulate(self.sample_input)
        self.assertIn("current_risk", result)
        self.assertIn("scenarios", result)
        self.assertIn("recommended_action", result)
        self.assertIn("risk_reduction", result)
        self.assertEqual(result["current_risk"], 0.87)

    def test_scenarios_evaluation(self):
        result = simulate(self.sample_input)
        scenarios = result["scenarios"]
        self.assertGreaterEqual(len(scenarios), 3)

        actions = [s["action"] for s in scenarios]
        self.assertIn("NO_ACTION", actions)
        self.assertIn("BLOCK_SOURCES", actions)
        self.assertIn("ISOLATE_SERVER", actions)

    def test_risk_clamping(self):
        model = StateTransitionModel()
        extreme_risk = model.compute_future_risk(
            current_risk=0.99,
            momentum=0.5,
            stage="IMPACT",
            action="NO_ACTION",
            horizon_minutes=10.0
        )
        self.assertLessEqual(extreme_risk, 1.0)
        self.assertGreaterEqual(extreme_risk, 0.0)

    def test_mitigation_effect(self):
        result = simulate(self.sample_input)
        scenario_map = {s["action"]: s["risk_5min"] for s in result["scenarios"]}
        
        # NO_ACTION risk should be higher than defensive interventions
        self.assertGreater(scenario_map["NO_ACTION"], scenario_map["BLOCK_SOURCES"])
        self.assertGreater(scenario_map["BLOCK_SOURCES"], scenario_map["ISOLATE_SERVER"])
        
        # Recommended action should minimize risk
        self.assertEqual(result["recommended_action"], "ISOLATE_SERVER")
        self.assertGreater(result["risk_reduction"], 0.0)


if __name__ == "__main__":
    unittest.main()
