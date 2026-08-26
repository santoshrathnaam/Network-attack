"""
state.py: Internal Threat State Data Structure & Stage Modeling
================================================================
Represents the normalized threat state received from Module 2, along with
attack stage kill-chain progression models and severity classifications.
"""

from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
from .schemas import ThreatStateInput, CurrentStateOutput


class AttackStage(str, Enum):
    """
    Standard cyber kill-chain progression stages.
    """
    SCANNING = "SCANNING"
    INITIAL_ACCESS = "INITIAL_ACCESS"
    EXECUTION = "EXECUTION"
    LATERAL_MOVEMENT = "LATERAL_MOVEMENT"
    EXFILTRATION = "EXFILTRATION"

    @classmethod
    def from_str(cls, value: str) -> "AttackStage":
        normalized = value.strip().upper()
        # Handle stage aliases
        mapping = {
            "RECON": cls.SCANNING,
            "RECONNAISSANCE": cls.SCANNING,
            "SCAN": cls.SCANNING,
            "SCANNING": cls.SCANNING,
            "ACCESS": cls.INITIAL_ACCESS,
            "INITIAL_ACCESS": cls.INITIAL_ACCESS,
            "EXPLOIT": cls.EXECUTION,
            "EXECUTION": cls.EXECUTION,
            "LATERAL": cls.LATERAL_MOVEMENT,
            "LATERAL_MOVEMENT": cls.LATERAL_MOVEMENT,
            "EXFIL": cls.EXFILTRATION,
            "EXFILTRATION": cls.EXFILTRATION,
            "IMPACT": cls.EXFILTRATION
        }
        return mapping.get(normalized, cls.SCANNING)

    @property
    def stage_index(self) -> int:
        order = [
            AttackStage.SCANNING,
            AttackStage.INITIAL_ACCESS,
            AttackStage.EXECUTION,
            AttackStage.LATERAL_MOVEMENT,
            AttackStage.EXFILTRATION
        ]
        return order.index(self)

    @property
    def severity_weight(self) -> float:
        weights = {
            AttackStage.SCANNING: 0.2,
            AttackStage.INITIAL_ACCESS: 0.4,
            AttackStage.EXECUTION: 0.65,
            AttackStage.LATERAL_MOVEMENT: 0.85,
            AttackStage.EXFILTRATION: 1.0
        }
        return weights.get(self, 0.5)


class ThreatLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


@dataclass
class ThreatState:
    """
    Internal normalized seed state representation used by all simulation algorithms.
    """
    threat_score: float
    momentum: float
    attack_probability: float
    attack_type: str
    current_stage: AttackStage
    affected_asset: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def from_input(cls, input_data: ThreatStateInput) -> "ThreatState":
        """
        Creates a normalized ThreatState instance from validated input data.
        """
        stage = AttackStage.from_str(input_data.current_stage)
        
        # Collect extra metadata passed from Module 2 if any
        extra_meta = getattr(input_data, "__pydantic_extra__", {}) or {}

        return cls(
            threat_score=float(input_data.threat_score),
            momentum=float(input_data.threat_momentum),
            attack_probability=float(input_data.attack_probability),
            attack_type=str(input_data.attack_type).strip().upper(),
            current_stage=stage,
            affected_asset=str(input_data.affected_asset).strip().upper(),
            metadata=dict(extra_meta)
        )

    @property
    def threat_level(self) -> ThreatLevel:
        """
        Calculates human-readable threat severity tier.
        """
        if self.threat_score >= 0.80:
            return ThreatLevel.CRITICAL
        elif self.threat_score >= 0.60:
            return ThreatLevel.HIGH
        elif self.threat_score >= 0.35:
            return ThreatLevel.MEDIUM
        return ThreatLevel.LOW

    @property
    def momentum_description(self) -> str:
        """
        Translates numerical momentum into dynamic contextual description.
        """
        if self.momentum > 0.10:
            return "increasing rapidly"
        elif self.momentum > 0.02:
            return "increasing"
        elif self.momentum < -0.05:
            return "decreasing"
        return "stable"

    def to_current_state_output(self) -> CurrentStateOutput:
        """
        Converts to the exact current_state payload required by Module 4.
        """
        return CurrentStateOutput(
            threat_score=round(self.threat_score, 4),
            attack_probability=round(self.attack_probability, 4),
            current_stage=self.current_stage.value,
            affected_asset=self.affected_asset
        )

    def copy(self) -> "ThreatState":
        """
        Returns a shallow copy of the state for counterfactual branching.
        """
        return ThreatState(
            threat_score=self.threat_score,
            momentum=self.momentum,
            attack_probability=self.attack_probability,
            attack_type=self.attack_type,
            current_stage=self.current_stage,
            affected_asset=self.affected_asset,
            metadata=self.metadata.copy()
        )
