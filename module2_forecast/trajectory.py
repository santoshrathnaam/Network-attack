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
    Trajectory state machine enforcing SIH26153 Design Document §3.2 & §6
    and curr.txt §2.2 Multi-Vector Kill-Chains.

    Supported Vectors:
        DDoS:       NORMAL -> ANOMALY -> SCANNING -> ATTACK IMMINENT -> DDoS
        APT:        RECON -> INGRESS_BREACH -> PRIVILEGE_ESCALATION -> C2_BEACONING -> DATA_EXFILTRATION
        RANSOMWARE: SMB_SWEEP -> KERBEROASTING -> SHADOW_COPY_PURGE -> LATERAL_ENCRYPTION
        SLOWLORIS:  BENIGN_HTTP -> PORT_SWEEP -> HALF_OPEN_HOLD -> SOCKET_EXHAUSTION
    """

    VECTOR_STAGES = {
        "DDoS":        ["NORMAL", "ANOMALY", "SCANNING", "ATTACK IMMINENT", "DDoS"],
        "APT":         ["RECON", "INGRESS_BREACH", "PRIVILEGE_ESCALATION", "C2_BEACONING", "DATA_EXFILTRATION"],
        "RANSOMWARE":  ["SMB_SWEEP", "KERBEROASTING", "SHADOW_COPY_PURGE", "LATERAL_ENCRYPTION"],
        "SLOWLORIS":   ["BENIGN_HTTP", "PORT_SWEEP", "HALF_OPEN_HOLD", "SOCKET_EXHAUSTION"],
        "BGP_HIJACK":  ["PREFIX_ANOMALY", "TRAFFIC_DIVERSION", "ROUTE_LEAK", "BLACKHOLING"],
    }

    STAGES = config.TRAJECTORY_STAGES

    def __init__(self):
        self._prev_features: Optional[Dict[str, float]] = None

    def evaluate_trajectory(
        self,
        threat_score: float,
        threat_momentum: float,
        features: Dict[str, float],
        anomalies: Dict[str, float],
        window_seconds: int = config.WINDOW_SECONDS,
        threat_vector: str = "DDoS"
    ) -> TrajectoryForecast:
        """
        Derive kill-chain trajectory, time-to-escalation, and feature evidence for a target threat vector.
        """
        stages = self.VECTOR_STAGES.get(threat_vector, self.VECTOR_STAGES["DDoS"])
        current_stage, stage_progress = self._determine_current_stage_vector(threat_score, stages)
        next_stage = self._determine_next_stage_vector(current_stage, threat_momentum, stages)
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

    def _determine_current_stage_vector(self, threat_score: float, stages: List[str]) -> (str, float):
        """Map threat score to stage sequence dynamically."""
        num_stages = len(stages)
        step = 1.0 / num_stages
        idx = int(threat_score / step)
        idx = min(num_stages - 1, max(0, idx))
        progress = (threat_score - (idx * step)) / step
        return stages[idx], max(0.0, min(1.0, progress))

    def _determine_next_stage_vector(self, current_stage: str, momentum: float, stages: List[str]) -> str:
        """Determine next stage in vector stage sequence."""
        try:
            curr_idx = stages.index(current_stage)
        except ValueError:
            curr_idx = 0

        if momentum > 0.02 and curr_idx < len(stages) - 1:
            return stages[curr_idx + 1]
        elif momentum < -0.05 and curr_idx > 0:
            return stages[curr_idx - 1]

        return current_stage

    def _determine_current_stage(self, threat_score: float) -> (str, float):
        return self._determine_current_stage_vector(threat_score, self.VECTOR_STAGES["DDoS"])

    def _determine_next_stage(self, current_stage: str, momentum: float) -> str:
        return self._determine_next_stage_vector(current_stage, momentum, self.VECTOR_STAGES["DDoS"])

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

