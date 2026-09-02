/**
 * narrative.ts — turn the derived state into plain English.
 * ==========================================================
 * Every sentence here is generated from the same numbers the technical panels
 * show. Nothing is scripted: change the traffic and the wording changes with
 * it. The goal is that someone with no security background can follow what the
 * system concluded and why, without meeting a sigma or a formula.
 */

import type { CyberDefenseState, ChannelReading } from '../types/cyberDefense';

export interface Narrative {
  statusLine: string;      // one-line verdict
  headline: string;        // what is happening, in human terms
  reasons: string[];       // the evidence, plainly stated
  prediction: string;      // what happens next
  recommendation: string;  // what to do about it
  reassurance?: string;    // shown when everything is fine
}

/** "6× above normal" / "slightly above normal" / "normal" */
export function plainDeviation(current: number, mean: number): string {
  if (mean <= 0) return current > 0 ? 'above normal' : 'normal';
  const ratio = current / mean;
  if (ratio >= 1.5) return `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× above normal`;
  if (ratio >= 1.15) return 'slightly above normal';
  if (ratio >= 0.85) return 'normal';
  if (ratio >= 0.5) return 'slightly below normal';
  return 'well below normal';
}

/** Everyday name for each telemetry channel. */
const PLAIN_NAME: Record<string, string> = {
  syn: 'connection attempts that never complete',
  traffic: 'traffic volume',
  source: 'machines connecting in',
  connection: 'failed connections',
};

const PLAIN_VERB: Record<string, string> = {
  syn: 'are', traffic: 'is', source: 'are', connection: 'are',
};

const PLAIN_SHORT: Record<string, string> = {
  syn: 'Half-finished connections',
  traffic: 'Traffic volume',
  source: 'Machines connecting',
  connection: 'Failed connections',
};

export function plainChannelLabel(key: string): string {
  return PLAIN_SHORT[key] ?? key;
}

const ACTION_PLAIN: Record<string, string> = {
  NO_ACTION: 'do nothing',
  BLOCK_SOURCES: 'block the suspicious sources',
  ISOLATE_SERVER: 'take the affected server offline',
};

const ACTION_TITLE: Record<string, string> = {
  NO_ACTION: 'No action needed',
  BLOCK_SOURCES: 'Block the suspicious sources',
  ISOLATE_SERVER: 'Take the affected server offline',
};

export function plainActionTitle(action: string): string {
  return ACTION_TITLE[action] ?? action;
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function describe(state: CyberDefenseState): Narrative | null {
  const d = state.derivation;
  if (!d) return null;

  const score = d.score;
  const status = state.network_status;
  const channels = d.channels;
  const byKey = (k: string) => channels.find((c) => c.key === k);

  // --- the loudest evidence, in plain words -------------------------------
  const hot = [...channels]
    .filter((c) => c.anomaly > 0.25)
    .sort((a, b) => b.anomaly - a.anomaly);

  const reasons = hot.slice(0, 3).map((c: ChannelReading) => {
    const dev = plainDeviation(c.current, c.baselineMean);
    return `${PLAIN_SHORT[c.key]} ${PLAIN_VERB[c.key] ?? 'are'} ${dev}.`;
  });

  // --- status line ---------------------------------------------------------
  let statusLine: string;
  if (status === 'SAFE') statusLine = 'Everything looks normal right now.';
  else if (status === 'WATCH') statusLine = 'Something unusual has started, but it is not an attack yet.';
  else if (status === 'ELEVATED') statusLine = 'This is starting to look like an attack.';
  else statusLine = 'An attack is underway right now.';

  // --- headline: what is happening ----------------------------------------
  let headline: string;
  const attack = d.predicted.key;
  const synC = byKey('syn');
  const trafficC = byKey('traffic');
  const sourceC = byKey('source');
  const connC = byKey('connection');

  if (status === 'SAFE') {
    headline =
      'Every measurement we track is sitting inside its usual range, so there is nothing to act on. ' +
      'This is what a healthy network looks like on this screen.';
  } else if (attack === 'DDoS') {
    const t = trafficC ? plainDeviation(trafficC.current, trafficC.baselineMean) : 'above normal';
    const s = synC ? Math.round(synC.current * 100) : 0;
    headline =
      `Traffic is ${t}, and about ${s} out of every 100 connection attempts never finish. ` +
      'That combination is the classic fingerprint of a flood attack — someone is trying to ' +
      'exhaust the server with more requests than it can answer.';
  } else if (attack === 'Port Scan') {
    const m = sourceC ? plainDeviation(sourceC.current, sourceC.baselineMean) : 'above normal';
    headline =
      `The number of machines connecting is ${m}, and they are probing lots of different doors ` +
      '(ports) rather than using the usual ones. That pattern means someone is mapping the ' +
      'network to find a way in — reconnaissance before an attack.';
  } else if (attack === 'Credential Attack') {
    const f = connC ? plainDeviation(connC.current, connC.baselineMean) : 'above normal';
    headline =
      `Failed connections are ${f}, while overall traffic stays fairly ordinary. ` +
      'That is what password guessing looks like: many attempts, most of them rejected.';
  } else {
    const t = trafficC ? plainDeviation(trafficC.current, trafficC.baselineMean) : 'above normal';
    headline =
      `Traffic volume is ${t} without the connection pattern that usually comes with it. ` +
      'That can mean data is being moved out of the network.';
  }

  // --- prediction ----------------------------------------------------------
  let prediction: string;
  const tte = d.timeToEscalation;
  if (status === 'SAFE') {
    prediction = 'Nothing is building. At the current rate the network stays in this state.';
  } else if (tte > 0) {
    prediction = `It is still getting worse. At the rate it is climbing, this reaches critical levels in roughly ${tte} minute${tte === 1 ? '' : 's'}.`;
  } else if (score >= 0.70) {
    prediction = 'It has already peaked — the attack is at full strength now, not building toward it.';
  } else {
    prediction = 'It is not climbing any further at the moment.';
  }

  // --- recommendation ------------------------------------------------------
  const dec = d.decision;
  let recommendation: string;
  if (dec.bestAction === 'NO_ACTION' || status === 'SAFE') {
    recommendation =
      'No response is needed. Acting now would take services offline for no benefit.';
  } else {
    recommendation =
      `Risk ${dec.horizon === '5m' ? 'five minutes' : dec.horizon} from now drops from ` +
      `${pct(dec.noActionRisk)} to ${pct(dec.bestRisk)} — about ${dec.reductionPct}% lower than doing nothing.`;
  }

  const reassurance = status === 'SAFE'
    ? 'The score below is near zero because every signal is inside its normal band — not because the screen was set that way.'
    : undefined;

  return { statusLine, headline, reasons, prediction, recommendation, reassurance };
}
