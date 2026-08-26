"""
simulator.py: Prototype Counterfactual Future Simulator Engine
================================================================
Simulates future threat risk states under different defensive actions
using a deterministic state-transition model:

  Current risk
      +
  Threat momentum
      +
  Attack stage progression
      +
  Mitigation effectiveness
      ↓
  Future risk

DISCLAIMER:
This implementation is clearly labeled as a PROTOTYPE COUNTERFACTUAL MODEL,
not a production-grade causal simulator.
"""

from typing import Dict, Any, List, Optional


class StateTransitionModel:
    """
    State-transition risk model for forward threat evolution over time horizons.
    """

    # Baseline attack stage severity parameters
    STAGE_FACTORS: Dict[str, float] = {
        "RECONNAISSANCE": 0.02,
        "SCANNING": 0.03,
        "INITIAL_ACCESS": 0.05,
        "EXECUTION": 0.08,
        "PERSISTENCE": 0.10,
        "PRIVILEGE_ESCALATION": 0.12,
        "LATERAL_MOVEMENT": 0.15,
        "EXFILTRATION": 0.18,
        "IMPACT": 0.20,
        "UNKNOWN": 0.05,
    }

    # Action effectiveness mitigation factors (multiplier applied to projected risk)
    ACTION_EFFECTIVENESS: Dict[str, float] = {
        "NO_ACTION": 1.00,        # No reduction (0% effectiveness)
        "RATE_LIMIT": 0.70,       # 30% risk reduction
        "APPLY_WAF_RULES": 0.55,  # 45% risk reduction
        "BLOCK_SOURCES": 0.42,    # 58% risk reduction
        "ISOLATE_SERVER": 0.26,   # 74% risk reduction
        "ISOLATE_ASSET": 0.26,    # 74% risk reduction (alias)
        "TERMINATE_SESSION": 0.35,# 65% risk reduction
        "PATCH_VULNERABILITY": 0.30 # 70% risk reduction
    }

    def __init__(
        self,
        clamp_min: float = 0.0,
        clamp_max: float = 1.0,
        custom_action_effects: Optional[Dict[str, float]] = None
    ):
        self.clamp_min = clamp_min
        self.clamp_max = clamp_max
        self.action_effects = {**self.ACTION_EFFECTIVENESS, **(custom_action_effects or {})}

    def compute_future_risk(
        self,
        current_risk: float,
        momentum: float,
        stage: str,
        action: str,
        horizon_minutes: float = 5.0
    ) -> float:
        """
        Computes projected future risk under a given action.

        Formula:
            unmitigated_growth = (momentum * (horizon_minutes / 5.0)) + stage_factor
            raw_future_risk = current_risk + unmitigated_growth
            future_risk = raw_future_risk * mitigation_factor
            clamped_future_risk = max(clamp_min, min(clamp_max, future_risk))
        """
        stage_key = str(stage).upper().strip()
        stage_factor = self.STAGE_FACTORS.get(stage_key, self.STAGE_FACTORS["UNKNOWN"])

        # Time scaling factor relative to standard 5-minute window
        time_scale = horizon_minutes / 5.0

        # Unmitigated forward threat progression
        growth = (momentum * time_scale) + (stage_factor * time_scale)
        raw_future_risk = current_risk + growth

        # Action mitigation factor lookup
        action_key = str(action).upper().strip()
        mitigation_factor = self.action_effects.get(action_key, 0.50) # default 50% factor for unknown action

        # Apply mitigation
        future_risk = raw_future_risk * mitigation_factor

        # Clamp between min and max bounds [0.0, 1.0]
        clamped_risk = max(self.clamp_min, min(self.clamp_max, future_risk))
        return round(clamped_risk, 2)


class CounterfactualSimulator:
    """
    Simulator engine that runs counterfactual scenarios across candidate defensive actions.
    """

    DEFAULT_ACTIONS = ["NO_ACTION", "BLOCK_SOURCES", "ISOLATE_SERVER"]

    def __init__(self, model: Optional[StateTransitionModel] = None):
        self.model = model or StateTransitionModel()

    def run_simulation(
        self,
        current_state: Dict[str, Any],
        candidate_actions: Optional[List[str]] = None,
        horizon_minutes: float = 5.0
    ) -> Dict[str, Any]:
        """
        Runs counterfactual simulation across provided actions.

        Inputs:
            current_state: Dict containing 'threat_score'/'current_risk', 'momentum', 'current_stage'
            candidate_actions: List of actions to evaluate (defaults to NO_ACTION, BLOCK_SOURCES, ISOLATE_SERVER)
            horizon_minutes: Time window for simulation (default: 5.0 mins)

        Returns:
            Structured dictionary with current_risk, scenarios, recommended_action, and risk_reduction.
        """
        current_risk = float(current_state.get("current_risk", current_state.get("threat_score", 0.5)))
        momentum = float(current_state.get("momentum", current_state.get("threat_momentum", 0.1)))
        stage = str(current_state.get("current_stage", "SCANNING"))

        actions = candidate_actions or self.DEFAULT_ACTIONS
        if "NO_ACTION" not in actions:
            actions = ["NO_ACTION"] + list(actions)

        scenarios = []
        horizon_key = f"risk_{int(horizon_minutes)}min"

        no_action_risk = None
        best_action = None
        best_risk = float("inf")

        for act in actions:
            projected_risk = self.model.compute_future_risk(
                current_risk=current_risk,
                momentum=momentum,
                stage=stage,
                action=act,
                horizon_minutes=horizon_minutes
            )

            scenarios.append({
                "action": act,
                horizon_key: projected_risk
            })

            if act == "NO_ACTION":
                no_action_risk = projected_risk

            if projected_risk < best_risk:
                best_risk = projected_risk
                best_action = act

        if no_action_risk is None:
            no_action_risk = scenarios[0][horizon_key]

        risk_reduction = round(no_action_risk - best_risk, 2)

        return {
            "current_risk": round(current_risk, 2),
            "scenarios": scenarios,
            "recommended_action": best_action or "NO_ACTION",
            "risk_reduction": max(0.0, risk_reduction)
        }
