"""
test_simulator.py: Unit Tests for Future Risk Simulator Engine
===============================================================
Validates state transition formulas, counterfactual horizon progression,
clamping, monotonicity, stage transitions, and deterministic execution.
"""

import pytest
from module3.schemas import ThreatStateInput
from module3.state import ThreatState, AttackStage
from module3.action_model import DefensiveAction, ActionCatalog
from module3.simulator import FutureRiskSimulator


@pytest.fixture
def sample_threat_state():
    """Returns a realistic seed threat state matching Module 2 output."""
    raw = {
        "threat_score": 0.87,
        "threat_momentum": 0.18,
        "attack_probability": 0.87,
        "attack_type": "DDoS",
        "current_stage": "SCANNING",
        "affected_asset": "API_GATEWAY"
    }
    input_data = ThreatStateInput(**raw)
    return ThreatState.from_input(input_data)


@pytest.fixture
def simulator():
    return FutureRiskSimulator()


def test_simulation_generates_all_horizons(simulator, sample_threat_state):
    """Verifies that the simulation generates results for all 3 horizons: 2m, 5m, 10m."""
    tree = simulator.simulate(sample_threat_state)
    assert len(tree.scenarios) >= 3

    for action in [DefensiveAction.NO_ACTION, DefensiveAction.BLOCK_SOURCES, DefensiveAction.ISOLATE_ASSET]:
        assert action in tree.scenarios
        scenario = tree.scenarios[action]
        assert set(scenario.risk_trajectory.keys()) == {"2m", "5m", "10m"}
        assert set(scenario.horizon_states.keys()) == {"2m", "5m", "10m"}


def test_no_action_risk_escalation(simulator, sample_threat_state):
    """Verifies that NO_ACTION leads to threat escalation over time."""
    tree = simulator.simulate(sample_threat_state)
    no_action = tree.scenarios[DefensiveAction.NO_ACTION]

    r_2m = no_action.risk_trajectory["2m"]
    r_5m = no_action.risk_trajectory["5m"]
    r_10m = no_action.risk_trajectory["10m"]

    assert r_2m >= sample_threat_state.threat_score or r_2m >= 0.85
    assert r_5m >= r_2m
    assert r_10m >= r_5m


def test_defensive_actions_relative_mitigation(simulator, sample_threat_state):
    """
    Verifies the relative efficacy order:
    Risk(ISOLATE_ASSET) < Risk(BLOCK_SOURCES) < Risk(NO_ACTION)
    """
    tree = simulator.simulate(sample_threat_state)
    no_action_10m = tree.scenarios[DefensiveAction.NO_ACTION].risk_trajectory["10m"]
    block_10m = tree.scenarios[DefensiveAction.BLOCK_SOURCES].risk_trajectory["10m"]
    isolate_10m = tree.scenarios[DefensiveAction.ISOLATE_ASSET].risk_trajectory["10m"]

    assert isolate_10m < block_10m < no_action_10m
    assert isolate_10m < 0.35  # Strong mitigation
    assert block_10m < 0.65   # Moderate mitigation


def test_risk_clamping_bounds(simulator):
    """Verifies that risk scores remain strictly clamped within [0.0, 1.0]."""
    # Extreme high threat state
    extreme_high = ThreatState(
        threat_score=1.0,
        momentum=1.0,
        attack_probability=1.0,
        attack_type="RANSOMWARE",
        current_stage=AttackStage.EXFILTRATION,
        affected_asset="DB_PRIMARY"
    )
    tree_high = simulator.simulate(extreme_high)
    for scenario in tree_high.scenarios.values():
        for r in scenario.risk_trajectory.values():
            assert 0.0 <= r <= 1.0

    # Extreme low threat state
    extreme_low = ThreatState(
        threat_score=0.05,
        momentum=-0.5,
        attack_probability=0.05,
        attack_type="SCANNING",
        current_stage=AttackStage.SCANNING,
        affected_asset="DEV_SERVER"
    )
    tree_low = simulator.simulate(extreme_low)
    for scenario in tree_low.scenarios.values():
        for r in scenario.risk_trajectory.values():
            assert 0.0 <= r <= 1.0


def test_deterministic_simulation(simulator, sample_threat_state):
    """Verifies that identical inputs yield bit-for-bit identical outputs."""
    tree1 = simulator.simulate(sample_threat_state)
    tree2 = simulator.simulate(sample_threat_state)

    for action in tree1.scenarios:
        traj1 = tree1.scenarios[action].risk_trajectory
        traj2 = tree2.scenarios[action].risk_trajectory
        assert traj1 == traj2


def test_stage_progression_probability_sum(simulator, sample_threat_state):
    """Verifies that stage progression distributions sum to 1.0."""
    tree = simulator.simulate(sample_threat_state)
    for scenario in tree.scenarios.values():
        for h_state in scenario.horizon_states.values():
            prob_sum = sum(h_state.stage_probabilities.values())
            assert pytest.approx(prob_sum, 0.01) == 1.0
