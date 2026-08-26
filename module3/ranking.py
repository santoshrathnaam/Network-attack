"""
ranking.py: Defensive Action Optimizer & Risk Reduction Ranker
================================================================
Compares counterfactual simulation trajectories against baseline (NO_ACTION),
computes absolute and percentage risk reductions, and ranks actions to identify
the optimal defensive strategy.
"""

from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
from .action_model import DefensiveAction
from .scenarios import CounterfactualTree, CounterfactualScenario


@dataclass
class HorizonReduction:
    horizon: str
    absolute_reduction: float
    percentage_reduction: float


@dataclass
class RankedAction:
    """
    Evaluation metrics and ranking position for a single defensive action.
    """
    action: DefensiveAction
    rank: int
    projected_risk_10m: float
    risk_reduction_10m: float
    risk_reduction_pct_10m: float
    horizon_reductions: Dict[str, HorizonReduction] = field(default_factory=dict)
    is_best_action: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rank": self.rank,
            "action": self.action.value if hasattr(self.action, "value") else str(self.action),
            "projected_risk_10m": round(self.projected_risk_10m, 4),
            "risk_reduction_10m": round(self.risk_reduction_10m, 4),
            "risk_reduction_pct_10m": round(self.risk_reduction_pct_10m, 2),
            "is_best_action": self.is_best_action
        }


class ActionRanker:
    """
    Evaluates simulated counterfactual scenarios and ranks actions by future risk mitigation.
    """

    def __init__(self, primary_horizon: str = "10m"):
        self.primary_horizon = primary_horizon

    def rank_actions(self, tree: CounterfactualTree) -> List[RankedAction]:
        """
        Ranks all actions in the counterfactual tree from most effective to least effective.
        """
        no_action_scenario = tree.get_scenario(DefensiveAction.NO_ACTION)
        
        # Get baseline risk at each horizon
        if no_action_scenario:
            baseline_risks = no_action_scenario.risk_trajectory
        else:
            baseline_risks = {h: 1.0 for h in ["2m", "5m", "10m"]}

        baseline_10m = baseline_risks.get(self.primary_horizon, 1.0)
        
        evaluations: List[RankedAction] = []

        for action, scenario in tree.scenarios.items():
            risk_10m = scenario.risk_trajectory.get(self.primary_horizon, 1.0)
            reduction_10m = max(0.0, baseline_10m - risk_10m)
            reduction_pct_10m = (reduction_10m / max(0.001, baseline_10m)) * 100.0

            horizon_reductions: Dict[str, HorizonReduction] = {}
            for h, r_score in scenario.risk_trajectory.items():
                base_r = baseline_risks.get(h, 1.0)
                abs_red = max(0.0, base_r - r_score)
                pct_red = (abs_red / max(0.001, base_r)) * 100.0
                horizon_reductions[h] = HorizonReduction(
                    horizon=h,
                    absolute_reduction=abs_red,
                    percentage_reduction=pct_red
                )

            evaluations.append(
                RankedAction(
                    action=action,
                    rank=0,  # assigned after sorting
                    projected_risk_10m=risk_10m,
                    risk_reduction_10m=reduction_10m,
                    risk_reduction_pct_10m=reduction_pct_10m,
                    horizon_reductions=horizon_reductions,
                    is_best_action=False
                )
            )

        # Sort: lowest projected risk first (highest risk reduction)
        # Tie-breaker: prefer actions with lower operational disruption
        evaluations.sort(key=lambda item: (item.projected_risk_10m, -item.risk_reduction_10m))

        # Assign ranks
        for idx, item in enumerate(evaluations):
            item.rank = idx + 1

        if evaluations:
            evaluations[0].is_best_action = True

        return evaluations

    def get_optimal_action(self, ranked_actions: List[RankedAction]) -> RankedAction:
        """
        Returns the top-ranked optimal defensive action.
        """
        if not ranked_actions:
            raise ValueError("No ranked actions available to select optimal action.")
        return ranked_actions[0]
