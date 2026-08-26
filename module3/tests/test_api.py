"""
test_api.py: API Integration and Contract Compliance Tests
===========================================================
Validates HTTP endpoints, input contract from Module 2, output contract
to Module 4, validation error handling, and health endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from module3.api import app
from module3.schemas import Module4Output


@pytest.fixture
def client():
    return TestClient(app)


def test_simulate_endpoint_exact_module4_contract(client):
    """
    Verifies that POST /simulate accepts Module 2 input and returns
    the exact JSON payload required by Module 4.
    """
    payload = {
        "threat_score": 0.87,
        "threat_momentum": 0.18,
        "attack_probability": 0.87,
        "attack_type": "DDoS",
        "current_stage": "SCANNING",
        "affected_asset": "API_GATEWAY"
    }

    response = client.post("/simulate", json=payload)
    assert response.status_code == 200
    data = response.json()

    # Verify Pydantic schema validation of output
    validated_out = Module4Output(**data)
    assert validated_out is not None

    # Verify root level keys
    assert "current_state" in data
    assert "scenarios" in data
    assert "recommendation" in data
    assert "explanation" in data

    # Verify current_state structure
    cs = data["current_state"]
    assert cs["threat_score"] == 0.87
    assert cs["attack_probability"] == 0.87
    assert cs["current_stage"] == "SCANNING"
    assert cs["affected_asset"] == "API_GATEWAY"

    # Verify scenarios structure
    scenarios = data["scenarios"]
    assert len(scenarios) >= 3
    action_names = [s["action"] for s in scenarios]
    assert "NO_ACTION" in action_names
    assert "BLOCK_SOURCES" in action_names
    assert "ISOLATE_ASSET" in action_names

    for s in scenarios:
        assert "action" in s
        assert "risk" in s
        assert set(s["risk"].keys()) == {"2m", "5m", "10m"}
        for h, v in s["risk"].items():
            assert 0.0 <= v <= 1.0

    # Verify recommendation structure
    rec = data["recommendation"]
    assert rec["action"] == "ISOLATE_ASSET"
    assert 0.0 <= rec["confidence"] <= 1.0

    # Verify explanation structure
    expl = data["explanation"]
    assert isinstance(expl, list)
    assert len(expl) >= 3
    assert all(isinstance(item, str) for item in expl)


def test_alias_field_support(client):
    """
    Verifies that alternative field names (e.g. 'momentum', 'asset')
    are correctly ingested from Module 2.
    """
    payload_with_aliases = {
        "threat_score": 0.75,
        "momentum": 0.10,
        "attack_probability": 0.80,
        "attack_type": "Ransomware",
        "current_stage": "INITIAL_ACCESS",
        "asset": "DB_PRIMARY"
    }

    response = client.post("/simulate", json=payload_with_aliases)
    assert response.status_code == 200
    data = response.json()
    assert data["current_state"]["affected_asset"] == "DB_PRIMARY"
    assert data["current_state"]["current_stage"] == "INITIAL_ACCESS"


def test_invalid_input_validation_errors(client):
    """
    Verifies that invalid input triggers structured error responses without crashing.
    """
    # 1. Missing required fields
    incomplete_payload = {
        "threat_score": 0.87,
        "threat_momentum": 0.18
    }
    resp1 = client.post("/simulate", json=incomplete_payload)
    assert resp1.status_code == 422
    data1 = resp1.json()
    assert data1["status"] == "error"
    assert data1["error_code"] == "VALIDATION_ERROR"
    assert len(data1["details"]) >= 1

    # 2. Probability score out of bounds (> 1.0)
    out_of_bounds_payload = {
        "threat_score": 1.87,  # invalid
        "threat_momentum": 0.18,
        "attack_probability": 0.87,
        "attack_type": "DDoS",
        "current_stage": "SCANNING",
        "affected_asset": "API_GATEWAY"
    }
    resp2 = client.post("/simulate", json=out_of_bounds_payload)
    assert resp2.status_code == 422
    data2 = resp2.json()
    assert data2["error_code"] == "VALIDATION_ERROR"


def test_simulate_detailed_endpoint(client):
    """
    Verifies the deep analytical /simulate/detailed endpoint.
    """
    payload = {
        "threat_score": 0.87,
        "threat_momentum": 0.18,
        "attack_probability": 0.87,
        "attack_type": "DDoS",
        "current_stage": "SCANNING",
        "affected_asset": "API_GATEWAY"
    }

    response = client.post("/simulate/detailed", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "primary" in data
    assert "detailed_scenarios" in data
    assert "all_rankings" in data
    assert "confidence_breakdown" in data
    assert "metadata" in data


def test_health_and_actions_endpoints(client):
    """
    Verifies GET /health and GET /actions endpoints.
    """
    health_resp = client.get("/health")
    assert health_resp.status_code == 200
    assert health_resp.json()["status"] == "healthy"

    actions_resp = client.get("/actions")
    assert actions_resp.status_code == 200
    actions = actions_resp.json()["actions"]
    assert len(actions) >= 3
    action_names = [a["action"] for a in actions]
    assert "NO_ACTION" in action_names
    assert "BLOCK_SOURCES" in action_names
    assert "ISOLATE_ASSET" in action_names
