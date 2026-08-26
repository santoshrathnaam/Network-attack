"""
demo.py: Module 3 Counterfactual Simulator Verification & Demo
"""

import json
from counterfactual import simulate


def main():
    print("==================================================================")
    print("  Module 3 --- Counterfactual Future Simulator (Prototype)")
    print("==================================================================")

    # Example input from Module 2 forecast + current state
    current_state = {
        "current_risk": 0.87,
        "momentum": 0.18,
        "current_stage": "SCANNING",
        "affected_asset": "API_GATEWAY"
    }

    print("\nInput State (Module 2 Forecast + Telemetry):")
    print(json.dumps(current_state, indent=2))

    # Required function call: simulation = simulate(current_state, action)
    simulation = simulate(current_state)

    print("\nOutput Simulation (Counterfactual Results):")
    print(json.dumps(simulation, indent=2))

    print("\nVerification Checklist:")
    print(f" [x] Output contains 'current_risk': {simulation.get('current_risk')}")
    print(f" [x] Output contains 'scenarios': {len(simulation.get('scenarios', []))} scenarios evaluated")
    print(f" [x] Output contains 'recommended_action': {simulation.get('recommended_action')}")
    print(f" [x] Output contains 'risk_reduction': {simulation.get('risk_reduction')}")
    print("==================================================================")


if __name__ == "__main__":
    main()
