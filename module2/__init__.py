"""
module2 package alias pointing directly to module2_forecast.
Enables `import module2` and `from module2 import predict`.
"""

from module2_forecast import (
    ThreatModel,
    ThreatAssessment,
    TrajectoryTracker,
    TrajectoryForecast,
    ThreatPredictor,
    predict,
    reset_default_predictor,
)

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
