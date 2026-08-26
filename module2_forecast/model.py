"""
model.py: Core Threat Scoring & Attack Classification Model for Module 2
=======================================================================
Implements threat score calculation, temporal acceleration tracking,
threat momentum estimation, and multi-family attack classification.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from shared import config


@dataclass
class ThreatAssessment:
    """Dataclass encapsulating Module 2's threat scoring evaluation."""
    threat_score: float
    threat_momentum: float
    temporal_acceleration: float
    attack_probability: float
    predicted_attack: str
    forecast_probabilities: Dict[str, float]


class ThreatModel:
    """
    Threat scoring engine enforcing SIH26153 Design Document §6 algorithms.
    
    Formula:
        Threat Score =
            weighted traffic anomaly (0.20)
          + weighted SYN anomaly (0.30)
          + weighted source anomaly (0.20)
          + weighted connection anomaly (0.20)
          + temporal acceleration (0.10)
    """

    def __init__(self):
        self._history: List[float] = []
        self._anomaly_history: List[float] = []

    def reset(self):
        """Reset internal history state."""
        self._history.clear()
        self._anomaly_history.clear()

    def evaluate(
        self,
        anomalies: Dict[str, float],
        features: Dict[str, float],
        baseline_ready: bool = True
    ) -> ThreatAssessment:
        """
        Evaluate anomalies and raw features to derive composite threat assessment.

        anomalies: dict containing 'traffic', 'syn', 'source', 'connection' in [0,1]
        features: dict containing raw window features (syn_rate, port_entropy, etc.)
        baseline_ready: bool indicating whether Module 1 baseline has warmed up
        """
        traffic_anom = float(anomalies.get("traffic", 0.0))
        syn_anom = float(anomalies.get("syn", 0.0))
        source_anom = float(anomalies.get("source", 0.0))
        conn_anom = float(anomalies.get("connection", 0.0))

        # Mean raw anomaly across components
        raw_anomaly_mean = (traffic_anom + syn_anom + source_anom + conn_anom) / 4.0

        # Calculate temporal acceleration (2nd derivative / delta of anomaly intensity)
        if len(self._anomaly_history) > 0:
            prev_anom = self._anomaly_history[-1]
            delta = raw_anomaly_mean - prev_anom
            # Positive delta indicates accelerating threat growth
            acceleration = max(0.0, min(1.0, delta * 2.0))
        else:
            acceleration = 0.0

        self._anomaly_history.append(raw_anomaly_mean)
        if len(self._anomaly_history) > 20:
            self._anomaly_history.pop(0)

        # Calculate weighted threat score matching design doc §6 & config.py
        weighted_sum = (
            syn_anom * config.WEIGHT_SYN +
            traffic_anom * config.WEIGHT_TRAFFIC +
            source_anom * config.WEIGHT_SOURCE +
            conn_anom * config.WEIGHT_CONNECTION +
            acceleration * config.WEIGHT_ACCELERATION
        )

        # Scale down if baseline is still warming up to avoid false alarms
        if not baseline_ready:
            weighted_sum *= 0.5

        threat_score = round(max(0.0, min(1.0, weighted_sum)), 4)

        # Calculate threat momentum (1st derivative / delta of threat score)
        if len(self._history) > 0:
            raw_momentum = threat_score - self._history[-1]
            threat_momentum = round(max(-1.0, min(1.0, raw_momentum)), 4)
        else:
            threat_momentum = 0.0

        self._history.append(threat_score)
        if len(self._history) > 20:
            self._history.pop(0)

        # Compute attack probabilities across threat families
        forecast_probs = self._classify_attack_probabilities(
            threat_score=threat_score,
            anomalies=anomalies,
            features=features
        )

        # Determine predicted primary attack type (highest probability)
        predicted_attack = max(forecast_probs, key=forecast_probs.get)
        attack_probability = forecast_probs[predicted_attack]

        return ThreatAssessment(
            threat_score=threat_score,
            threat_momentum=threat_momentum,
            temporal_acceleration=round(acceleration, 4),
            attack_probability=attack_probability,
            predicted_attack=predicted_attack,
            forecast_probabilities=forecast_probs
        )

    def _classify_attack_probabilities(
        self,
        threat_score: float,
        anomalies: Dict[str, float],
        features: Dict[str, float]
    ) -> Dict[str, float]:
        """
        Classify threat profile into attack probabilities:
        - DDoS / SYN Flood
        - Credential Attack
        - Port Scan
        - Exfiltration
        """
        syn_anom = anomalies.get("syn", 0.0)
        traffic_anom = anomalies.get("traffic", 0.0)
        source_anom = anomalies.get("source", 0.0)
        conn_anom = anomalies.get("connection", 0.0)

        syn_rate = features.get("syn_rate", 0.0)
        port_entropy = features.get("port_entropy", 0.0)
        failed_conns = features.get("failed_connections", 0)

        # 1. DDoS Probability
        # Highly sensitive to SYN anomaly, SYN rate ratio, and overall traffic volume
        ddos_signal = 0.4 * syn_anom + 0.3 * traffic_anom + 0.3 * (syn_rate if syn_rate > 0.4 else 0.0)
        p_ddos = max(0.05, min(0.99, ddos_signal * (0.5 + 0.6 * threat_score)))

        # 2. Port Scan Probability
        # High port entropy (> 3.0) and high source diversity anomaly
        scan_signal = 0.5 * source_anom + 0.5 * (min(1.0, port_entropy / 5.0) if port_entropy > 2.0 else 0.1)
        p_scan = max(0.05, min(0.95, scan_signal * (0.4 + 0.5 * threat_score)))

        # 3. Credential Attack Probability
        # High failed connection anomaly combined with low/moderate SYN rate
        cred_signal = 0.6 * conn_anom + 0.4 * (min(1.0, failed_conns / 50.0) if syn_rate < 0.6 else 0.1)
        p_cred = max(0.05, min(0.95, cred_signal * (0.3 + 0.6 * threat_score)))

        # 4. Exfiltration Probability
        # High traffic anomaly (bytes/sec) with low SYN rate and low source diversity
        exfil_signal = 0.7 * traffic_anom + 0.3 * (1.0 - syn_anom)
        p_exfil = max(0.05, min(0.90, exfil_signal * (0.2 + 0.5 * threat_score)))

        # Normalize probabilities or calibrate if threat score is very low
        if threat_score < 0.20:
            # Baseline quiet mode
            return {
                "DDoS": round(min(p_ddos, 0.15), 2),
                "Credential Attack": round(min(p_cred, 0.12), 2),
                "Port Scan": round(min(p_scan, 0.10), 2),
                "Exfiltration": round(min(p_exfil, 0.08), 2),
            }

        return {
            "DDoS": round(p_ddos, 2),
            "Credential Attack": round(p_cred, 2),
            "Port Scan": round(p_scan, 2),
            "Exfiltration": round(p_exfil, 2),
        }
