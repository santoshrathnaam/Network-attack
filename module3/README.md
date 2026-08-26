# Module 3: Future Risk Engine + Counterfactual Simulator + Defensive Action Optimizer

An ultra-fast, explainable, and deterministic predictive simulation engine for cybersecurity defense. Module 3 ingests real-time threat telemetry and kill-chain forecasts from **Module 2**, evaluates branching counterfactual scenarios across time horizons ($+2\text{m}, +5\text{m}, +10\text{m}$), identifies optimal defensive mitigations, and delivers an explainable recommendation payload directly to **Module 4 (Dashboard)**.

---

## 1. Core Capabilities

1. **Baseline Escalation Modeling (What happens if we do nothing?)**:
   Simulates natural threat progression, attack momentum escalation, and kill-chain advancement under inaction (`NO_ACTION`).
2. **Counterfactual Scenario Simulation (What happens if we take an action?)**:
   Branches independent futures for candidate defensive interventions (`BLOCK_SOURCES`, `ISOLATE_ASSET`, `RATE_LIMIT`, etc.) across fixed time horizons ($+2\text{m}, +5\text{m}, +10\text{m}$).
3. **Defensive Action Optimization (Which action reduces risk the most?)**:
   Computes risk reduction deltas $\Delta \text{Risk} = \text{Risk}_{\text{NO\_ACTION}} - \text{Risk}_{\text{ACTION}}$, ranks actions by mitigation efficacy, and selects the optimal defense.
4. **Explainability & Confidence Scoring**:
   Calculates an explainable confidence score ($0.0 \le \text{confidence} \le 1.0$) and generates dynamic, quantified justification bullets derived strictly from simulation outcomes.

---

## 2. End-to-End Pipeline

```
MODULE 2 (Current threat state + forecast)
   │
   ▼
┌─────────────────────────────────────────┐
│                MODULE 3                 │
│  1. Validate Input (Pydantic / Aliases) │
│  2. Create Normalized Network State     │
│  3. Generate Possible Actions           │
│  4. Simulate Future for Each Action     │
│  5. Calculate Future Risk Trajectories  │
│  6. Compare Scenarios                   │
│  7. Rank Defensive Actions              │
│  8. Calculate Confidence Score          │
│  9. Generate Dynamic Explanation        │
│ 10. Generate Final Recommendation       │
└────────────────────┬────────────────────┘
                     │
                     ▼
            MODULE 4 (Dashboard)
```

---

## 3. Mathematical Transition Model

At any prediction horizon $t \in \{2, 5, 10\}$ minutes:

$$\text{future\_risk}(t, a) = \text{clamp}\Big(\text{current\_risk} + \text{attack\_progression}(t) + \text{momentum\_effect}(t) - \text{defensive\_effect}(t, a), 0.0, 1.0\Big)$$

Where:
- $\text{attack\_progression}(t) = (\text{growth\_rate} \times t) + (\text{stage\_factor} \times \text{stage\_weight} \times \sqrt{t})$
- $\text{momentum\_effect}(t) = \text{momentum} \times \text{momentum\_factor} \times t$
- $\text{defensive\_effect}(t, a) = \text{base\_effect}(a) + (\text{rate\_per\_min}(a) \times t) \times \text{suitability\_modifier}$

---

## 4. Input & Output Contracts

### 4.1 Input from Module 2 (`POST /simulate`)
```json
{
  "threat_score": 0.87,
  "threat_momentum": 0.18,
  "attack_probability": 0.87,
  "attack_type": "DDoS",
  "current_stage": "SCANNING",
  "affected_asset": "API_GATEWAY"
}
```

### 4.2 Output to Module 4 (Dashboard)
```json
{
  "current_state": {
    "threat_score": 0.87,
    "attack_probability": 0.87,
    "current_stage": "SCANNING",
    "affected_asset": "API_GATEWAY"
  },
  "scenarios": [
    {
      "action": "NO_ACTION",
      "risk": { "2m": 0.91, "5m": 0.98, "10m": 1.00 }
    },
    {
      "action": "BLOCK_SOURCES",
      "risk": { "2m": 0.63, "5m": 0.46, "10m": 0.19 }
    },
    {
      "action": "ISOLATE_ASSET",
      "risk": { "2m": 0.49, "5m": 0.30, "10m": 0.00 }
    }
  ],
  "recommendation": {
    "action": "ISOLATE_ASSET",
    "confidence": 0.93
  },
  "explanation": [
    "Current threat level is critical (87%)",
    "Threat momentum is increasing (+0.18)",
    "Asset isolation produces the lowest projected future risk"
  ]
}
```

---

## 5. File Structure

```
module3/
├── __init__.py          # Package initialization & public exports
├── config.yaml          # Externalized simulation parameters & coefficients
├── schemas.py           # Inbound/Outbound Pydantic contracts
├── state.py             # Internal ThreatState & AttackStage data structures
├── action_model.py      # DefensiveAction catalog & extensible registry
├── scenarios.py         # Counterfactual branching trees across horizons
├── simulator.py         # Core deterministic risk progression engine
├── ranking.py           # Risk reduction ranker & action optimizer
├── confidence.py        # Explainable confidence scorer
├── explainability.py    # Dynamic, simulation-derived justification engine
├── api.py               # FastAPI REST service & exception handlers
├── demo.py              # Interactive terminal demonstration runner
└── tests/
    ├── __init__.py
    ├── test_simulator.py # Unit tests for simulation math & monotonicity
    ├── test_ranking.py   # Unit tests for ranking, deltas & confidence
    └── test_api.py       # Integration tests for API endpoints & error handling
```

---

## 6. How to Run

### Run Interactive Live Demo:
```powershell
python -m module3.demo
```

### Start the REST API Service:
```powershell
uvicorn module3.api:app --host 0.0.0.0 --port 8000 --reload
```
Interactive Swagger documentation available at: `http://localhost:8000/docs`

### Run Test Suite:
```powershell
python -m pytest module3/tests -v
```

---

## 7. Extensibility

To add a new defensive action (e.g. `RATE_LIMIT`), enable it in `config.yaml`:
```yaml
action_effects:
  RATE_LIMIT:
    base_effect: 0.08
    rate_per_min: 0.045
    description: "Apply strict API and network rate limiting on inbound traffic"
    enabled: true
```
The simulator and ranker automatically incorporate enabled actions into the counterfactual tree without modifying Python logic.
