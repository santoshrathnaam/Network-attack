"""
Module 2: Threat Forecasting & Attack Trajectory Engine
======================================================
Turns time-series network features and anomaly indicators from Module 1 into:
  - Composite threat score
  - Threat momentum (rate of escalation)
  - Attack family probabilities & predicted attack
  - Canonical attack trajectory (current & next stage)
  - Estimated time-to-escalation
  - Feature-level explainability evidence

Deliverable for SIH26153 Predictive Cyber Defense (§6).
"""

from .model import ThreatModel, ThreatAssessment
from .trajectory import TrajectoryTracker, TrajectoryForecast
from .predictor import ThreatPredictor, predict, reset_default_predictor

__all__ = [
    "ThreatModel",
    "ThreatAssessment",
    "TrajectoryTracker",
    "TrajectoryForecast",
    "ThreatPredictor",
    "predict",
    "reset_default_predictor",
]

__version__ = "1.0.0"
