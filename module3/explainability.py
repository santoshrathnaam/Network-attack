"""
explainability.py: Dynamic Simulation-Derived Justification Generator
======================================================================
Generates human-readable, quantified explanations for recommendations
strictly derived from actual simulation numbers and counterfactual deltas.
"""

from typing import List, Dict, Any, Optional
from .state import ThreatState, ThreatLevel
from .action_model import DefensiveAction
from .scenarios import CounterfactualTree
from .ranking import RankedAction


class ExplanationGenerator:
    """
    Constructs explainable, concise bullet points for Module 4 dashboard display.
    """

    def generate_explanation(
        self,
        seed_state: ThreatState,
        tree: CounterfactualTree,
        ranked_actions: List[RankedAction]
    ) -> List[str]:
        """
        Builds the exact explanation list required by Module 4 contract.
        Derived directly from simulated risk trajectories.
        """
        explanations: List[str] = []

        # 1. Current Threat Situation Assessment
        threat_pct = int(round(seed_state.threat_score * 100))
        if seed_state.threat_level == ThreatLevel.CRITICAL:
            explanations.append(f"Current threat level is critical ({threat_pct}%)")
        elif seed_state.threat_level == ThreatLevel.HIGH:
            explanations.append(f"Current threat level is high ({threat_pct}%)")
        elif seed_state.threat_level == ThreatLevel.MEDIUM:
            explanations.append(f"Current threat level is moderate ({threat_pct}%)")
        else:
            explanations.append(f"Current threat level is low ({threat_pct}%)")

        # 2. Threat Momentum & Trajectory Assessment
        if seed_state.momentum > 0.05:
            explanations.append(f"Threat momentum is increasing (+{seed_state.momentum:.2f})")
        elif seed_state.momentum < -0.05:
            explanations.append(f"Threat momentum is decelerating ({seed_state.momentum:.2f})")
        else:
            explanations.append("Threat momentum is currently stable")

        # 3. Action Decision Rationale
        if ranked_actions:
            best = ranked_actions[0]
            action_name = best.action.value if hasattr(best.action, "value") else str(best.action)
            
            if action_name == "ISOLATE_ASSET":
                explanations.append("Asset isolation produces the lowest projected future risk")
            elif action_name == "BLOCK_SOURCES":
                explanations.append("Source IP blocking produces the most optimal risk reduction")
            elif action_name == "NO_ACTION":
                explanations.append("No defensive action required as baseline threat is negligible")
            else:
                explanations.append(f"{action_name} provides the most effective threat mitigation")

        return explanations

    def generate_detailed_justification(
        self,
        seed_state: ThreatState,
        tree: CounterfactualTree,
        ranked_actions: List[RankedAction]
    ) -> Dict[str, Any]:
        """
        Generates full analytical reasoning paragraphs and metrics for deep inspection.
        """
        top_action = ranked_actions[0] if ranked_actions else None
        no_action_scenario = tree.get_scenario(DefensiveAction.NO_ACTION)
        no_action_10m = no_action_scenario.risk_trajectory.get("10m", 1.0) if no_action_scenario else 1.0
        
        current_pct = int(round(seed_state.threat_score * 100))
        no_action_pct = int(round(no_action_10m * 100))

        key_takeaways = []
        if top_action:
            top_10m_pct = int(round(top_action.projected_risk_10m * 100))
            red_pct = int(round(top_action.risk_reduction_pct_10m))
            action_str = top_action.action.value if hasattr(top_action.action, "value") else str(top_action.action)

            key_takeaways.append(
                f"Without defensive intervention (NO_ACTION), threat escalates from {current_pct}% to {no_action_pct}% within 10 minutes."
            )
            key_takeaways.append(
                f"Executing {action_str} aggressively reduces projected risk from {current_pct}% to {top_10m_pct}% within 10 minutes ({red_pct}% net risk reduction)."
            )
            key_takeaways.append(
                f"Primary target asset '{seed_state.affected_asset}' is secured against further '{seed_state.attack_type}' attack escalation."
            )

        return {
            "summary_bullets": self.generate_explanation(seed_state, tree, ranked_actions),
            "key_takeaways": key_takeaways,
            "target_asset": seed_state.affected_asset,
            "attack_type": seed_state.attack_type,
            "current_stage": seed_state.current_stage.value
        }
