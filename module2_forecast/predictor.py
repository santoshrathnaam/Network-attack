"""
predictor.py: Top-Level Predictor Engine for Module 2
=====================================================
Orchestrates ThreatModel and TrajectoryTracker into the single unified
entry point `predict(input_data)` required by design doc §6 and §10.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional, Union

from .model import ThreatModel, ThreatAssessment
from .trajectory import TrajectoryTracker, TrajectoryForecast


class ThreatPredictor:
    """
    Threat Forecasting & Attack Trajectory Predictor.
    Maintains rolling state across consecutive time windows.
    """

    def __init__(self):
        self.model = ThreatModel()
        self.trajectory_tracker = TrajectoryTracker()

    def reset(self):
        """Reset predictor history."""
        self.model.reset()
        self.trajectory_tracker = TrajectoryTracker()

    def predict(
        self,
        input_data: Dict[str, Any],
        affected_asset: str = "API_GATEWAY",
        timestamp: Optional[str] = None,
        threat_vector: str = "DDoS"
    ) -> Dict[str, Any]:
        """
        Main prediction entry point.

        input_data: Either Module 1 output contract dict containing:
                    {"features": {...}, "anomalies": {...}, "baseline_ready": bool, "timestamp": str}
                    or a direct dictionary of features.

        Returns complete hand-off contract for Module 3 and Module 4.
        """
        # Parse Module 1 payload format vs raw features
        if "features" in input_data and "anomalies" in input_data:
            features = input_data["features"]
            anomalies = input_data["anomalies"]
            baseline_ready = input_data.get("baseline_ready", True)
            ts = timestamp or input_data.get("timestamp")
        else:
            # Direct feature dict input fallback
            features = input_data
            anomalies = {
                "traffic": float(features.get("traffic_anomaly", 0.0)),
                "syn": float(features.get("syn_anomaly", features.get("syn_rate", 0.0))),
                "source": float(features.get("source_anomaly", 0.0)),
                "connection": float(features.get("connection_anomaly", 0.0)),
            }
            baseline_ready = True
            ts = timestamp

        if not ts:
            ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

        # 1. Model Evaluation (Threat Score, Momentum, Attack Probabilities)
        assessment: ThreatAssessment = self.model.evaluate(
            anomalies=anomalies,
            features=features,
            baseline_ready=baseline_ready
        )

        # 2. Trajectory Evaluation (Kill-Chain Stage, Escalation Time, Evidence)
        trajectory: TrajectoryForecast = self.trajectory_tracker.evaluate_trajectory(
            threat_score=assessment.threat_score,
            threat_momentum=assessment.threat_momentum,
            features=features,
            anomalies=anomalies,
            threat_vector=threat_vector
        )

        # 3. Assemble Output Contract (Matching §6, §10, and Module 3 ThreatStateInput)
        output_payload = {
            "timestamp": ts,
            "threat_score": assessment.threat_score,
            "threat_momentum": assessment.threat_momentum,
            "momentum": assessment.threat_momentum,  # Alias for Module 3 ThreatStateInput
            "attack_probability": assessment.attack_probability,
            "predicted_attack": assessment.predicted_attack,
            "attack_type": assessment.predicted_attack,  # Alias for Module 3 ThreatStateInput
            "threat_vector": threat_vector,
            "adaptive_weights": assessment.adaptive_weights,
            "current_stage": trajectory.current_stage,
            "next_stage": trajectory.next_stage,
            "stage_progress": trajectory.stage_progress,
            "time_to_escalation_minutes": trajectory.time_to_escalation_minutes,
            "time_to_escalation": trajectory.time_to_escalation_minutes,  # Alias
            "affected_asset": affected_asset,
            "asset": affected_asset,  # Alias
            "evidence": trajectory.evidence,
            "forecast_probabilities": assessment.forecast_probabilities,
            "baseline_ready": baseline_ready,
        }

        return output_payload


# Module-level default predictor instance for stateful single-call usage
_default_predictor = ThreatPredictor()


def reset_default_predictor():
    """Reset global predictor instance state."""
    global _default_predictor
    _default_predictor = ThreatPredictor()


def predict(
    features_or_m1_output: Dict[str, Any],
    affected_asset: str = "API_GATEWAY",
    predictor: Optional[ThreatPredictor] = None,
    threat_vector: str = "DDoS"
) -> Dict[str, Any]:
    """
    Required single-function entry point mandated by design doc §6:
    
        forecast = predict(features)

    features_or_m1_output: dict returned by module1_traffic.process_traffic()
                           or direct feature dictionary.
    affected_asset: target system asset identifier.
    predictor: optional ThreatPredictor instance (defaults to module singleton).
    threat_vector: target attack family ("DDoS", "APT", "RANSOMWARE", "SLOWLORIS").
    """
    engine = predictor if predictor is not None else _default_predictor
    return engine.predict(input_data=features_or_m1_output, affected_asset=affected_asset, threat_vector=threat_vector)

