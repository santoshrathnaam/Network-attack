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
