"""
scenarios.py: Counterfactual Scenario Branching and Trajectory Management
==========================================================================
Constructs counterfactual simulation trees branching from the initial ThreatState
seed across prediction horizons (+2m, +5m, +10m) for each defensive action.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from .schemas import ScenarioOutput, DetailedScenarioOutput
from .state import ThreatState, AttackStage
from .action_model import DefensiveAction, ActionMetadata, ActionCatalog


@dataclass
class HorizonState:
    """
    Simulated network threat state at a specific future horizon point.
    """
    horizon: str
    minutes: float
    future_threat_score: float
    future_attack_probability: float
    projected_stage: AttackStage
    stage_probabilities: Dict[str, float] = field(default_factory=dict)


@dataclass
class CounterfactualScenario:
    """
    Complete forward simulated trajectory for a single defensive action.
    """
    action: DefensiveAction
    action_metadata: ActionMetadata
    horizon_states: Dict[str, HorizonState] = field(default_factory=dict)
    risk_trajectory: Dict[str, float] = field(default_factory=dict)

    def to_scenario_output(self) -> ScenarioOutput:
        """
        Converts to the exact ScenarioOutput format required by Module 4 contract.
        """
        return ScenarioOutput(
            action=self.action.value if hasattr(self.action, "value") else str(self.action),
            risk={h: round(score, 4) for h, score in self.risk_trajectory.items()}
        )

    def to_detailed_output(
        self,
        rank: int,
        baseline_risk_10m: float,
        is_recommended: bool = False
    ) -> DetailedScenarioOutput:
        """
        Converts to extended analytics output for detailed dashboard views.
        """
        risk_10m = self.risk_trajectory.get("10m", 0.0)
        reduction = max(0.0, baseline_risk_10m - risk_10m)
        reduction_pct = (reduction / max(0.001, baseline_risk_10m)) * 100.0

        stage_probs = {
            h: state.stage_probabilities
            for h, state in self.horizon_states.items()
        }

        return DetailedScenarioOutput(
            action=self.action.value if hasattr(self.action, "value") else str(self.action),
            action_description=self.action_metadata.description,
            risk={h: round(score, 4) for h, score in self.risk_trajectory.items()},
            risk_reduction_10m=round(reduction, 4),
            risk_reduction_pct_10m=round(reduction_pct, 2),
            rank=rank,
            stage_probabilities=stage_probs,
            is_recommended=is_recommended
        )


@dataclass
class CounterfactualTree:
    """
    Represents the full branching counterfactual decision tree evaluated from the seed state.
    """
    seed_state: ThreatState
    scenarios: Dict[DefensiveAction, CounterfactualScenario] = field(default_factory=dict)

    def get_scenario(self, action: DefensiveAction) -> Optional[CounterfactualScenario]:
        return self.scenarios.get(action)

    def to_scenario_outputs(self) -> List[ScenarioOutput]:
        """
        Returns list of ScenarioOutput adhering strictly to Module 4 schema order:
        NO_ACTION, BLOCK_SOURCES, ISOLATE_ASSET (and any active extensions).
        """
        outputs = []
        # Maintain consistent preferred presentation ordering
        priority_order = [
            DefensiveAction.NO_ACTION,
            DefensiveAction.BLOCK_SOURCES,
            DefensiveAction.ISOLATE_ASSET
        ]
        
        for action in priority_order:
            if action in self.scenarios:
                outputs.append(self.scenarios[action].to_scenario_output())
        
        # Append any other enabled custom actions
        for action, scenario in self.scenarios.items():
            if action not in priority_order:
                outputs.append(scenario.to_scenario_output())
                
        return outputs


class ScenarioManager:
    """
    Orchestrates scenario registration and counterfactual tree creation.
    """

    def __init__(self, action_catalog: ActionCatalog, horizons: Optional[List[str]] = None):
        self.catalog = action_catalog
        self.horizons = horizons or ["2m", "5m", "10m"]

    def create_empty_tree(self, seed_state: ThreatState) -> CounterfactualTree:
        """
        Instantiates a fresh counterfactual tree seeded from current ThreatState.
        """
        tree = CounterfactualTree(seed_state=seed_state)
        for meta in self.catalog.get_enabled_actions():
            scenario = CounterfactualScenario(
                action=meta.action,
                action_metadata=meta
            )
            tree.scenarios[meta.action] = scenario
        return tree
