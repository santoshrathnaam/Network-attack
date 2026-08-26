"""
test_pipeline.py: Verification tests for the unified 4-module pipeline
========================================================================
Tests:
  1. End-to-end execution of run_end_to_end_pipeline()
  2. Integration of Module 1, Module 2, Module 3 outputs into Module 4 state
  3. API endpoints using FastAPI TestClient
"""

import pytest
from fastapi.testclient import TestClient
from pipeline import run_end_to_end_pipeline, pipeline_app

client = TestClient(pipeline_app)


def test_run_end_to_end_pipeline_default():
    state = run_end_to_end_pipeline()
    assert "timestamp" in state
    assert state["network_status"] in ["SAFE", "WATCH", "ELEVATED", "CRITICAL"]
    assert "threat" in state
    assert "score" in state["threat"]
    assert "forecast" in state
    assert "trajectory" in state
    assert "evidence" in state
    assert "simulation" in state
    assert "recommended_action" in state["simulation"]
    assert "module_outputs" in state
    assert "module1" in state["module_outputs"]
    assert "module2" in state["module_outputs"]
    assert "module3" in state["module_outputs"]


def test_run_end_to_end_pipeline_with_custom_features():
    features = {
        "packets_per_second": 5000,
        "bytes_per_second": 3200000,
        "syn_rate": 0.85,
        "syn_ratio": 0.90,
        "port_entropy": 0.15,
        "unique_source_ips": 1500,
        "connection_failed_rate": 0.75,
        "traffic_anomaly": 0.90,
        "syn_anomaly": 0.95,
        "source_anomaly": 0.85,
        "connection_anomaly": 0.80
    }

    state = run_end_to_end_pipeline(features_override=features, affected_asset="DB_PRIMARY")
    assert state["threat"]["score"] > 0.5
    assert state["trajectory"]["current_stage"] != ""
    assert state["simulation"]["risk_reduction"] >= 0.0


def test_pipeline_api_health():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "healthy"
    assert "storage" in data
    assert "D: Drive Workspace" in data["storage"]


def test_pipeline_api_state():
    res = client.get("/api/v1/state")
    assert res.status_code == 200
    data = res.json()
    assert "threat" in data
    assert "simulation" in data


def test_pipeline_api_run():
    res = client.post("/api/v1/pipeline/run", json={"affected_asset": "WEB_FRONTEND"})
    assert res.status_code == 200
    data = res.json()
    assert data["module_outputs"]["module2"]["affected_asset"] == "WEB_FRONTEND"


def test_pipeline_api_simulate():
    res = client.post("/api/v1/simulate", json={"action": "ISOLATE_SERVER"})
    assert res.status_code == 200
    data = res.json()
    assert "no_action" in data
    assert "risk_reduction" in data
