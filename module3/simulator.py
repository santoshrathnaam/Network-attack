"""
simulator.py: Future Risk Engine & Counterfactual Simulator
============================================================
Simulates the forward evolution of cyber threat states under multiple defensive
actions across prediction horizons (+2m, +5m, +10m) using a deterministic,
transparent, and explainable transition model.
"""

import os
import yaml
from pathlib import Path
from typing import Dict, Any, List, Optional

from .state import ThreatState, AttackStage
from .action_model import DefensiveAction, ActionCatalog
from .scenarios import (
    HorizonState,
    CounterfactualScenario,
    CounterfactualTree,
    ScenarioManager
)


class FutureRiskSimulator:
    """
    Core simulation engine executing the state transition formula:
      future_risk = current_risk + attack_progression + momentum_effect - defensive_effect
    """

    def __init__(
        self,
        config_path: Optional[str] = None,
        custom_config: Optional[Dict[str, Any]] = None
    ):
        self.config = self._load_config(config_path, custom_config)
        self.horizons = self.config["simulation"]["horizons"]
        self.horizon_minutes: Dict[str, float] = self.config["simulation"]["horizon_minutes"]
        self.clamp_min: float = float(self.config["simulation"].get("clamp_min", 0.0))
        self.clamp_max: float = float(self.config["simulation"].get("clamp_max", 1.0))
        
        # Load Action Catalog
        self.action_catalog = ActionCatalog(self.config.get("action_effects", {}))
        self.scenario_manager = ScenarioManager(self.action_catalog, self.horizons)

    def _load_config(
        self,
        config_path: Optional[str],
        custom_config: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Loads configuration from YAML file or falls back to sensible defaults.
        """
        if custom_config:
            return custom_config

        if not config_path:
            # Look in the same directory as this module
            config_path = os.path.join(os.path.dirname(__file__), "config.yaml")

        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f:
                return yaml.safe_load(f)

        # Fallback default configuration dictionary
        return {
            "simulation": {
                "horizons": ["2m", "5m", "10m"],
                "horizon_minutes": {"2m": 2.0, "5m": 5.0, "10m": 10.0},
                "primary_horizon": "10m",
                "clamp_min": 0.0,
                "clamp_max": 1.0
            },
            "dynamics": {
                "baseline_growth_rate_per_min": 0.010,
                "momentum_factor": 0.055,
                "stage_progression_factor": 0.015,
                "decay_damping_factor": 0.92
            },
            "action_effects": {},
            "stage_transitions": {},
            "confidence_scoring": {}
        }

    def simulate(self, seed_state: ThreatState) -> CounterfactualTree:
        """
        Executes counterfactual simulation for all enabled defensive actions.
        Returns a populated CounterfactualTree.
        """
        tree = self.scenario_manager.create_empty_tree(seed_state)

        for action, scenario in tree.scenarios.items():
            self._simulate_action_trajectory(seed_state, action, scenario)

        return tree

    def _simulate_action_trajectory(
        self,
        seed_state: ThreatState,
        action: DefensiveAction,
        scenario: CounterfactualScenario
    ):
        """
        Simulates threat progression for a single defensive action across all horizons.
        """
        current_risk = seed_state.threat_score
        momentum = seed_state.momentum
        dynamics = self.config.get("dynamics", {})
        
        baseline_rate = float(dynamics.get("baseline_growth_rate_per_min", 0.010))
        momentum_factor = float(dynamics.get("momentum_factor", 0.055))
        stage_factor = float(dynamics.get("stage_progression_factor", 0.015))
        stage_weight = seed_state.current_stage.severity_weight

        for horizon_key in self.horizons:
            minutes = self.horizon_minutes.get(horizon_key, 5.0)

            # 1. Natural attack progression over time
            # Linear growth + square-root stage impact
            attack_progression = (baseline_rate * minutes) + (stage_factor * stage_weight * (minutes ** 0.5))

            # 2. Momentum effect (positive increases risk, negative dampens)
            momentum_effect = momentum * momentum_factor * minutes

            # 3. Defensive mitigation effect
            defensive_effect = self.action_catalog.compute_defensive_effect(
                action=action,
                minutes=minutes,
                attack_type=seed_state.attack_type
            )

            # 4. State Transition Formula:
            # future_risk = current_risk + attack_progression + momentum_effect - defensive_effect
            raw_future_risk = current_risk + attack_progression + momentum_effect - defensive_effect

            # Clamp between configured min and max
            future_risk = max(self.clamp_min, min(self.clamp_max, raw_future_risk))

            # 5. Future attack probability computation
            # Probability correlates with risk and action mitigation
            prob_shift = (future_risk - current_risk) * 0.85
            raw_future_prob = seed_state.attack_probability + prob_shift
            future_prob = max(self.clamp_min, min(self.clamp_max, raw_future_prob))

            # 6. Stage transition modeling
            stage_probs, projected_stage = self._compute_stage_progression(
                current_stage=seed_state.current_stage,
                future_risk=future_risk,
                action=action,
                minutes=minutes
            )

            # Save horizon state
            h_state = HorizonState(
                horizon=horizon_key,
                minutes=minutes,
                future_threat_score=future_risk,
                future_attack_probability=future_prob,
                projected_stage=projected_stage,
                stage_probabilities=stage_probs
            )

            scenario.horizon_states[horizon_key] = h_state
            scenario.risk_trajectory[horizon_key] = future_risk

    def _compute_stage_progression(
        self,
        current_stage: AttackStage,
        future_risk: float,
        action: DefensiveAction,
        minutes: float
    ) -> tuple[Dict[str, float], AttackStage]:
        """
        Computes probabilistic stage escalation based on current stage and simulated risk.
        """
        transitions_config = self.config.get("stage_transitions", {})
        current_stage_key = current_stage.value
        base_dist = transitions_config.get(current_stage_key, {})

        if not base_dist:
            # Fallback default progression if not in config
            base_dist = {
                "INITIAL_ACCESS": 0.70,
                "LATERAL_MOVEMENT": 0.20,
                "NO_ESCALATION": 0.10
            }

        # Apply mitigation modifier to stage progression
        # Strong actions (e.g. ISOLATE_ASSET) suppress escalation
        mitigation_strength = 0.0
        if action == DefensiveAction.BLOCK_SOURCES:
            mitigation_strength = 0.35
        elif action == DefensiveAction.ISOLATE_ASSET:
            mitigation_strength = 0.70

        adjusted_dist: Dict[str, float] = {}
        total = 0.0
        
        for next_stage, prob in base_dist.items():
            if next_stage == "NO_ESCALATION":
                # Mitigation increases probability of stopping escalation
                adj_prob = prob + (mitigation_strength * (1.0 - prob) * 0.6)
            else:
                # Mitigation reduces probability of next attack stages
                adj_prob = prob * (1.0 - (mitigation_strength * 0.75))
            
            adj_prob = max(0.01, adj_prob)
            adjusted_dist[next_stage] = adj_prob
            total += adj_prob

        # Normalize probabilities to sum to 1.0
        normalized_dist = {
            k: round(v / total, 3) for k, v in adjusted_dist.items()
        }

        # Determine most likely projected stage
        highest_stage_name = max(normalized_dist, key=normalized_dist.get) # type: ignore
        if highest_stage_name == "NO_ESCALATION":
            projected_stage = current_stage
        else:
            projected_stage = AttackStage.from_str(highest_stage_name)

        return normalized_dist, projected_stage
