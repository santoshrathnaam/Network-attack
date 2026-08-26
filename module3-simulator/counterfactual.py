"""
counterfactual.py: High-level Counterfactual Simulation Interface
====================================================================
Exposes the required core function:
    simulation = simulate(current_state, action)

Accepts Module 2 forecast + current network state and returns simulated
future risk trajectories under defensive actions, projected risk reduction,
and recommended intervention.
"""

from typing import Dict, Any, List, Optional, Union
try:
    from .simulator import CounterfactualSimulator, StateTransitionModel
except ImportError:
    from simulator import CounterfactualSimulator, StateTransitionModel

# Global instance of simulator for stateless convenience calls
_global_simulator = CounterfactualSimulator()


def simulate(
    current_state: Dict[str, Any],
    action: Optional[Union[str, List[str]]] = None,
    actions: Optional[List[str]] = None,
    horizon_minutes: float = 5.0
) -> Dict[str, Any]:
    """
    Simulate future threat states under different defensive actions.

    Inputs:
        current_state (dict): Module 2 forecast + current network state containing:
            - current_risk (or threat_score): float [0.0 - 1.0]
            - momentum (or threat_momentum): float [-1.0 - 1.0]
            - current_stage: str (e.g., 'SCANNING', 'INITIAL_ACCESS')
        action (str or list, optional): Single action or list of actions to evaluate.
        actions (list, optional): Explicit list of candidate actions to evaluate.
        horizon_minutes (float, optional): Forecast horizon in minutes (default 5.0).

    Returns:
        dict: Prototype counterfactual output matching schema:
            {
                "current_risk": float,
                "scenarios": [
                    { "action": "NO_ACTION", "risk_5min": float },
                    { "action": "BLOCK_SOURCES", "risk_5min": float },
                    { "action": "ISOLATE_SERVER", "risk_5min": float }
                ],
                "recommended_action": str,
                "risk_reduction": float
            }
    """
    candidate_actions: List[str] = []

    # Determine list of actions to simulate
    if actions is not None:
        candidate_actions = list(actions)
    elif action is not None:
        if isinstance(action, list):
            candidate_actions = list(action)
        elif isinstance(action, str):
            candidate_actions = ["NO_ACTION", action]
            # Include standard actions for comprehensive comparison if desired
            if action not in ["BLOCK_SOURCES", "ISOLATE_SERVER"]:
                candidate_actions.extend(["BLOCK_SOURCES", "ISOLATE_SERVER"])

    if not candidate_actions:
        candidate_actions = ["NO_ACTION", "BLOCK_SOURCES", "ISOLATE_SERVER"]

    # Ensure NO_ACTION is present
    if "NO_ACTION" not in candidate_actions:
        candidate_actions.insert(0, "NO_ACTION")

    # Remove duplicates while preserving order
    unique_actions = []
    for act in candidate_actions:
        if act not in unique_actions:
            unique_actions.append(act)

    return _global_simulator.run_simulation(
        current_state=current_state,
        candidate_actions=unique_actions,
        horizon_minutes=horizon_minutes
    )
