"""
demo.py: Interactive Live Demo Runner for Module 2
===================================================
Executes Module 1 synthetic traffic generator, feeds outputs through Module 2
Threat Predictor, and prints stage-by-stage forecasts and JSON contracts.

Usage:
    python -m module2_forecast.demo
"""

import json
import time
from module1_traffic.traffic_generator import generate_demo_traffic
from module1_traffic.baseline import AdaptiveBaseline
from module1_traffic.feature_extractor import process_traffic

from module2_forecast.predictor import ThreatPredictor


def run_demo():
    print("=" * 80)
    print(">> MODULE 2: THREAT FORECASTING & ATTACK TRAJECTORY ENGINE (DEMO)")
    print("=" * 80)

    predictor = ThreatPredictor()
    baseline = AdaptiveBaseline()

    print("\n[Step 1] Processing Network Flow Stream & Forecasting Threat Progression...")
    print("-" * 80)
    print(f"{'Scene Label':<20} | {'Threat':<7} | {'Momentum':<8} | {'Current Stage':<16} | {'Next Stage':<16} | {'Escalation'}")
    print("-" * 80)

    last_forecast = None
    for stage_label, records in generate_demo_traffic():
        # Module 1 -> Module 2 pipeline
        m1_output = process_traffic(records, baseline=baseline)
        forecast = predictor.predict(m1_output)
        last_forecast = forecast

        score_pct = f"{int(forecast['threat_score'] * 100)}%"
        mom_str = f"{forecast['threat_momentum']:+.2f}/m"
        esc_str = f"{forecast['time_to_escalation_minutes']} min" if forecast['time_to_escalation_minutes'] < 99 else "None"

        print(
            f"{stage_label:<20} | {score_pct:<7} | {mom_str:<8} | "
            f"{forecast['current_stage']:<16} | {forecast['next_stage']:<16} | {esc_str}"
        )

    print("-" * 80)

    print("\n[Step 2] Final Forecast Evidence & Attack Probabilities:")
    if last_forecast:
        print("\n  * Primary Predicted Attack:", last_forecast["predicted_attack"])
        print("  * Attack Probability:      ", f"{int(last_forecast['attack_probability'] * 100)}%")
        print("  * Attack Family Breakdown: ")
        for attack_name, prob in last_forecast["forecast_probabilities"].items():
            print(f"      - {attack_name:<20}: {int(prob * 100)}%")

        print("\n  * Contributing Evidence:")
        for ev in last_forecast["evidence"]:
            print(f"      - {ev['name']:<22}: +{int(ev['change'] * 100)}% ({ev['severity']} severity)")

    print("\n[Step 3] Exact Hand-off JSON Contract to Module 3 (Simulator):")
    print("=" * 80)
    if last_forecast:
        print(json.dumps(last_forecast, indent=2))
    print("=" * 80)


if __name__ == "__main__":
    run_demo()
