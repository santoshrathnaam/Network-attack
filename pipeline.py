"""
pipeline.py: End-to-End Unified Integration Pipeline (Modules 1, 2, 3, and 4)
=============================================================================
Combines:
  - Module 1 (Traffic Analysis & Feature Extraction)
  - Module 2 (Attack Trajectory & Sequence Prediction)
  - Module 3 (Future Risk Engine & Counterfactual Simulator)
  - Module 4 (SOC Frontend Hand-off Contract & Live API)

All paths, cache, and state are strictly maintained within local workspace (D: drive).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

# Module 1 Imports
from module1_traffic import process_traffic, extract_window_features

# Module 2 Imports
from module2_forecast import predict, ThreatPredictor

# Module 3 Imports
from module3.api import execute_module3_pipeline
from module3 import (
    ThreatStateInput,
    Module4Output,
    FutureRiskSimulator,
    DefensiveAction
)

# Persistent predictor instance for stateful rolling window processing
_global_predictor = ThreatPredictor()


def run_end_to_end_pipeline(
    packets: Optional[List[Dict[str, Any]]] = None,
    features_override: Optional[Dict[str, Any]] = None,
    affected_asset: str = "API_GATEWAY",
    window_seconds: int = 10,
    timestamp: Optional[str] = None
) -> Dict[str, Any]:
    """
    Executes the entire 4-module pipeline in sequence:
      1. Module 1: Ingest packets / extract window features & baseline anomalies.
      2. Module 2: Predict threat score, trajectory stage, and attack probabilities.
      3. Module 3: Simulate counterfactual future risks & rank defensive actions.
      4. Module 4: Format full CyberDefenseState payload for SOC Dashboard interface.
    """
    ts = timestamp or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S")

    # Step 1: Module 1 Execution
    if features_override is not None:
        m1_output = {
            "features": features_override,
            "anomalies": {
                "traffic": float(features_override.get("traffic_anomaly", 0.0)),
                "syn": float(features_override.get("syn_anomaly", features_override.get("syn_rate", 0.0))),
                "source": float(features_override.get("source_anomaly", 0.0)),
                "connection": float(features_override.get("connection_anomaly", 0.0)),
            },
            "baseline_ready": True,
            "timestamp": ts
        }
    elif packets is not None and len(packets) > 0:
        # Standardize packets into Module 1 records format
        formatted_records = []
        for p in packets:
            formatted_records.append({
                "src_ip": str(p.get("src_ip", "192.168.1.1")),
                "dst_ip": str(p.get("dst_ip", "10.0.0.1")),
                "dst_port": int(p.get("dst_port", 80)),
                "protocol": str(p.get("protocol", "TCP")),
                "tcp_flag": p.get("tcp_flag", p.get("flags", "SYN")),
                "packet_size": int(p.get("packet_size", p.get("length", 64))),
                "connection_failed": bool(p.get("connection_failed", False))
            })
        m1_output = process_traffic(records=formatted_records, window_seconds=window_seconds)
    else:
        # High-traffic simulation default if no input is supplied
        sample_records = [
            {
                "src_ip": f"192.168.1.{i%50}",
                "dst_ip": "10.0.0.1",
                "dst_port": 80,
                "protocol": "TCP",
                "tcp_flag": "SYN",
                "packet_size": 64,
                "connection_failed": i % 5 == 0
            }
            for i in range(120)
        ]
        m1_output = process_traffic(records=sample_records, window_seconds=window_seconds)

    # Step 2: Module 2 Execution
    m2_output = _global_predictor.predict(
        input_data=m1_output,
        affected_asset=affected_asset,
        timestamp=ts
    )

    # Step 3: Module 3 Execution
    threat_score = m2_output.get("threat_score", 0.0)
    momentum = m2_output.get("threat_momentum", 0.0)
    attack_prob = m2_output.get("attack_probability", 0.0)
    attack_type = m2_output.get("predicted_attack", "DDoS")
    stage_name = m2_output.get("current_stage", "NORMAL")

    threat_input = ThreatStateInput(
        threat_score=min(1.0, max(0.0, threat_score)),
        momentum=min(1.0, max(-1.0, momentum)),
        attack_probability=min(1.0, max(0.0, attack_prob)),
        attack_type=attack_type,
        current_stage=stage_name,
        affected_asset=affected_asset
    )

    m3_primary, m3_detailed = execute_module3_pipeline(threat_input)

    # Step 4: Module 4 Contract Formatting
    if threat_score < 0.25:
        network_status = "SAFE"
    elif threat_score < 0.50:
        network_status = "WATCH"
    elif threat_score < 0.75:
        network_status = "ELEVATED"
    else:
        network_status = "CRITICAL"

    # Extract scenario risks for Module 4 simulation component
    scenario_map = {sc["action"]: sc["risk"].get("10m", 0.5) for sc in m3_primary.model_dump()["scenarios"]}
    no_action_risk = scenario_map.get("NO_ACTION", threat_score)
    block_sources_risk = scenario_map.get("BLOCK_SUSPICIOUS_SOURCES", scenario_map.get("BLOCK_SOURCES", threat_score * 0.45))
    isolate_server_risk = scenario_map.get("ISOLATE_AFFECTED_SERVER", scenario_map.get("ISOLATE_SERVER", threat_score * 0.27))

    simulation_data = {
        "no_action": round(no_action_risk, 2),
        "block_sources": round(block_sources_risk, 2),
        "isolate_server": round(isolate_server_risk, 2),
        "recommended_action": m3_primary.recommendation.action,
        "risk_reduction": round(max(0.0, no_action_risk - isolate_server_risk), 2)
    }

    # Format Evidence list from M2 / M1 signals
    evidence_items = []
    for ev in m2_output.get("evidence", []):
        if isinstance(ev, dict):
            evidence_items.append(ev)
        elif isinstance(ev, str):
            evidence_items.append({"name": ev, "change": 0.5, "severity": "MEDIUM"})

    if not evidence_items:
        evidence_items = [
            {"name": "SYN traffic", "change": round(m1_output["anomalies"].get("syn", 0.2), 2), "unit": "pkts/s", "severity": "HIGH"},
            {"name": "Unique source IPs", "change": round(m1_output["anomalies"].get("source", 0.15), 2), "unit": "hosts", "severity": "MEDIUM"},
            {"name": "Traffic momentum", "change": round(momentum, 2), "unit": "Mb/s²", "severity": "HIGH"}
        ]

    cyber_defense_state = {
        "timestamp": ts,
        "network_status": network_status,
        "threat": {
            "score": round(threat_score, 2),
            "momentum": round(momentum, 2),
            "time_to_escalation": m2_output.get("time_to_escalation_minutes", 5)
        },
        "forecast": m2_output.get("forecast_probabilities", {"DDoS": 0.85, "Recon": 0.10, "PortScan": 0.05}),
        "trajectory": {
            "current_stage": stage_name,
            "next_stage": m2_output.get("next_stage", "ANOMALY"),
            "stages": ["NORMAL", "ANOMALY", "SCANNING", "ATTACK_IMMINENT", "DDoS"],
            "stage_progress": m2_output.get("stage_progress", 0.5)
        },
        "evidence": evidence_items,
        "simulation": simulation_data,
        "traffic_history": [
            {
                "timestamp": ts,
                "time_offset": -30,
                "traffic_volume": 240,
                "baseline": 200,
                "anomaly_threshold": 450,
                "status": network_status
            }
        ],
        "module_outputs": {
            "module1": m1_output,
            "module2": m2_output,
            "module3": m3_detailed.model_dump()
        }
    }

    return cyber_defense_state


# FastAPI Unified Application Setup
pipeline_app = FastAPI(
    title="SIH26153 - Unified 4-Module Cyber Defense Pipeline Server",
    description="Unified API server connecting Module 1 (Traffic), Module 2 (Trajectory), Module 3 (Future Risk), and Module 4 (SOC Frontend)",
    version="1.0.0"
)

pipeline_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@pipeline_app.get("/health")
@pipeline_app.get("/api/v1/health")
async def health():
    return {"status": "healthy", "pipeline": "M1 -> M2 -> M3 -> M4", "storage": "D: Drive Workspace"}


@pipeline_app.get("/api/v1/state")
@pipeline_app.get("/state")
async def get_pipeline_state():
    """
    Returns the unified live pipeline state matching Module 4 contract.
    """
    return run_end_to_end_pipeline()


@pipeline_app.post("/api/v1/pipeline/run")
@pipeline_app.post("/pipeline/run")
async def run_pipeline_endpoint(request: Request):
    """
    Accepts raw packet telemetry or features, runs M1->M2->M3->M4, and returns full state.
    """
    body = await request.json() if request.headers.get("content-type") == "application/json" else {}
    packets = body.get("packets")
    features = body.get("features")
    asset = body.get("affected_asset", "API_GATEWAY")

    res = run_end_to_end_pipeline(packets=packets, features_override=features, affected_asset=asset)
    return res


@pipeline_app.post("/api/v1/simulate")
@pipeline_app.post("/simulate")
async def simulate_endpoint(request: Request):
    """
    Simulates counterfactual response options for Module 4 response modal.
    """
    body = await request.json()
    action = body.get("action", "NO_ACTION")
    
    current_state = run_end_to_end_pipeline()
    score = current_state["threat"]["score"]
    
    reduction = 0.73 if "ISOLATE" in action else (0.55 if "BLOCK" in action else 0.0)
    
    return {
        "no_action": min(0.98, round(score * 1.07, 2)),
        "block_sources": round(score * 0.45, 2),
        "isolate_server": round(score * 0.27, 2),
        "recommended_action": "ISOLATE_SERVER" if score > 0.6 else "BLOCK_SOURCES",
        "risk_reduction": reduction
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("pipeline:pipeline_app", host="0.0.0.0", port=8000, reload=True)
