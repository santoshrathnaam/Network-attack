# Module 2 --- Threat Forecasting & Attack Trajectory Engine

**Owner**: Member 2 --- ML/Forecasting Engineer  
**Deliverable**: SIH26153 Predictive Cyber Defense Prototype Design Document §6

---

## 1. Overview

Module 2 converts time-series feature windows and anomaly indicators produced by Module 1 into **actionable threat forecasts**, **trajectory state predictions**, **estimated time-to-escalation**, and **explainability evidence**.

Unlike traditional static IDSs that simply trigger a binary alarm when an attack occurs, Module 2 models the **momentum** and **direction** of network changes before the attack reaches critical threshold.

---

## 2. Core Mathematical Formulations

### 2.1 Composite Threat Score

Calculated as a weighted sum of four baseline anomaly dimensions plus temporal acceleration (§2.3):

$$\text{ThreatScore} = w_{\text{syn}} \cdot A_{\text{syn}} + w_{\text{traffic}} \cdot A_{\text{traffic}} + w_{\text{source}} \cdot A_{\text{source}} + w_{\text{connection}} \cdot A_{\text{connection}} + w_{\text{accel}} \cdot \text{Accel}$$

Where weights (configured in `shared/config.py`):
- $w_{\text{syn}} = 0.30$ (SYN Rate Anomaly)
- $w_{\text{traffic}} = 0.20$ (Traffic Volume / BPS Anomaly)
- $w_{\text{source}} = 0.20$ (Source IP Diversity Anomaly)
- $w_{\text{connection}} = 0.20$ (Connection Failure Anomaly)
- $w_{\text{accel}} = 0.10$ (Temporal Acceleration)

$$\sum w_i = 1.00$$

### 2.2 Temporal Acceleration ($\text{Accel}$)

Measures the rate of increase of total anomaly intensity across consecutive time windows (second derivative):

$$\Delta A = A_{t} - A_{t-1}$$
$$\text{Accel} = \max(0.0, \min(1.0, 2.0 \cdot \Delta A))$$

### 2.3 Threat Momentum

Represents the rate of change / velocity of threat score escalation:

$$\text{Momentum} = \text{ThreatScore}_{t} - \text{ThreatScore}_{t-1} \quad \in [-1.0, 1.0]$$

### 2.4 Estimated Time-to-Escalation ($T_{\text{esc}}$)

Calculates the estimated time (in minutes) until threat score crosses the critical threshold ($T_{\text{threshold}} = 0.95$):

$$T_{\text{esc}} = \begin{cases}
0 & \text{if } \text{ThreatScore} \ge 0.95 \\
\left\lceil \frac{0.95 - \text{ThreatScore}}{\text{Momentum}_{\text{per\_min}}} \right\rceil & \text{if } \text{Momentum}_{\text{per\_min}} > 0 \\
\infty & \text{if } \text{Momentum}_{\text{per\_min}} \le 0
\end{cases}$$

---

## 3. Attack Trajectory State Machine

Module 2 tracks network progression across 5 canonical kill-chain stages (`shared/config.py`):

```text
  ┌──────────┐     ┌───────────┐     ┌──────────┐     ┌─────────────────┐     ┌──────┐
  │  NORMAL  │ ──> │  ANOMALY  │ ──> │ SCANNING │ ──> │ ATTACK IMMINENT │ ──> │ DDoS │
  └──────────┘     └───────────┘     └──────────┘     └─────────────────┘     └──────┘
  Score < 0.25      0.25 - 0.45       0.45 - 0.70         0.70 - 0.85        Score >= 0.85
```

- **Current Stage**: Derived from current threat score bounds.
- **Next Stage**: Predicted next state based on current stage and positive/negative momentum.

---

## 4. Deliverable Structure

```text
module2_forecast/
├── __init__.py         # Package entry point
├── model.py            # Composite threat scoring & attack classification
├── trajectory.py       # Trajectory state machine & explainability generator
├── predictor.py        # Top-level ThreatPredictor & predict(features) function
├── demo.py             # Live interactive demo runner
├── README.md           # Documentation (this file)
└── tests/
    └── test_forecast.py # Smoke & integration unit tests
```

---

## 5. Input / Output Contracts

### 5.1 Input (from Module 1)

```json
{
  "timestamp": "2026-08-26T19:05:00",
  "baseline_ready": true,
  "features": {
    "packets_per_second": 1840.0,
    "bytes_per_second": 284000.0,
    "unique_source_ips": 73,
    "syn_rate": 0.82,
    "failed_connections": 143,
    "port_entropy": 4.72
  },
  "anomalies": {
    "traffic": 0.72,
    "syn": 0.81,
    "source": 0.64,
    "connection": 0.77
  }
}
```

### 5.2 Output (Hand-off to Module 3 & Module 4)

```json
{
  "timestamp": "2026-08-26T19:05:00",
  "threat_score": 0.87,
  "threat_momentum": 0.18,
  "attack_probability": 0.87,
  "predicted_attack": "DDoS",
  "current_stage": "SCANNING",
  "next_stage": "ATTACK IMMINENT",
  "time_to_escalation_minutes": 4,
  "affected_asset": "API_GATEWAY",
  "evidence": [
    { "name": "SYN traffic", "change": 0.68, "severity": "HIGH", "unit": "%" },
    { "name": "Unique sources", "change": 0.54, "severity": "HIGH", "unit": "%" },
    { "name": "Failed connections", "change": 0.72, "severity": "HIGH", "unit": "%" },
    { "name": "Traffic acceleration", "change": 0.61, "severity": "HIGH", "unit": "%" }
  ],
  "forecast_probabilities": {
    "DDoS": 0.87,
    "Credential Attack": 0.42,
    "Port Scan": 0.23,
    "Exfiltration": 0.12
  }
}
```

---

## 6. Running Tests & Demo

### 6.1 Run Unit Tests

```bash
python -m unittest module2_forecast.tests.test_forecast -v
```

### 6.2 Run Interactive Demo

```bash
python -m module2_forecast.demo
```
