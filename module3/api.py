"""
api.py: FastAPI REST Service for Module 4 Dashboard Hand-off
=============================================================
Exposes high-performance, robust API endpoints for Module 3.
Accepts Module 2 threat forecasts, executes counterfactual risk simulations,
and delivers the exact JSON payload expected by Module 4.
"""

import os
import time
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse

from .schemas import (
    ThreatStateInput,
    Module4Output,
    Module4DetailedOutput,
    DetailedScenarioOutput,
    RecommendationOutput,
    CurrentStateOutput,
    ErrorResponse,
)
from .state import ThreatState
from .action_model import DefensiveAction
from .simulator import FutureRiskSimulator
from .ranking import ActionRanker
from .confidence import ConfidenceScorer
from .explainability import ExplanationGenerator

# Initialize FastAPI Application
app = FastAPI(
    title="Module 3: Future Risk Engine & Counterfactual Simulator",
    description=(
        "Predictive cybersecurity simulation engine. Evaluates defensive actions, "
        "projects future risk trajectories (+2m, +5m, +10m), and delivers ranked "
        "explainable mitigation recommendations to Module 4."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS for frontend dashboard (Module 4) integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Instantiate Core Engine Components
simulator = FutureRiskSimulator()
ranker = ActionRanker(primary_horizon="10m")
confidence_scorer = ConfidenceScorer()
explanation_generator = ExplanationGenerator()
start_time = time.time()


# ==============================================================================
# Structured Exception Handlers (Never crash on invalid input)
# ==============================================================================

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Handles Pydantic validation errors gracefully with structured error payload.
    """
    error_details = []
    for err in exc.errors():
        error_details.append({
            "field": " -> ".join([str(loc) for loc in err.get("loc", [])]),
            "message": err.get("msg", "Invalid input value"),
            "type": err.get("type", "value_error")
        })

    response_body = ErrorResponse(
        status="error",
        error_code="VALIDATION_ERROR",
        message="Inbound threat state from Module 2 failed validation rules.",
        details=error_details
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=response_body.model_dump()
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """
    Catches any unforeseen runtime exception and returns clean structured error.
    """
    response_body = ErrorResponse(
        status="error",
        error_code="INTERNAL_PROCESSING_ERROR",
        message=f"Simulation error: {str(exc)}"
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=response_body.model_dump()
    )


# ==============================================================================
# Helper Orchestration Function
# ==============================================================================

def execute_module3_pipeline(
    payload: ThreatStateInput,
    round_decimals: int = 2
) -> tuple[Module4Output, Module4DetailedOutput]:
    """
    Runs the full 10-step Module 3 pipeline deterministically:
      1. Validate Input
      2. Create Current Network State
      3. Generate Possible Actions
      4. Simulate Future for Each Action
      5. Calculate Future Risk
      6. Compare Scenarios
      7. Rank Defensive Actions
      8. Calculate Confidence
      9. Generate Explanation
      10. Generate Final Recommendation
    """
    # 1 & 2. State Ingestion & Normalization
    seed_state = ThreatState.from_input(payload)

    # 3, 4, 5. Counterfactual Simulation across Horizons
    tree = simulator.simulate(seed_state)

    # 6 & 7. Compare Scenarios and Rank Actions
    ranked_actions = ranker.rank_actions(tree)
    optimal_action = ranker.get_optimal_action(ranked_actions)

    # 8. Compute Explainable Confidence Score
    confidence, confidence_breakdown = confidence_scorer.compute_confidence(
        seed_state=seed_state,
        tree=tree,
        ranked_actions=ranked_actions
    )

    # 9. Generate Human-Readable Dynamic Explanation
    explanation = explanation_generator.generate_explanation(
        seed_state=seed_state,
        tree=tree,
        ranked_actions=ranked_actions
    )

    # 10. Assemble Exact Module 4 Output Contract
    # Rounding scenario risks for clean dashboard consumption
    scenario_outputs = []
    for sc in tree.to_scenario_outputs():
        scenario_outputs.append({
            "action": sc.action,
            "risk": {h: round(v, round_decimals) for h, v in sc.risk.items()}
        })

    module4_payload = Module4Output(
        current_state=CurrentStateOutput(
            threat_score=round(seed_state.threat_score, round_decimals),
            attack_probability=round(seed_state.attack_probability, round_decimals),
            current_stage=seed_state.current_stage.value,
            affected_asset=seed_state.affected_asset
        ),
        scenarios=scenario_outputs,  # type: ignore
        recommendation=RecommendationOutput(
            action=optimal_action.action.value if hasattr(optimal_action.action, "value") else str(optimal_action.action),
            confidence=confidence
        ),
        explanation=explanation
    )

    # Assemble Detailed Analytical Payload
    no_action_scenario = tree.get_scenario(DefensiveAction.NO_ACTION)
    baseline_10m = no_action_scenario.risk_trajectory.get("10m", 1.0) if no_action_scenario else 1.0

    detailed_scenarios: List[DetailedScenarioOutput] = []
    for rank_idx, r_act in enumerate(ranked_actions):
        sc = tree.get_scenario(r_act.action)
        if sc:
            detailed_scenarios.append(
                sc.to_detailed_output(
                    rank=r_act.rank,
                    baseline_risk_10m=baseline_10m,
                    is_recommended=(r_act.rank == 1)
                )
            )

    justification = explanation_generator.generate_detailed_justification(
        seed_state=seed_state,
        tree=tree,
        ranked_actions=ranked_actions
    )

    detailed_payload = Module4DetailedOutput(
        primary=module4_payload,
        detailed_scenarios=detailed_scenarios,
        all_rankings=[r.to_dict() for r in ranked_actions],
        confidence_breakdown=confidence_breakdown,
        metadata={
            "justification": justification,
            "horizons": simulator.horizons,
            "attack_type": seed_state.attack_type,
            "pipeline_version": "1.0.0"
        }
    )

    return module4_payload, detailed_payload


# ==============================================================================
# Web Dashboard & API Endpoints
# ==============================================================================

@app.get(
    "/",
    response_class=HTMLResponse,
    summary="Interactive Cyber Defense & Simulation Dashboard",
    include_in_schema=False
)
@app.get(
    "/dashboard",
    response_class=HTMLResponse,
    summary="Interactive Cyber Defense & Simulation Dashboard",
    tags=["Dashboard"]
)
async def serve_dashboard():
    """
    Renders the live interactive Module 3 Cyber Defense Simulation Dashboard.
    """
    dashboard_path = os.path.join(os.path.dirname(__file__), "dashboard.html")
    if os.path.exists(dashboard_path):
        with open(dashboard_path, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    return HTMLResponse(
        content="<h2>Dashboard template not found. Please visit /docs for API endpoints.</h2>",
        status_code=404
    )


@app.post(
    "/simulate",
    response_model=Module4Output,
    status_code=status.HTTP_200_OK,
    summary="Simulate counterfactual futures and get Module 4 recommendation payload",
    tags=["Module 4 Hand-off"]
)
@app.post(
    "/api/v1/recommend",
    response_model=Module4Output,
    status_code=status.HTTP_200_OK,
    include_in_schema=False
)
async def simulate_threat_scenarios(payload: ThreatStateInput):
    """
    **Primary Hand-off Endpoint for Module 4 (Dashboard).**
    
    Accepts threat telemetry from Module 2, simulates counterfactual scenarios
    across +2m, +5m, +10m horizons, and returns the exact single contract payload.
    """
    primary_out, _ = execute_module3_pipeline(payload)
    return primary_out


@app.post(
    "/simulate/detailed",
    response_model=Module4DetailedOutput,
    status_code=status.HTTP_200_OK,
    summary="Simulate with full analytical breakdowns, stage probabilities, and deltas",
    tags=["Deep Analytics"]
)
async def simulate_threat_scenarios_detailed(payload: ThreatStateInput):
    """
    Extended simulation endpoint providing stage probability distributions,
    ranking deltas, and confidence score breakdowns.
    """
    _, detailed_out = execute_module3_pipeline(payload, round_decimals=4)
    return detailed_out


@app.get(
    "/actions",
    summary="List available defensive actions and their current configuration",
    tags=["Action Catalog"]
)
async def list_defensive_actions():
    """
    Returns the catalog of defensive actions (both active and extensible).
    """
    actions_info = []
    for meta in simulator.action_catalog._actions.values():
        actions_info.append({
            "action": meta.action.value if hasattr(meta.action, "value") else str(meta.action),
            "name": meta.name,
            "description": meta.description,
            "base_effect": meta.base_effect,
            "rate_per_min": meta.rate_per_min,
            "enabled": meta.enabled,
            "target_attack_types": meta.target_attack_types,
            "side_effects": meta.side_effects
        })
    return {"actions": actions_info}


@app.get(
    "/config",
    summary="Get current simulation parameters and coefficients",
    tags=["Configuration"]
)
async def get_simulation_config():
    """
    Returns the active simulation configuration parameters.
    """
    return simulator.config


@app.get(
    "/health",
    summary="System health status check",
    tags=["System"]
)
async def health_check():
    """
    Service health check and uptime monitor.
    """
    return {
        "status": "healthy",
        "service": "Module 3: Future Risk Engine",
        "version": "1.0.0",
        "uptime_seconds": round(time.time() - start_time, 2)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("module3.api:app", host="0.0.0.0", port=8000, reload=True)
