"""
Module 3: Future Risk Engine + Counterfactual Simulator + Defensive Action Optimizer
======================================================================================
Receives threat state & forecasts from Module 2, simulates counterfactual future scenarios
under various defensive actions across fixed time horizons (2m, 5m, 10m), ranks optimal actions,
and delivers an explainable recommendation payload to Module 4.
"""

from .schemas import (
    ThreatStateInput,
    Module4Output,
    CurrentStateOutput,
    ScenarioOutput,
    RecommendationOutput,
    ErrorResponse,
)
from .state import ThreatState, AttackStage
from .action_model import DefensiveAction, ActionCatalog
from .scenarios import ScenarioManager, CounterfactualTree
from .simulator import FutureRiskSimulator
from .ranking import ActionRanker, RankedAction
from .confidence import ConfidenceScorer
from .explainability import ExplanationGenerator

__all__ = [
    "ThreatStateInput",
    "Module4Output",
    "CurrentStateOutput",
    "ScenarioOutput",
    "RecommendationOutput",
    "ErrorResponse",
    "ThreatState",
    "AttackStage",
    "DefensiveAction",
    "ActionCatalog",
    "ScenarioManager",
    "CounterfactualTree",
    "FutureRiskSimulator",
    "ActionRanker",
    "RankedAction",
    "ConfidenceScorer",
    "ExplanationGenerator",
]

__version__ = "1.0.0"
