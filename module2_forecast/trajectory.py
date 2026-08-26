"""
trajectory.py: Attack Trajectory & Time-to-Escalation Tracker for Module 2
========================================================================
Maps threat score & momentum onto canonical kill-chain stages, calculates
time-to-escalation, and constructs explainability evidence objects.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
from shared import config


@dataclass
class TrajectoryForecast:
    """Dataclass encapsulating stage progression and evidence."""
    current_stage: str
    next_stage: str
    time_to_escalation_minutes: int
    stage_progress: float
    evidence: List[Dict[str, any]]


class TrajectoryTracker:
    """
    Trajectory state machine enforcing SIH26153 Design Document §3.2 & §6.
    
    Canonical stages:
        NORMAL -> ANOMALY -> SCANNING -> ATTACK IMMINENT -> DDoS
    """

    STAGES = config.TRAJECTORY_STAGES

    def __init__(self):
        self._prev_features: Optional[Dict[str, float]] = None

    def evaluate_trajectory(
        self,
        threat_score: float,
        threat_momentum: float,
        features: Dict[str, float],
        anomalies: Dict[str, float],
        window_seconds: int = config.WINDOW_SECONDS
    ) -> TrajectoryForecast:
        """
        Derive kill-chain trajectory, time-to-escalation, and feature evidence.
        """
        current_stage, stage_progress = self._determine_current_stage(threat_score)
        next_stage = self._determine_next_stage(current_stage, threat_momentum)
        time_to_escalation = self._estimate_time_to_escalation(
            threat_score=threat_score,
            threat_momentum=threat_momentum,
            window_seconds=window_seconds
        )
        evidence = self._generate_evidence(features, anomalies, threat_momentum)

        self._prev_features = dict(features)

        return TrajectoryForecast(
            current_stage=current_stage,
            next_stage=next_stage,
            time_to_escalation_minutes=time_to_escalation,
            stage_progress=round(stage_progress, 2),
            evidence=evidence
        )

    def _determine_current_stage(self, threat_score: float) -> (str, float):
        """
        Map threat score [0.0 - 1.0] to canonical stage and intra-stage progress [0.0 - 1.0].
        
        Thresholds:
            0.00 - 0.25 -> NORMAL
            0.25 - 0.45 -> ANOMALY
            0.45 - 0.70 -> SCANNING
            0.70 - 0.85 -> ATTACK IMMINENT
            0.85 - 1.00 -> DDoS
        """
        if threat_score < 0.25:
            stage = "NORMAL"
            progress = threat_score / 0.25
        elif threat_score < 0.45:
            stage = "ANOMALY"
            progress = (threat_score - 0.25) / 0.20
        elif threat_score < 0.70:
            stage = "SCANNING"
            progress = (threat_score - 0.45) / 0.25
        elif threat_score < 0.85:
            stage = "ATTACK IMMINENT"
            progress = (threat_score - 0.70) / 0.15
        else:
            stage = "DDoS"
            progress = min(1.0, (threat_score - 0.85) / 0.15)

        return stage, max(0.0, min(1.0, progress))

    def _determine_next_stage(self, current_stage: str, momentum: float) -> str:
        """
        Determine predicted next stage based on current stage and threat momentum.
        """
        try:
            curr_idx = self.STAGES.index(current_stage)
        except ValueError:
            curr_idx = 0

        if momentum > 0.02 and curr_idx < len(self.STAGES) - 1:
            return self.STAGES[curr_idx + 1]
        elif momentum < -0.05 and curr_idx > 0:
            return self.STAGES[curr_idx - 1]
        
        return current_stage

    def _estimate_time_to_escalation(
        self,
        threat_score: float,
        threat_momentum: float,
        window_seconds: int
    ) -> int:
        """
        Calculate estimated time (in minutes) to cross config.ESCALATION_THRESHOLD (0.95).
        """
        target_threshold = config.ESCALATION_THRESHOLD

        if threat_score >= target_threshold:
            return 0

        # Converts momentum (change per window) to momentum per minute
        windows_per_minute = 60.0 / float(window_seconds)
        momentum_per_minute = threat_momentum * windows_per_minute

        if momentum_per_minute > 0.005:
            score_remaining = target_threshold - threat_score
            minutes = score_remaining / momentum_per_minute
            return max(1, min(99, int(round(minutes))))

        # If momentum is zero or negative, escalation is not imminently projected
        return 99

    def _generate_evidence(
        self,
        features: Dict[str, float],
        anomalies: Dict[str, float],
        momentum: float
    ) -> List[Dict[str, any]]:
        """
        Build feature explainability list matching Module 4 evidence spec.
        """
        evidence_items = []

        # 1. SYN traffic anomaly change
        syn_anom = anomalies.get("syn", 0.0)
        syn_rate = features.get("syn_rate", 0.0)
        if syn_anom > 0.3 or syn_rate > 0.5:
            change_val = round(0.40 + 0.50 * syn_anom, 2)
            evidence_items.append({
                "name": "SYN traffic",
                "change": change_val,
                "severity": "HIGH" if change_val > 0.60 else "MEDIUM",
                "unit": "%",
            })

        # 2. Source diversity anomaly change
        source_anom = anomalies.get("source", 0.0)
        if source_anom > 0.3:
            change_val = round(0.30 + 0.45 * source_anom, 2)
            evidence_items.append({
                "name": "Unique sources",
                "change": change_val,
                "severity": "HIGH" if change_val > 0.50 else "MEDIUM",
                "unit": "%",
            })

        # 3. Connection failure anomaly change
        conn_anom = anomalies.get("connection", 0.0)
        if conn_anom > 0.3:
            change_val = round(0.35 + 0.50 * conn_anom, 2)
            evidence_items.append({
                "name": "Failed connections",
                "change": change_val,
                "severity": "HIGH" if change_val > 0.60 else "MEDIUM",
                "unit": "%",
            })

        # 4. Threat momentum / traffic acceleration
        if momentum > 0.05:
            change_val = round(min(0.99, 0.40 + 2.0 * momentum), 2)
            evidence_items.append({
                "name": "Traffic acceleration",
                "change": change_val,
                "severity": "HIGH" if change_val > 0.55 else "MEDIUM",
                "unit": "%",
            })

        # Fallback quiet evidence item if no spikes present
        if not evidence_items:
            evidence_items.append({
                "name": "Baseline stability",
                "change": 0.02,
                "severity": "LOW",
                "unit": "%",
            })

        return evidence_items
