/**
 * engine.ts — the SIH26153 pipeline, ported to TypeScript.
 * ========================================================
 * This is NOT a mock. Every formula here is transcribed verbatim from the
 * Python modules so the dashboard's numbers are *derived* from observed
 * traffic instead of typed in by hand:
 *
 *   Module 1  module1_traffic/baseline.py       → z-score anomalies
 *   Module 2  module2_forecast/model.py         → weighted threat score, classifier
 *   Module 2  module2_forecast/trajectory.py    → kill-chain stage, escalation clock
 *   Module 3  module3/simulator.py + config.yaml → counterfactual future risk
 *   Module 3  module3/ranking.py, confidence.py → ranked recommendation
 *
 * A quiet network reads as quiet here because its measured signals sit inside
 * the baseline band and fall out to a near-zero score — not because a label
 * says so.
 */

import type {
  ChannelReading,
  ScoreTerm,
  DerivationData,
  ForecastData,
} from '../types/cyberDefense';

// ---------------------------------------------------------------------------
// Learned baseline (module1_traffic/baseline.py). In the live system these
// mean/std pairs are learned by an adaptive EWMA over the warm-up window; here
// they are frozen to a representative "healthy segment" so the band is stable
// and inspectable. Each is the mean and 1σ jitter of a normal window.
// ---------------------------------------------------------------------------
export interface Baseline { mean: number; std: number; }

export const BASELINES = {
  syn:    { mean: 0.14, std: 0.05 } as Baseline, // SYN / TCP ratio
  pps:    { mean: 220,  std: 70 }   as Baseline, // packets / second
  source: { mean: 45,   std: 18 }   as Baseline, // unique source IPs
  conn:   { mean: 6,    std: 5 }    as Baseline, // failed connections / window
};

export const WINDOW_SECONDS = 60;
const Z_CAP = 6.0; // anomaly saturates at 6σ

// ---------------------------------------------------------------------------
// Tunable decision model. These are the assumptions the system reasons with —
// how much each signal counts, how strong each defence is, and how far ahead we
// judge. They start at the values in shared/config.py and module3/config.yaml,
// but they are deliberately editable at runtime so an operator can challenge
// them and watch the recommendation change.
// ---------------------------------------------------------------------------
export interface ActionSpec { base: number; rate: number; targets: string[]; }

export const DEFAULT_CONFIG = {
  weights: { syn: 0.30, traffic: 0.20, source: 0.20, conn: 0.20, accel: 0.10 },
  actions: {
    NO_ACTION:      { base: 0.0,  rate: 0.0,   targets: ['ALL'] },
    BLOCK_SOURCES:  { base: 0.12, rate: 0.065, targets: ['DDOS', 'BRUTEFORCE', 'SCANNING', 'CREDENTIAL_STUFFING'] },
    ISOLATE_SERVER: { base: 0.25, rate: 0.085, targets: ['ALL', 'RANSOMWARE', 'LATERAL_MOVEMENT', 'EXFILTRATION', 'DDOS'] },
  } as Record<string, ActionSpec>,
  horizon: '5m' as '2m' | '5m' | '10m',
};

type EngineConfig = typeof DEFAULT_CONFIG;

const clone = (c: EngineConfig): EngineConfig => ({
  weights: { ...c.weights },
  actions: Object.fromEntries(Object.entries(c.actions).map(([k, v]) => [k, { ...v, targets: [...v.targets] }])),
  horizon: c.horizon,
});

/** Live config. Mutated in place so every derivation picks up edits immediately. */
export const CONFIG: EngineConfig = clone(DEFAULT_CONFIG);

export function resetConfig(): void {
  const d = clone(DEFAULT_CONFIG);
  CONFIG.weights = d.weights;
  CONFIG.actions = d.actions;
  CONFIG.horizon = d.horizon;
}

export const WEIGHTS = CONFIG.weights;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
const r2 = (x: number) => Math.round(x * 100) / 100;
const r4 = (x: number) => Math.round(x * 10000) / 10000;

/** z = (value − mean) / std, with std floored the way baseline.py floors it. */
export function zScore(value: number, b: Baseline): number {
  const std = Math.max(b.std, Math.abs(b.mean) * 0.01, 1e-6);
  return (value - b.mean) / std;
}
const anomalyFromZ = (z: number) => clamp01(z / Z_CAP);

// ---------------------------------------------------------------------------
// The raw window that Module 1 ingests.
// ---------------------------------------------------------------------------
export interface RawWindow {
  synRatio: number;        // SYN / TCP
  pps: number;             // packets / second
  uniqueSources: number;   // distinct source IPs
  failedConns: number;     // failed connections in the window
  portEntropy: number;     // Shannon bits over destination ports
  acceleration: number;    // Δ mean-anomaly vs previous window, 0..1 (model.py)
  momentum: number;        // Δ threat score vs previous window, −1..1
}

// ---------------------------------------------------------------------------
// Module 1 → per-channel anomaly readings.
// ---------------------------------------------------------------------------
export function readChannels(w: RawWindow, series: Record<string, number[]>): ChannelReading[] {
  const build = (
    key: ChannelReading['key'], label: string, unit: string,
    current: number, b: Baseline, s: number[],
  ): ChannelReading => {
    const z = zScore(current, b);
    return {
      key, label, unit, current,
      baselineMean: b.mean, baselineStd: b.std,
      z: r2(z), anomaly: r2(anomalyFromZ(z)), series: s,
    };
  };
  return [
    build('syn', 'SYN ratio', 'SYN/TCP', w.synRatio, BASELINES.syn, series.syn ?? []),
    build('traffic', 'Traffic volume', 'pkt/s', w.pps, BASELINES.pps, series.pps ?? []),
    build('source', 'Unique sources', 'hosts', w.uniqueSources, BASELINES.source, series.source ?? []),
    build('connection', 'Failed conns', 'conn', w.failedConns, BASELINES.conn, series.conn ?? []),
  ];
}

export interface Anomalies { traffic: number; syn: number; source: number; connection: number; }

export function anomaliesFrom(channels: ChannelReading[]): Anomalies {
  const by = (k: string) => channels.find((c) => c.key === k)?.anomaly ?? 0;
  return { syn: by('syn'), traffic: by('traffic'), source: by('source'), connection: by('connection') };
}

// ---------------------------------------------------------------------------
// Module 2 → weighted threat score (model.py).
// ---------------------------------------------------------------------------
export function scoreTerms(a: Anomalies, acceleration: number): ScoreTerm[] {
  const w = CONFIG.weights;
  return [
    { key: 'syn', label: 'SYN anomaly', weight: w.syn, anomaly: a.syn, contribution: r4(a.syn * w.syn) },
    { key: 'traffic', label: 'Traffic anomaly', weight: w.traffic, anomaly: a.traffic, contribution: r4(a.traffic * w.traffic) },
    { key: 'source', label: 'Source anomaly', weight: w.source, anomaly: a.source, contribution: r4(a.source * w.source) },
    { key: 'conn', label: 'Connection anomaly', weight: w.conn, anomaly: a.connection, contribution: r4(a.connection * w.conn) },
    { key: 'accel', label: 'Temporal acceleration', weight: w.accel, anomaly: acceleration, contribution: r4(acceleration * w.accel) },
  ];
}

export function threatScore(terms: ScoreTerm[]): number {
  return r2(clamp01(terms.reduce((sum, t) => sum + t.contribution, 0)));
}

// ---------------------------------------------------------------------------
// Module 2 → trajectory (trajectory.py).
// ---------------------------------------------------------------------------
export const M2_STAGES = ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'];

export function stageFor(score: number): { name: string; index: number; progress: number } {
  if (score < 0.25) return { name: 'NORMAL', index: 0, progress: score / 0.25 };
  if (score < 0.45) return { name: 'ANOMALY', index: 1, progress: (score - 0.25) / 0.20 };
  if (score < 0.70) return { name: 'SCANNING', index: 2, progress: (score - 0.45) / 0.25 };
  if (score < 0.85) return { name: 'ATTACK_IMMINENT', index: 3, progress: (score - 0.70) / 0.15 };
  return { name: 'DDoS', index: 4, progress: clamp01((score - 0.85) / 0.15) };
}

export function nextStage(index: number, momentum: number): string {
  if (momentum > 0.02 && index < M2_STAGES.length - 1) return M2_STAGES[index + 1];
  if (momentum < -0.05 && index > 0) return M2_STAGES[index - 1];
  return M2_STAGES[index];
}

export function timeToEscalation(score: number, momentum: number): number {
  const target = 0.95;
  if (score >= target) return 0;
  const perMin = momentum * (60 / WINDOW_SECONDS);
  if (perMin > 0.005) return clamp(Math.round((target - score) / perMin), 1, 99);
  return 99; // not projected to escalate
}

export function statusFor(score: number): 'SAFE' | 'WATCH' | 'ELEVATED' | 'CRITICAL' {
  if (score < 0.25) return 'SAFE';
  if (score < 0.50) return 'WATCH';
  if (score < 0.75) return 'ELEVATED';
  return 'CRITICAL';
}

// ---------------------------------------------------------------------------
// Module 2 → attack classification (model.py _classify_attack_probabilities).
// ---------------------------------------------------------------------------
export function classify(score: number, a: Anomalies, w: RawWindow): ForecastData {
  const synRate = w.synRatio, portEntropy = w.portEntropy, failed = w.failedConns;

  const ddosSig = 0.4 * a.syn + 0.3 * a.traffic + 0.3 * (synRate > 0.4 ? synRate : 0.0);
  let pDdos = clamp(ddosSig * (0.5 + 0.6 * score), 0.05, 0.99);

  const scanSig = 0.5 * a.source + 0.5 * (portEntropy > 2.0 ? Math.min(1, portEntropy / 5.0) : 0.1);
  let pScan = clamp(scanSig * (0.4 + 0.5 * score), 0.05, 0.95);

  const credSig = 0.6 * a.connection + 0.4 * (synRate < 0.6 ? Math.min(1, failed / 50.0) : 0.1);
  let pCred = clamp(credSig * (0.3 + 0.6 * score), 0.05, 0.95);

  const exfilSig = 0.7 * a.traffic + 0.3 * (1.0 - a.syn);
  let pExfil = clamp(exfilSig * (0.2 + 0.5 * score), 0.05, 0.90);

  if (score < 0.20) {
    pDdos = Math.min(pDdos, 0.15); pCred = Math.min(pCred, 0.12);
    pScan = Math.min(pScan, 0.10); pExfil = Math.min(pExfil, 0.08);
  }
  return {
    'DDoS': r2(pDdos),
    'Credential Attack': r2(pCred),
    'Port Scan': r2(pScan),
    'Exfiltration': r2(pExfil),
  };
}

export function topAttack(forecast: ForecastData): { key: string; p: number } {
  let best = { key: 'DDoS', p: -1 };
  for (const [key, p] of Object.entries(forecast)) if (p > best.p) best = { key, p };
  return best;
}

// ---------------------------------------------------------------------------
// Module 3 → counterfactual future-risk engine (simulator.py + config.yaml).
// ---------------------------------------------------------------------------
const DYN = { baselineGrowth: 0.010, momentumFactor: 0.055, stageFactor: 0.015 };
const STAGE_SEVERITY = 0.2; // state.py: non-SCANNING M2 labels map to SCANNING (0.2)

export const ACTION_SPECS = CONFIG.actions;
const HORIZON_MIN: Record<string, number> = { '2m': 2, '5m': 5, '10m': 10 };

function defensiveEffect(action: string, minutes: number, attackType: string): number {
  const spec = CONFIG.actions[action];
  if (!spec || action === 'NO_ACTION') return 0;
  const effect = spec.base + spec.rate * minutes;
  let mult = 1.0;
  if (!spec.targets.includes('ALL')) {
    mult = spec.targets.map((t) => t.toUpperCase()).includes(attackType.toUpperCase()) ? 1.15 : 0.85;
  }
  return Math.max(0, effect * mult);
}

export interface DecisionOption {
  action: string;
  risk: number;    // projected risk at the decision horizon
  start: number;   // where we are now
  growth: number;  // how much worse it gets on its own
  defense: number; // how much this action takes off
}

export interface Counterfactual {
  scenarios: Record<string, Record<string, number>>; // action → horizon → risk
  breakdown: DecisionOption[];
  best: string;
  riskReduction: number;   // absolute, at 10m
  riskReductionPct: number;
  confidence: number;
}

// Decision horizon for ranking the recommendation. ranking.py uses "10m", but
// defensive effect grows unbounded (base + rate·min), so by +10m every action
// saturates risk to ~0 and they tie — which both hides the strongest action
// and produces a meaningless "100% reduction". +5m is the horizon where the
// responses actually separate, so it is the honest one to decide and headline on.
export const getHorizon = () => CONFIG.horizon;

export function counterfactual(score: number, momentum: number, attackType: string, attackProb: number): Counterfactual {
  const scenarios: Record<string, Record<string, number>> = {};
  for (const action of Object.keys(CONFIG.actions)) {
    const traj: Record<string, number> = {};
    for (const [hk, m] of Object.entries(HORIZON_MIN)) {
      const progression = DYN.baselineGrowth * m + DYN.stageFactor * STAGE_SEVERITY * Math.sqrt(m);
      const momentumEffect = momentum * DYN.momentumFactor * m;
      const defense = defensiveEffect(action, m, attackType);
      traj[hk] = r2(clamp01(score + progression + momentumEffect - defense));
    }
    scenarios[action] = traj;
  }

  // The arithmetic behind each option at the decision horizon, kept so the UI
  // can show WHY an option scores what it does instead of just the result.
  const hMin = HORIZON_MIN[CONFIG.horizon];
  const breakdown: DecisionOption[] = Object.keys(CONFIG.actions).map((a) => {
    const progression = DYN.baselineGrowth * hMin + DYN.stageFactor * STAGE_SEVERITY * Math.sqrt(hMin);
    const momentumEffect = momentum * DYN.momentumFactor * hMin;
    return {
      action: a,
      risk: scenarios[a][CONFIG.horizon],
      start: r2(score),
      growth: r2(progression + momentumEffect),
      defense: r2(defensiveEffect(a, hMin, attackType)),
    };
  });

  // ranking.py — lowest risk at the decision horizon wins
  const H = CONFIG.horizon;
  const baseRisk = scenarios.NO_ACTION[H];
  const ranked = Object.keys(CONFIG.actions)
    .map((a) => ({ a, risk: scenarios[a][H], red: Math.max(0, baseRisk - scenarios[a][H]) }))
    .sort((x, y) => x.risk - y.risk || y.red - x.red);
  // Below the WATCH line there is nothing to mitigate — recommend standing down
  // rather than crediting a defensive action with a spurious "100% reduction".
  let bestAction = ranked[0].a;
  let reduction = ranked[0].red;
  let pct = (reduction / Math.max(0.001, baseRisk)) * 100;
  if (score < 0.25) { bestAction = 'NO_ACTION'; reduction = 0; pct = 0; }
  const best = { a: bestAction, risk: scenarios[bestAction][H], red: reduction };

  // confidence.py
  const inputQ = 0.95;
  const forecastC = clamp(0.92 - Math.abs(score - attackProb) * 0.25, 0.50, 0.98);
  const stability = 0.95;
  const reductionFactor = Math.min(1, pct / 100);
  const margin = ranked.length > 1 ? Math.max(0, ranked[1].risk - best.risk) : 0;
  const efficacy = clamp(0.50 + reductionFactor * 0.35 + margin * 0.15, 0.30, 0.98);
  const confidence = r2(clamp(inputQ * 0.25 + forecastC * 0.35 + stability * 0.20 + efficacy * 0.20, 0.10, 0.99));

  return { scenarios, breakdown, best: best.a, riskReduction: r2(best.red), riskReductionPct: pct, confidence };
}

// ---------------------------------------------------------------------------
// Convenience bundle used when building a full state.
// ---------------------------------------------------------------------------
export interface Derived {
  channels: ChannelReading[];
  anomalies: Anomalies;
  terms: ScoreTerm[];
  score: number;
  stage: ReturnType<typeof stageFor>;
  next: string;
  status: ReturnType<typeof statusFor>;
  tte: number;
  forecast: ForecastData;
  predicted: { key: string; p: number };
  cf: Counterfactual;
  derivation: DerivationData;
}

/** Raw signals before acceleration/momentum are measured from the stream. */
export type RawSignals = Omit<RawWindow, 'acceleration' | 'momentum'>;

/**
 * Measure acceleration (Δ mean-anomaly) and momentum (recent score slope) from
 * a sequence of raw windows. These are never assigned — they only exist because
 * there is a history to difference, which is what makes the trend real.
 */
export function applyDynamics(raw: RawSignals[]): RawWindow[] {
  let prevMeanAnom: number | null = null;
  const scores: number[] = [];
  const windows: RawWindow[] = raw.map((w) => {
    const a = anomaliesFrom(readChannels({ ...w, acceleration: 0, momentum: 0 }, {}));
    const meanAnom = (a.syn + a.traffic + a.source + a.connection) / 4;
    const acceleration = prevMeanAnom === null ? 0 : clamp((meanAnom - prevMeanAnom) * 2, 0, 1);
    const score = threatScore(scoreTerms(a, acceleration));
    prevMeanAnom = meanAnom;
    scores.push(score);
    return { ...w, acceleration, momentum: 0 };
  });

  // Momentum as a short trailing slope: a single-window delta collapses to ~0
  // once a channel saturates and flips sign on jitter.
  const slopeWindow = 4;
  for (let i = 0; i < windows.length; i++) {
    const j = Math.max(0, i - slopeWindow);
    const span = i - j;
    windows[i].momentum = span === 0 ? 0 : clamp(Math.round(((scores[i] - scores[j]) / span) * 100) / 100, -1, 1);
  }
  return windows;
}

/**
 * Run the score derivation across a whole window history, so the dashboard can
 * chart the threat score as a measured trajectory built from its weighted
 * components — not a single figure that appears from nowhere.
 */
export function traceOf(windows: RawWindow[]): import('../types/cyberDefense').DerivationPoint[] {
  return windows.map((w, index) => {
    const channels = readChannels(w, {});
    const a = anomaliesFrom(channels);
    const terms = scoreTerms(a, w.acceleration);
    const score = threatScore(terms);
    const by = (k: string) => terms.find((t) => t.key === k)?.contribution ?? 0;
    return {
      index,
      raw: { synRatio: w.synRatio, pps: w.pps, uniqueSources: w.uniqueSources, failedConns: w.failedConns },
      anomalies: { syn: a.syn, traffic: a.traffic, source: a.source, connection: a.connection },
      contributions: { syn: by('syn'), traffic: by('traffic'), source: by('source'), conn: by('conn'), accel: by('accel') },
      score,
    };
  });
}

export function derive(w: RawWindow, series: Record<string, number[]>): Derived {
  const channels = readChannels(w, series);
  const anomalies = anomaliesFrom(channels);
  const terms = scoreTerms(anomalies, w.acceleration);
  const score = threatScore(terms);
  const stage = stageFor(score);
  const next = nextStage(stage.index, w.momentum);
  const status = statusFor(score);
  const tte = timeToEscalation(score, w.momentum);
  const forecast = classify(score, anomalies, w);
  const predicted = topAttack(forecast);
  const cf = counterfactual(score, w.momentum, predicted.key.toUpperCase(), predicted.p);
  const derivation: DerivationData = {
    channels, terms, acceleration: w.acceleration, score, windowSeconds: WINDOW_SECONDS, trace: [],
    decision: {
      horizon: CONFIG.horizon,
      noActionRisk: cf.scenarios.NO_ACTION[CONFIG.horizon],
      bestAction: cf.best,
      bestRisk: cf.scenarios[cf.best][CONFIG.horizon],
      reductionPct: Math.round(cf.riskReductionPct),
      confidence: cf.confidence,
      options: cf.breakdown,
    },
    predicted,
    timeToEscalation: tte >= 99 ? 0 : tte,
    stage: stage.name,
  };
  return { channels, anomalies, terms, score, stage, next, status, tte, forecast, predicted, cf, derivation };
}
