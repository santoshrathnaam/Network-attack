/**
 * stateBuilder.ts — turn a window history into the Module-4 dashboard contract.
 * =============================================================================
 * One code path, used by both the scripted demo scenarios and the live sandbox,
 * so what you see when you drag a dial is produced by exactly the same engine
 * as the scripted stages.
 */

import type {
  CyberDefenseState, EvidenceItem, InterventionAction, TrafficDataPoint,
} from '../types/cyberDefense';
import {
  derive, traceOf, statusFor, BASELINES, type Derived, type RawWindow,
} from './engine';

function severityFor(anomaly: number): 'LOW' | 'MEDIUM' | 'HIGH' {
  if (anomaly >= 0.6) return 'HIGH';
  if (anomaly >= 0.3) return 'MEDIUM';
  return 'LOW';
}

function fmtVal(key: string, v: number): string {
  switch (key) {
    case 'syn': return v.toFixed(2);
    case 'traffic': return `${Math.round(v)} pkt/s`;
    case 'source': return `${Math.round(v)} hosts`;
    case 'connection': return `${Math.round(v)} conn`;
    default: return String(v);
  }
}

function evidenceFrom(d: Derived): EvidenceItem[] {
  const items: EvidenceItem[] = d.channels.map((c) => ({
    name: c.label,
    change: c.anomaly,
    baseline_value: fmtVal(c.key, c.baselineMean),
    current_value: fmtVal(c.key, c.current),
    unit: c.unit,
    severity: severityFor(c.anomaly),
  }));
  items.push({
    name: 'Temporal acceleration',
    change: d.derivation.acceleration,
    baseline_value: '0.00',
    current_value: d.derivation.acceleration.toFixed(2),
    unit: 'Δ',
    severity: severityFor(d.derivation.acceleration),
  });
  return items;
}

function historyFrom(windows: RawWindow[], scores: number[]): TrafficDataPoint[] {
  const threshold = Math.round(BASELINES.pps.mean + 3.2 * BASELINES.pps.std);
  const now = Date.now();
  const n = windows.length;
  return windows.map((w, i) => {
    const status = statusFor(scores[i] ?? 0);
    const time = new Date(now - (n - 1 - i) * 15000);
    return {
      timestamp: time.toTimeString().split(' ')[0],
      time_offset: -((n - 1 - i) * 15),
      traffic_volume: Math.round(w.pps),
      baseline: Math.round(BASELINES.pps.mean),
      anomaly_threshold: threshold,
      status,
      projected_escalation:
        (status === 'CRITICAL' || status === 'ELEVATED') && i >= n - 4
          ? Math.round(w.pps + (i - (n - 5)) * 60)
          : undefined,
    };
  });
}

/** Assemble the full dashboard state from a measured window history. */
export function stateFromWindows(windows: RawWindow[]): CyberDefenseState {
  const w = windows[windows.length - 1];
  const series: Record<string, number[]> = {
    syn: windows.map((x) => x.synRatio),
    pps: windows.map((x) => x.pps),
    source: windows.map((x) => x.uniqueSources),
    conn: windows.map((x) => x.failedConns),
  };

  const d = derive(w, series);
  const trace = traceOf(windows);
  d.derivation.trace = trace;

  const sc = d.cf.scenarios;
  const at10 = (a: string) => sc[a]['10m'];

  return {
    timestamp: new Date().toISOString(),
    network_status: d.status,
    threat: {
      score: d.score,
      momentum: w.momentum,
      time_to_escalation: d.tte >= 99 ? 0 : d.tte,
    },
    forecast: d.forecast,
    trajectory: {
      current_stage: d.stage.name,
      next_stage: d.next,
      stages: ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'],
      stage_progress: Math.round(d.stage.progress * 100) / 100,
    },
    evidence: evidenceFrom(d),
    simulation: {
      no_action: at10('NO_ACTION'),
      block_sources: at10('BLOCK_SOURCES'),
      isolate_server: at10('ISOLATE_SERVER'),
      recommended_action: d.cf.best as InterventionAction,
      risk_reduction: d.cf.riskReduction,
    },
    traffic_history: historyFrom(windows, trace.map((p) => p.score)),
    derivation: d.derivation,
  };
}
