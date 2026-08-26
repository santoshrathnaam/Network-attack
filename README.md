# SIH26153 - Predictive Cyber Defense & Network Intelligence System

> **AI-Based Network Attack Forecasting & Proactive Threat Mitigation System**  
> *Developed for NTRO / SIH Problem Statement SIH26153*

---

## 🛡️ System Architecture Overview

The system operates across **4 integrated modules** designed to move from raw network telemetry to counterfactual simulation and SOC visualization:

1. **Module 1 (Traffic Intelligence & Feature Engineering)**
   - Ingests network packet flows (SYN ratio, traffic volume, connection rates, source diversity).
   - Computes z-score anomaly indicators against an adaptive baseline.

2. **Module 2 (Attack Trajectory & Threat Forecasting)**
   - Calculates rolling **Threat Score** (`[0.0, 1.0]`) and **Threat Momentum** (points/min acceleration).
   - Maps 5-stage attack trajectory stepper (`NORMAL` ➔ `ANOMALY` ➔ `SCANNING` ➔ `ATTACK IMMINENT` ➔ `DDoS`).
   - Estimates **Time-to-Escalation** (~5 min remaining) and provides **SHAP-style Telemetry Attribution**.

3. **Module 3 (Future Risk & Counterfactual Engine)**
   - Evaluates alternative 5-minute future outcomes under candidate defensive actions:
     - `NO_ACTION`
     - `BLOCK_SUSPICIOUS_SOURCES`
     - `ISOLATE_AFFECTED_SERVER`
   - Recommends the optimal intervention for maximum projected risk reduction (-73%).

4. **Module 4 (SOC Frontend Command Center)**
   - Modern React + TypeScript + Vite SOC command dashboard.
   - Interactive 6-stage demo playback timeline, live API / mock data toggle, and interactive counterfactual mitigation popups.

---

## 🚀 How to Run the Project

### Prerequisites
- **Node.js** (v18 or higher) & `npm`
- **Python** (v3.10 or higher) & `pip`

---

### Step 1: Install Dependencies

#### Frontend (Node.js)
```bash
npm install
```

#### Backend (Python)
Ensure FastAPI and required dependencies are installed:
```bash
pip install fastapi uvicorn pydantic pytest
```

---

### Step 2: Start the Backend Pipeline Server

Launch the unified 4-module API backend:
```bash
python pipeline.py
```
*The server starts on `http://localhost:8000`.*

---

### Step 3: Start the SOC Dashboard (Frontend)

In a separate terminal window, start the Vite development server:
```bash
npm run dev
```
*(Or on Windows PowerShell/CMD if script policy is restricted: `npx vite`)*

Open your browser and navigate to:
👉 **`http://localhost:5173`** (or the port displayed in terminal, e.g. `http://localhost:5176`)

---

### 🧪 Step 4: Running Verification Tests

Run the full end-to-end integration test suite (verifying M1 ➔ M2 ➔ M3 ➔ M4 contracts):
```bash
pytest test_pipeline.py
```

---

## 📡 Key API Endpoints (`http://localhost:8000`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Health check & storage status |
| `GET` | `/api/v1/state` | Returns live unified 4-module network state payload |
| `POST` | `/api/v1/pipeline/run` | Ingests telemetry & computes live forecast |
| `POST` | `/api/v1/simulate` | Simulates counterfactual response outcomes |

---

## 🏗️ Production Build

To bundle the SOC frontend for production deployment:
```bash
npm run build
```
Output files will be generated in `dist/`.


