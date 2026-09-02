/**
 * mockDataset.ts — demo stages, now DERIVED not typed.
 * =====================================================
 * Each stage used to be a block of hand-written round numbers. It is now built
 * by generating that scenario's traffic (trafficModel.ts) and running it
 * through the ported pipeline (engine.ts + stateBuilder.ts) — the same code
 * path the live sandbox uses. Every headline number traces back to telemetry.
 */

import type { CyberDefenseState, DemoStage } from '../types/cyberDefense';
import { generateScenario } from './trafficModel';
import { stateFromWindows } from '../services/stateBuilder';

/** Build one scenario's full state from its generated traffic. */
function buildState(scenarioKey: string): CyberDefenseState {
  return stateFromWindows(generateScenario(scenarioKey).windows);
}

/**
 * Rebuild a stage on demand. DEMO_STAGES is computed once at import, so when the
 * operator edits the decision model we need to re-derive rather than show a
 * state that was calculated under the old assumptions.
 */
export function buildStageState(scenarioKey: string): CyberDefenseState {
  return buildState(scenarioKey);
}

export const DEMO_STAGES: DemoStage[] = [
  {
    id: 1, key: 'NORMAL',
    name: 'Stage 1: Normal Operations',
    description: 'Every channel sits inside its baseline band — the score is near zero because the evidence is quiet, not because it is asserted.',
    state: buildState('NORMAL'),
  },
  {
    id: 2, key: 'ANOMALY',
    name: 'Stage 2: Anomaly Detected',
    description: 'SYN ratio and failed connections push a few sigma past baseline; the weighted score crosses into WATCH.',
    state: buildState('ANOMALY'),
  },
  {
    id: 3, key: 'SCANNING',
    name: 'Stage 3: Reconnaissance',
    description: 'Source diversity and port entropy spike — the classifier now leads with Port Scan.',
    state: buildState('SCANNING'),
  },
  {
    id: 4, key: 'ATTACK_IMMINENT',
    name: 'Stage 4: Attack Imminent',
    description: 'SYN, traffic and connection channels saturate; DDoS dominates the forecast and escalation is minutes away.',
    state: buildState('ATTACK_IMMINENT'),
  },
  {
    id: 5, key: 'SIMULATION',
    name: 'Stage 5: Counterfactual Decision',
    description: 'At peak risk the engine projects each response forward — isolating the server yields the lowest 10-minute risk.',
    state: buildState('SIMULATION'),
  },
  {
    id: 6, key: 'MITIGATED',
    name: 'Stage 6: Mitigated',
    description: 'After isolation the measured channels fall back toward baseline and momentum turns negative — recovery, shown in the telemetry.',
    state: buildState('MITIGATED'),
  },
];

export const DEFAULT_STATE: CyberDefenseState = DEMO_STAGES[3].state;
