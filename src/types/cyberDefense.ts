/**
 * Shared Data Contract for SIH26153 — AI based Network Attack Forecasting from Network Traffic Data
 * Module 4: Predictive Cyber Defense SOC Interface
 */

export type NetworkStatus = 'SAFE' | 'WATCH' | 'ELEVATED' | 'CRITICAL';

export type TrajectoryStage = 'NORMAL' | 'ANOMALY' | 'SCANNING' | 'ATTACK_IMMINENT' | 'DDoS' | string;

export type InterventionAction = 'NO_ACTION' | 'BLOCK_SOURCES' | 'ISOLATE_SERVER' | string;

export interface ThreatSummary {
  /** Threat score normalized from 0.0 to 1.0 (e.g. 0.87 = 87%) */
  score: number;
  /** Threat momentum rate of change per minute (e.g. +0.18 = +18/min) */
  momentum: number;
  /** Estimated time to critical escalation in minutes (e.g. 4 = 4 min) */
  time_to_escalation: number;
}

export interface ForecastData {
  [attackType: string]: number;
}

export interface TrajectoryData {
  current_stage: TrajectoryStage;
  next_stage: TrajectoryStage;
  stages: TrajectoryStage[];
  stage_progress?: number; // 0.0 to 1.0 within current stage
}

export interface EvidenceItem {
  name: string;
  change: number; // e.g. 0.68 = +68%
  baseline_value?: string;
  current_value?: string;
  unit?: string;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface SimulationData {
  no_action: number;
  block_sources: number;
  isolate_server: number;
  recommended_action: InterventionAction;
  risk_reduction: number;
}

export interface TrafficDataPoint {
  timestamp: string; // HH:MM:SS or ISO string
  time_offset: number; // in seconds relative to baseline or current
  traffic_volume: number; // Mbps or packets/sec
  baseline: number;
  anomaly_threshold: number;
  projected_escalation?: number;
  is_future?: boolean;
  status: NetworkStatus;
}

/** One raw telemetry channel measured against its learned baseline. */
export interface ChannelReading {
  key: 'syn' | 'traffic' | 'source' | 'connection';
  label: string;
  unit: string;
  current: number;        // raw observed value this window
  baselineMean: number;   // learned normal
  baselineStd: number;    // learned jitter (1σ)
  z: number;              // standard deviations from baseline
  anomaly: number;        // 0..1, clamp(z / 6)
  series: number[];       // recent raw values, oldest → newest
}

/** One weighted term in the threat-score sum. */
export interface ScoreTerm {
  key: string;
  label: string;
  weight: number;
  anomaly: number;
  contribution: number;   // weight × anomaly
}

/** One time window: the raw measurements and the score they produce. */
export interface DerivationPoint {
  index: number;
  raw: { synRatio: number; pps: number; uniqueSources: number; failedConns: number };
  anomalies: { syn: number; traffic: number; source: number; connection: number };
  contributions: { syn: number; traffic: number; source: number; conn: number; accel: number };
  score: number;
}

/** The full audit trail behind a state — how every headline number was computed. */
export interface DerivationData {
  channels: ChannelReading[];
  terms: ScoreTerm[];
  acceleration: number;
  score: number;
  windowSeconds: number;
  /** Per-window history, oldest → newest: the score as a measured trajectory. */
  trace: DerivationPoint[];
  /** Counterfactual outcome at the horizon the recommendation is decided on. */
  decision: {
    horizon: string;
    noActionRisk: number;
    bestAction: string;
    bestRisk: number;
    reductionPct: number;
    confidence: number;
    /** Every option at the decision horizon, with the arithmetic behind it. */
    options: { action: string; risk: number; start: number; growth: number; defense: number }[];
  };
  /** Attack family the classifier leads with, and its probability. */
  predicted: { key: string; p: number };
  /** Minutes until the escalation threshold, or 0 when not projected. */
  timeToEscalation: number;
  stage: string;
}

/** Master schema matching Modules 1-3 contract */
export interface CyberDefenseState {
  timestamp: string;
  network_status: NetworkStatus;
  threat: ThreatSummary;
  forecast: ForecastData;
  trajectory: TrajectoryData;
  evidence: EvidenceItem[];
  simulation: SimulationData;
  traffic_history?: TrafficDataPoint[];
  /** Present when the state was derived by the local engine (not a raw API payload). */
  derivation?: DerivationData;
}

/** Replay & Demo Stage Metadata */
export interface DemoStage {
  id: number;
  key: string;
  name: string;
  description: string;
  state: CyberDefenseState;
}

/** Configuration for Data Source mode */
export type DataSourceMode = 'mock' | 'api';
