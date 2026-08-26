"""
counterfactual.py: Counterfactual Simulation Interface for Module 3 Workspace Package
"""

import sys
from pathlib import Path
from typing import Dict, Any, List, Optional, Union

# Import engine from module3-simulator if available or local state-transition calculation
sys.path.insert(0, str(Path(__file__).parent.parent / "module3-simulator"))
try:
    from counterfactual import simulate as _sim_impl
except ImportError:
    _sim_impl = None


def simulate(
    current_state: Dict[str, Any],
    action: Optional[Union[str, List[str]]] = None,
    actions: Optional[List[str]] = None,
    horizon_minutes: float = 5.0
) -> Dict[str, Any]:
    """
    Required function: simulation = simulate(current_state, action)
    """
    if _sim_impl is not None:
        return _sim_impl(current_state, action=action, actions=actions, horizon_minutes=horizon_minutes)

    # Fallback inline implementation if module3-simulator is not in path
    current_risk = float(current_state.get("current_risk", current_state.get("threat_score", 0.5)))
    momentum = float(current_state.get("momentum", current_state.get("threat_momentum", 0.1)))
    
    effects = {
        "NO_ACTION": 1.00,
        "BLOCK_SOURCES": 0.42,
        "ISOLATE_SERVER": 0.26,
        "ISOLATE_ASSET": 0.26,
        "RATE_LIMIT": 0.70
    }

    eval_actions = actions or (action if isinstance(action, list) else (["NO_ACTION", action] if action else ["NO_ACTION", "BLOCK_SOURCES", "ISOLATE_SERVER"]))
    if "NO_ACTION" not in eval_actions:
        eval_actions = ["NO_ACTION"] + list(eval_actions)

    horizon_key = f"risk_{int(horizon_minutes)}min"
    scenarios = []
    best_action = None
    best_risk = float("inf")
    no_action_risk = 0.0

    for act in eval_actions:
        factor = effects.get(str(act).upper(), 0.50)
        risk = max(0.0, min(1.0, (current_risk + momentum) * factor))
        risk = round(risk, 2)
        scenarios.append({"action": act, horizon_key: risk})
        if act == "NO_ACTION":
            no_action_risk = risk
        if risk < best_risk:
            best_risk = risk
            best_action = act

    return {
        "current_risk": round(current_risk, 2),
        "scenarios": scenarios,
        "recommended_action": best_action or "NO_ACTION",
        "risk_reduction": round(max(0.0, no_action_risk - best_risk), 2)
    }
