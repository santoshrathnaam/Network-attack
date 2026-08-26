# SIH26153 - Predictive Cyber Defense & Network Intelligence System

AI-based predictive network attack forecasting system for proactive threat mitigation.

## System Architecture

The pipeline consists of 4 integrated modules:
- **Module 1 (Traffic Analysis & Feature Extraction)**: Ingests raw network traffic, generates baseline features, and detects anomalous traffic spikes.
- **Module 2 (Attack Trajectory & Sequence Prediction)**: Forecasts attack progression vectors and time-to-kill metrics.
- **Module 3 (Future Risk & Counterfactual Engine)**: Simulates counterfactual response options and provides defensive action optimization.
- **Module 4 (SOC Frontend Dashboard)**: High-performance React + TypeScript + Vite SOC command dashboard with real-time telemetry, trajectory pipelines, SHAP explainability, and counterfactual response simulation.

## Quick Start (Module 4 Dashboard)

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

