"""
schemas.py: Input and Output Data Contracts for Module 3
=========================================================
Defines the strict interfaces:
  - Inbound Contract from Module 2 (Threat Detection & Forecast)
  - Outbound Contract to Module 4 (Executive Dashboard)
  - Structured Error Response Contract
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict


class ThreatStateInput(BaseModel):
    """
    Input schema from Module 2.
    Supports flexible aliases and extra fields so future Module 2 schema evolutions
    integrate seamlessly without breaking changes.
    """
    model_config = ConfigDict(
        populate_by_name=True,
        extra="allow",
        json_schema_extra={
            "example": {
                "threat_score": 0.87,
                "threat_momentum": 0.18,
                "attack_probability": 0.87,
                "attack_type": "DDoS",
                "current_stage": "SCANNING",
                "affected_asset": "API_GATEWAY"
            }
        }
    )

    threat_score: float = Field(
        ...,
        description="Current composite threat intensity score between 0.0 and 1.0",
        ge=0.0,
        le=1.0
    )
    threat_momentum: float = Field(
        ...,
        alias="momentum",
        description="Rate of change or velocity of the threat escalation [-1.0, 1.0]",
        ge=-1.0,
        le=1.0
    )
    attack_probability: float = Field(
        ...,
        description="Calculated likelihood of active attack execution between 0.0 and 1.0",
        ge=0.0,
        le=1.0
    )
    attack_type: str = Field(
        ...,
        description="Classified attack category (e.g., DDoS, Ransomware, BruteForce, DataExfiltration)",
        min_length=1
    )
    current_stage: str = Field(
        ...,
        description="Current kill-chain stage (e.g., SCANNING, INITIAL_ACCESS, EXECUTION, LATERAL_MOVEMENT, EXFILTRATION)",
        min_length=1
    )
    affected_asset: str = Field(
        ...,
        alias="asset",
        description="Target host, server, microservice or resource identifier (e.g., API_GATEWAY, DB_PRIMARY)",
        min_length=1
    )

    @field_validator("attack_type", "current_stage", "affected_asset", mode="before")
    @classmethod
    def normalize_strings(cls, v: Any) -> str:
        if isinstance(v, str):
            return v.strip().upper()
        return str(v).strip().upper()


class CurrentStateOutput(BaseModel):
    """
    Current state component of the Module 4 contract.
    """
    threat_score: float = Field(..., description="Current threat score")
    attack_probability: float = Field(..., description="Current attack probability")
    current_stage: str = Field(..., description="Current attack kill-chain stage")
    affected_asset: str = Field(..., description="Asset under threat")


class ScenarioOutput(BaseModel):
    """
    Simulated risk trajectory for a specific defensive action across fixed horizons.
    """
    action: str = Field(..., description="Defensive action identifier (e.g. NO_ACTION, BLOCK_SOURCES, ISOLATE_ASSET)")
    risk: Dict[str, float] = Field(
        ...,
        description="Projected risk score at horizons (e.g. {'2m': 0.90, '5m': 0.94, '10m': 0.98})"
    )


class RecommendationOutput(BaseModel):
    """
    Recommended optimal defensive action with calculated confidence score.
    """
    action: str = Field(..., description="Recommended defensive action name")
    confidence: float = Field(..., description="Confidence score for this recommendation [0.0, 1.0]", ge=0.0, le=1.0)


class Module4Output(BaseModel):
    """
    Exact single hand-off contract to Module 4 (Dashboard).
    The dashboard renders current state, scenarios, ranked recommendation,
    and dynamic explanations directly from this JSON.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "current_state": {
                    "threat_score": 0.87,
                    "attack_probability": 0.87,
                    "current_stage": "SCANNING",
                    "affected_asset": "API_GATEWAY"
                },
                "scenarios": [
                  {"action": "NO_ACTION", "risk": {"2m": 0.90, "5m": 0.94, "10m": 0.98}},
                  {"action": "BLOCK_SOURCES", "risk": {"2m": 0.70, "5m": 0.48, "10m": 0.30}},
                  {"action": "ISOLATE_ASSET", "risk": {"2m": 0.55, "5m": 0.30, "10m": 0.15}}
                ],
                "recommendation": {
                  "action": "ISOLATE_ASSET",
                  "confidence": 0.89
                },
                "explanation": [
                  "Current threat level is high",
                  "Threat momentum is increasing",
                  "Asset isolation produces the lowest projected future risk"
                ]
            }
        }
    )

    current_state: CurrentStateOutput
    scenarios: List[ScenarioOutput]
    recommendation: RecommendationOutput
    explanation: List[str]


class DetailedScenarioOutput(BaseModel):
    """
    Extended scenario representation containing granular stage probabilities,
    risk reduction metrics, and simulation details for deep dashboard views.
    """
    action: str
    action_description: str
    risk: Dict[str, float]
    risk_reduction_10m: float
    risk_reduction_pct_10m: float
    rank: int
    stage_probabilities: Dict[str, Dict[str, float]]
    is_recommended: bool


class Module4DetailedOutput(BaseModel):
    """
    Detailed output containing both the primary Module 4 contract and deep analytical metrics.
    """
    primary: Module4Output
    detailed_scenarios: List[DetailedScenarioOutput]
    all_rankings: List[Dict[str, Any]]
    confidence_breakdown: Dict[str, float]
    metadata: Dict[str, Any]


class ErrorResponse(BaseModel):
    """
    Structured error response schema.
    Ensures Module 3 returns clean errors without crashing on invalid or unexpected inputs.
    """
    status: str = "error"
    error_code: str
    message: str
    details: Optional[List[Dict[str, Any]]] = None
    input_received: Optional[Dict[str, Any]] = None
