"""
test_ranking.py: Unit Tests for Ranking, Confidence & Explainability
====================================================================
Tests action ranker, risk reduction deltas, confidence scoring calculations,
and dynamic natural language explanation generation.
"""

import pytest
from module3.schemas import ThreatStateInput
from module3.state import ThreatState, AttackStage
from module3.action_model import DefensiveAction
from module3.simulator import FutureRiskSimulator
from module3.ranking import ActionRanker
from module3.confidence import ConfidenceScorer
from module3.explainability import ExplanationGenerator


@pytest.fixture
def simulated_tree():
    raw = {
        "threat_score": 0.87,
        "threat_momentum": 0.18,
        "attack_probability": 0.87,
        "attack_type": "DDoS",
        "current_stage": "SCANNING",
        "affected_asset": "API_GATEWAY"
    }
    input_data = ThreatStateInput(**raw)
    seed_state = ThreatState.from_input(input_data)
    sim = FutureRiskSimulator()
    return seed_state, sim.simulate(seed_state)


def test_ranking_identifies_isolate_asset_as_optimal(simulated_tree):
    """Verifies that ISOLATE_ASSET is ranked #1 for critical DDoS threat scenario."""
    seed_state, tree = simulated_tree
    ranker = ActionRanker(primary_horizon="10m")
    ranked = ranker.rank_actions(tree)

    assert len(ranked) >= 3
    assert ranked[0].action == DefensiveAction.ISOLATE_ASSET
    assert ranked[0].rank == 1
    assert ranked[0].is_best_action is True
    assert ranked[1].action == DefensiveAction.BLOCK_SOURCES
    assert ranked[1].rank == 2
    assert ranked[2].action == DefensiveAction.NO_ACTION
    assert ranked[2].rank == 3


def test_risk_reduction_calculation(simulated_tree):
    """Verifies that risk reductions are computed correctly relative to NO_ACTION."""
    seed_state, tree = simulated_tree
    ranker = ActionRanker(primary_horizon="10m")
    ranked = ranker.rank_actions(tree)

    no_act = [r for r in ranked if r.action == DefensiveAction.NO_ACTION][0]
    isolate = [r for r in ranked if r.action == DefensiveAction.ISOLATE_ASSET][0]
    block = [r for r in ranked if r.action == DefensiveAction.BLOCK_SOURCES][0]

    assert no_act.risk_reduction_10m == 0.0
    assert no_act.risk_reduction_pct_10m == 0.0
    assert isolate.risk_reduction_10m > block.risk_reduction_10m > 0.0
    assert isolate.risk_reduction_pct_10m > block.risk_reduction_pct_10m > 0.0


def test_confidence_scorer_bounds_and_breakdown(simulated_tree):
    """Verifies confidence score computation, bounds, and breakdown factors."""
    seed_state, tree = simulated_tree
    ranker = ActionRanker()
    ranked = ranker.rank_actions(tree)
    
    scorer = ConfidenceScorer()
    confidence, breakdown = scorer.compute_confidence(seed_state, tree, ranked)

    assert 0.0 <= confidence <= 1.0
    assert confidence >= 0.70  # Clean data + decisive victory should give high confidence
    assert "input_quality" in breakdown
    assert "forecast_confidence" in breakdown
    assert "simulation_stability" in breakdown
    assert "action_efficacy_margin" in breakdown


def test_explanation_generator_dynamic_content(simulated_tree):
    """Verifies that explanations are non-empty, dynamic, and mention key metrics."""
    seed_state, tree = simulated_tree
    ranker = ActionRanker()
    ranked = ranker.rank_actions(tree)

    expl_gen = ExplanationGenerator()
    explanation = expl_gen.generate_explanation(seed_state, tree, ranked)

    assert isinstance(explanation, list)
    assert len(explanation) >= 3
    # Check that high/critical threat level is identified
    assert any("critical" in line.lower() or "high" in line.lower() for line in explanation)
    # Check that momentum is mentioned
    assert any("momentum" in line.lower() for line in explanation)
    # Check that asset isolation / action is mentioned
    assert any("isolation" in line.lower() or "isolate" in line.lower() for line in explanation)


def test_detailed_justification_generation(simulated_tree):
    """Verifies detailed analytical justification output."""
    seed_state, tree = simulated_tree
    ranker = ActionRanker()
    ranked = ranker.rank_actions(tree)

    expl_gen = ExplanationGenerator()
    detailed = expl_gen.generate_detailed_justification(seed_state, tree, ranked)

    assert "key_takeaways" in detailed
    assert "summary_bullets" in detailed
    assert detailed["target_asset"] == "API_GATEWAY"
    assert detailed["attack_type"] == "DDOS"
    assert len(detailed["key_takeaways"]) >= 2
