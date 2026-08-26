# Module 3 — Counterfactual Future Simulator

**Owner**: Member 3 — Simulation/Decision Intelligence Engineer  
**Scope**: Prototype Counterfactual State-Transition Risk Simulator

> [!IMPORTANT]
> **Prototype Counterfactual Model**: This implementation is explicitly labeled as a **prototype counterfactual model**, not a production-grade causal network simulator. It uses a transparent state-transition model to simulate future threat risk under candidate defensive actions.

---

## 🎯 Responsibility

Simulates future threat states under candidate defensive actions using current network telemetry and Module 2 threat forecasts. It projects future risk trajectories, quantifies potential risk reduction, and recommends the optimal defensive intervention.

---

## 📥 Input Contract

Accepts a dictionary containing current network telemetry and Module 2 forecast data:

```python
current_state = {
    "current_risk": 0.87,      # Current threat score [0.0 - 1.0]
    "momentum": 0.18,          # Threat escalation velocity [-1.0 - 1.0]
    "current_stage": "SCANNING",# Kill-chain stage
    "affected_asset": "API_GATEWAY"
}
```

---

## 📤 Output Contract

Returns a structured dictionary representing counterfactual scenarios and recommendations:

```json
{
  "current_risk": 0.87,
  "scenarios": [
    {
      "action": "NO_ACTION",
      "risk_5min": 0.93
    },
    {
      "action": "BLOCK_SOURCES",
      "risk_5min": 0.39
    },
    {
      "action": "ISOLATE_SERVER",
      "risk_5min": 0.24
    }
  ],
  "recommended_action": "ISOLATE_SERVER",
  "risk_reduction": 0.69
}
```

---

## 🧮 Mathematical Model

The simulator executes a forward state-transition equation:

```text
Current risk
    +
Threat momentum
    +
Attack stage progression
    +
Mitigation effectiveness
    ↓
Future risk
```

$$\text{unmitigated\_growth} = (\text{momentum} \times \frac{\Delta t}{5.0}) + \text{stage\_factor}$$

$$\text{raw\_future\_risk} = \text{current\_risk} + \text{unmitigated\_growth}$$

$$\text{future\_risk} = \text{clamp}(\text{raw\_future\_risk} \times \text{mitigation\_factor}, 0.0, 1.0)$$

### Defensive Mitigation Catalog
- `NO_ACTION`: $1.00$ (0% risk reduction)
- `RATE_LIMIT`: $0.70$ (30% risk reduction)
- `APPLY_WAF_RULES`: $0.55$ (45% risk reduction)
- `BLOCK_SOURCES`: $0.42$ (58% risk reduction)
- `ISOLATE_SERVER` / `ISOLATE_ASSET`: $0.26$ (74% risk reduction)

---

## 🚀 Quickstart Example

```python
from counterfactual import simulate

current_state = {
    "current_risk": 0.87,
    "momentum": 0.18,
    "current_stage": "SCANNING"
}

# Run counterfactual simulation
simulation = simulate(current_state)

print(simulation)
```

---

## 📂 Deliverables

```text
module3-simulator/
├── simulator.py        # Core state-transition simulation engine
├── counterfactual.py   # High-level simulate(current_state, action) entrypoint
├── demo.py             # Executable demo script
└── README.md           # Documentation & specification
```
