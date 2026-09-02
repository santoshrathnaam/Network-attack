/**
 * trafficModel.ts — the observable source of truth.
 * ==================================================
 * Generates a deterministic stream of raw traffic windows for each scenario.
 * Nothing here decides the threat score; it only produces the *telemetry*.
 * engine.ts then derives every headline number from these windows, exactly the
 * way Module 1 → Module 2 would from real packet flows.
 *
 * Deterministic on purpose: a fixed seed per scenario means the same traffic
 * every render, so the numbers are reproducible and inspectable rather than
 * re-rolled from Math.random() on each mount.
 */

import type { TrafficDataPoint } from '../types/cyberDefense';
import {
  BASELINES, applyDynamics, traceOf, statusFor,
  type RawWindow,
} from '../services/engine';

// --- deterministic PRNG (mulberry32) ---------------------------------------
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Shape = 'flat' | 'ramp' | 'spike-recover';

interface ScenarioSpec {
  seed: number;
  shape: Shape;
  // final-window target for each raw channel
  synRatio: number; pps: number; uniqueSources: number; failedConns: number; portEntropy: number;
}

// Every value below is a *measurement target*, not a score. The stage each
// scenario lands in is whatever the engine derives from these signals.
export const SCENARIO_SPECS: Record<string, ScenarioSpec> = {
  NORMAL:          { seed: 101, shape: 'flat', synRatio: 0.13, pps: 232, uniqueSources: 44, failedConns: 5, portEntropy: 1.3 },
  ANOMALY:         { seed: 202, shape: 'ramp', synRatio: 0.30, pps: 330, uniqueSources: 70, failedConns: 18, portEntropy: 2.0 },
  SCANNING:        { seed: 303, shape: 'ramp', synRatio: 0.30, pps: 420, uniqueSources: 150, failedConns: 22, portEntropy: 4.6 },
  ATTACK_IMMINENT: { seed: 404, shape: 'ramp', synRatio: 0.70, pps: 900, uniqueSources: 82, failedConns: 45, portEntropy: 1.6 },
  SIMULATION:      { seed: 505, shape: 'ramp', synRatio: 0.92, pps: 1500, uniqueSources: 120, failedConns: 40, portEntropy: 1.1 },
  MITIGATED:       { seed: 606, shape: 'spike-recover', synRatio: 0.22, pps: 250, uniqueSources: 47, failedConns: 20, portEntropy: 1.3 },
};

const N_WINDOWS = 26;

// weight along the series (0..1) for a given shape at position t (0..1)
function envelope(shape: Shape, t: number): number {
  if (shape === 'flat') return 0;
  if (shape === 'ramp') return t < 0.35 ? 0 : (t - 0.35) / 0.65; // quiet, then rise
  // spike-recover: climb to a peak ~70% in, then fall back toward target
  if (t < 0.55) return t / 0.55;                 // 0 → 1 (peak)
  return 1 - ((t - 0.55) / 0.45) * 0.85;         // peak → residual
}

export interface ScenarioTraffic {
  windows: RawWindow[];            // full history, oldest → newest
  current: RawWindow;              // the latest window (what the dashboard scores)
  series: Record<string, number[]>; // raw per-channel history for the signal band
  trafficHistory: TrafficDataPoint[];
}

/**
 * Build one scenario's traffic, then run the Module 1 → Module 2 data flow
 * across it so acceleration (Δ mean-anomaly) and momentum (Δ score) are
 * measured from the stream, not assigned.
 */
export function generateScenario(key: string): ScenarioTraffic {
  const spec = SCENARIO_SPECS[key] ?? SCENARIO_SPECS.NORMAL;
  const rand = rng(spec.seed);
  const jitter = (v: number, pct: number) => v * (1 + (rand() * 2 - 1) * pct);

  const start = {
    synRatio: BASELINES.syn.mean, pps: BASELINES.pps.mean,
    uniqueSources: BASELINES.source.mean, failedConns: BASELINES.conn.mean,
    portEntropy: 1.2,
  };

  // 1) raw channels per window
  const raw = [] as Omit<RawWindow, 'acceleration' | 'momentum'>[];
  for (let i = 0; i < N_WINDOWS; i++) {
    const t = i / (N_WINDOWS - 1);
    const e = envelope(spec.shape, t);
    const lerp = (a: number, b: number) => a + (b - a) * e;
    raw.push({
      synRatio: Math.max(0, jitter(lerp(start.synRatio, spec.synRatio), 0.04)),
      pps: Math.max(40, Math.round(jitter(lerp(start.pps, spec.pps), 0.04))),
      uniqueSources: Math.max(3, Math.round(jitter(lerp(start.uniqueSources, spec.uniqueSources), 0.05))),
      failedConns: Math.max(0, Math.round(jitter(lerp(start.failedConns, spec.failedConns), 0.08))),
      portEntropy: Math.max(0, jitter(lerp(start.portEntropy, spec.portEntropy), 0.03)),
    });
  }

  // 2) run the M1→M2 data flow to MEASURE acceleration and momentum
  const windows: RawWindow[] = applyDynamics(raw);
  const scores = traceOf(windows).map((p) => p.score);

  // 3) per-channel series for the signal band
  const series: Record<string, number[]> = {
    syn: windows.map((w) => w.synRatio),
    pps: windows.map((w) => w.pps),
    source: windows.map((w) => w.uniqueSources),
    conn: windows.map((w) => w.failedConns),
  };

  // 4) traffic_history for the volume chart, coloured by each window's own score
  const threshold = Math.round(BASELINES.pps.mean + 3.2 * BASELINES.pps.std); // ~444
  const now = Date.now();
  const trafficHistory: TrafficDataPoint[] = windows.map((w, i) => {
    const status = statusFor(scores[i]);
    const time = new Date(now - (N_WINDOWS - 1 - i) * 15000);
    return {
      timestamp: time.toTimeString().split(' ')[0],
      time_offset: -((N_WINDOWS - 1 - i) * 15),
      traffic_volume: Math.round(w.pps),
      baseline: Math.round(BASELINES.pps.mean),
      anomaly_threshold: threshold,
      status,
      projected_escalation:
        (status === 'CRITICAL' || status === 'ELEVATED') && i >= N_WINDOWS - 4
          ? Math.round(w.pps + (i - (N_WINDOWS - 5)) * 60)
          : undefined,
    };
  });

  return { windows, current: windows[windows.length - 1], series, trafficHistory };
}
