"""
demo.py: Interactive Live Demo Runner for Module 3
===================================================
Simulates threat scenarios from Module 2, displays the step-by-step
counterfactual pipeline in the terminal, and prints the exact Module 4
JSON output payload ready for dashboard rendering.

Usage:
  python -m module3.demo
"""

import json
import time
from module3.schemas import ThreatStateInput
from module3.api import execute_module3_pipeline


def run_demo():
    print("=" * 80)
    print(">> MODULE 3: FUTURE RISK ENGINE + COUNTERFACTUAL SIMULATOR (DEMO)")
    print("=" * 80)

    # 1. Simulate inbound payload from Module 2
    sample_module2_payload = {
        "threat_score": 0.87,
        "threat_momentum": 0.18,
        "attack_probability": 0.87,
        "attack_type": "DDoS",
        "current_stage": "SCANNING",
        "affected_asset": "API_GATEWAY"
    }

    print("\n[Step 1] Ingesting Payload from Module 2:")
    print(json.dumps(sample_module2_payload, indent=2))

    t_start = time.perf_counter()

    # Ingest & Validate
    threat_input = ThreatStateInput(**sample_module2_payload)

    # Run complete 10-step pipeline
    primary_out, detailed_out = execute_module3_pipeline(threat_input, round_decimals=2)

    latency_ms = (time.perf_counter() - t_start) * 1000.0

    print(f"\n[Step 2] Simulation Execution Complete (Latency: {latency_ms:.2f}ms)")

    print("\n[Step 3] Counterfactual Future Scenarios Evaluated:")
    print("-" * 65)
    print(f"{'Action':<18} | {'+2 min Risk':<12} | {'+5 min Risk':<12} | {'+10 min Risk':<12}")
    print("-" * 65)
    for sc in primary_out.scenarios:
        r2 = f"{sc.risk.get('2m', 0.0):.2f}"
        r5 = f"{sc.risk.get('5m', 0.0):.2f}"
        r10 = f"{sc.risk.get('10m', 0.0):.2f}"
        print(f"{sc.action:<18} | {r2:<12} | {r5:<12} | {r10:<12}")
    print("-" * 65)

    print("\n[Step 4] Ranked Recommendation & Confidence:")
    print(f"  * Recommended Action: {primary_out.recommendation.action}")
    print(f"  * Confidence Score:   {primary_out.recommendation.confidence:.2f}")

    print("\n[Step 5] Dynamic Simulation-Derived Explanations:")
    for bullet in primary_out.explanation:
        print(f"  - {bullet}")

    print("\n[Step 6] Exact Hand-off JSON Contract to Module 4 (Dashboard):")
    print("=" * 80)
    print(json.dumps(primary_out.model_dump(), indent=2))
    print("=" * 80)


if __name__ == "__main__":
    run_demo()
