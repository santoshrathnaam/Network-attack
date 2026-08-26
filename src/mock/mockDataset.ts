import type { CyberDefenseState, DemoStage, TrafficDataPoint } from '../types/cyberDefense';

/** Generate realistic mock traffic curve for each stage */
export const generateTrafficSeries = (stageKey: string, count: number = 30): TrafficDataPoint[] => {
  const points: TrafficDataPoint[] = [];
  const now = new Date();

  for (let i = count - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 15 * 1000);
    const timeStr = time.toTimeString().split(' ')[0];
    const offset = -(i * 15);
    const baseline = 240 + Math.sin(i * 0.4) * 20;
    const threshold = 480;
    
    let volume = baseline + (Math.random() * 25 - 12);
    let projected: number | undefined = undefined;
    let status: 'SAFE' | 'WATCH' | 'ELEVATED' | 'CRITICAL' = 'SAFE';

    if (stageKey === 'NORMAL') {
      volume = baseline + (Math.random() * 20 - 10);
      status = 'SAFE';
    } else if (stageKey === 'ANOMALY') {
      if (i < 12) {
        volume = baseline + (12 - i) * 18 + Math.random() * 15;
        status = 'WATCH';
      }
    } else if (stageKey === 'SCANNING') {
      if (i < 18) {
        volume = baseline + (18 - i) * 22 + Math.random() * 25;
        status = volume > threshold ? 'CRITICAL' : 'ELEVATED';
      }
    } else if (stageKey === 'ATTACK_IMMINENT' || stageKey === 'SIMULATION') {
      if (i < 20) {
        volume = baseline + (20 - i) * 35 + Math.random() * 30;
        status = volume > threshold ? 'CRITICAL' : 'ELEVATED';
      }
    } else if (stageKey === 'MITIGATED') {
      if (i > 15) {
        volume = baseline + (i - 15) * 15;
      } else {
        volume = baseline - 20 + Math.random() * 15;
      }
      status = 'SAFE';
    }

    // Future projection window for last 6 data points in active threat stages
    if ((stageKey === 'ATTACK_IMMINENT' || stageKey === 'SIMULATION') && i <= 6) {
      projected = volume + (7 - i) * 45;
    }

    points.push({
      timestamp: timeStr,
      time_offset: offset,
      traffic_volume: Math.round(volume),
      baseline: Math.round(baseline),
      anomaly_threshold: threshold,
      projected_escalation: projected ? Math.round(projected) : undefined,
      is_future: i < 0,
      status: volume > threshold ? 'CRITICAL' : status
    });
  }

  return points;
};

export const DEMO_STAGES: DemoStage[] = [
  {
    id: 1,
    key: 'NORMAL',
    name: 'Stage 1: Normal Operations',
    description: 'Baseline telemetry within expected operating thresholds. No malicious telemetry detected.',
    state: {
      timestamp: new Date().toISOString(),
      network_status: 'SAFE',
      threat: {
        score: 0.08,
        momentum: 0.01,
        time_to_escalation: 0
      },
      forecast: {
        'DDoS': 0.04,
        'Credential Attack': 0.06,
        'Port Scan': 0.03,
        'Exfiltration': 0.02
      },
      trajectory: {
        current_stage: 'NORMAL',
        next_stage: 'ANOMALY',
        stages: ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'],
        stage_progress: 0.15
      },
      evidence: [
        { name: 'SYN traffic', change: 0.02, baseline_value: '1.2k pkts/s', current_value: '1.22k pkts/s', severity: 'LOW' },
        { name: 'Unique source IPs', change: 0.01, baseline_value: '420 hosts', current_value: '424 hosts', severity: 'LOW' },
        { name: 'Failed connections', change: 0.03, baseline_value: '14 conn/s', current_value: '14.4 conn/s', severity: 'LOW' },
        { name: 'Traffic momentum', change: 0.01, baseline_value: '0.05 Mb/s²', current_value: '0.05 Mb/s²', severity: 'LOW' }
      ],
      simulation: {
        no_action: 0.08,
        block_sources: 0.07,
        isolate_server: 0.06,
        recommended_action: 'NO_ACTION',
        risk_reduction: 0.0
      },
      traffic_history: generateTrafficSeries('NORMAL')
    }
  },
  {
    id: 2,
    key: 'ANOMALY',
    name: 'Stage 2: Anomaly Detected',
    description: 'Unusual packet distribution and sudden rise in connection retries from external subnets.',
    state: {
      timestamp: new Date().toISOString(),
      network_status: 'WATCH',
      threat: {
        score: 0.34,
        momentum: 0.08,
        time_to_escalation: 18
      },
      forecast: {
        'DDoS': 0.28,
        'Credential Attack': 0.22,
        'Port Scan': 0.35,
        'Exfiltration': 0.09
      },
      trajectory: {
        current_stage: 'ANOMALY',
        next_stage: 'SCANNING',
        stages: ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'],
        stage_progress: 0.45
      },
      evidence: [
        { name: 'SYN traffic', change: 0.22, baseline_value: '1.2k pkts/s', current_value: '1.46k pkts/s', severity: 'MEDIUM' },
        { name: 'Unique source IPs', change: 0.28, baseline_value: '420 hosts', current_value: '538 hosts', severity: 'MEDIUM' },
        { name: 'Failed connections', change: 0.19, baseline_value: '14 conn/s', current_value: '16.7 conn/s', severity: 'MEDIUM' },
        { name: 'Traffic momentum', change: 0.15, baseline_value: '0.05 Mb/s²', current_value: '0.12 Mb/s²', severity: 'LOW' }
      ],
      simulation: {
        no_action: 0.45,
        block_sources: 0.20,
        isolate_server: 0.15,
        recommended_action: 'BLOCK_SOURCES',
        risk_reduction: 0.55
      },
      traffic_history: generateTrafficSeries('ANOMALY')
    }
  },
  {
    id: 3,
    key: 'SCANNING',
    name: 'Stage 3: Active Reconnaissance',
    description: 'High-frequency SYN port probing across edge services with coordinated multi-subnet sources.',
    state: {
      timestamp: new Date().toISOString(),
      network_status: 'ELEVATED',
      threat: {
        score: 0.62,
        momentum: 0.14,
        time_to_escalation: 8
      },
      forecast: {
        'Port Scan': 0.74,
        'DDoS': 0.58,
        'Credential Attack': 0.38,
        'Exfiltration': 0.14
      },
      trajectory: {
        current_stage: 'SCANNING',
        next_stage: 'ATTACK_IMMINENT',
        stages: ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'],
        stage_progress: 0.70
      },
      evidence: [
        { name: 'Port probing rate', change: 0.74, baseline_value: '22 probes/s', current_value: '184 probes/s', severity: 'HIGH' },
        { name: 'SYN traffic', change: 0.48, baseline_value: '1.2k pkts/s', current_value: '2.35k pkts/s', severity: 'HIGH' },
        { name: 'Unique source IPs', change: 0.51, baseline_value: '420 hosts', current_value: '840 hosts', severity: 'MEDIUM' },
        { name: 'Failed connections', change: 0.64, baseline_value: '14 conn/s', current_value: '48.2 conn/s', severity: 'HIGH' }
      ],
      simulation: {
        no_action: 0.78,
        block_sources: 0.32,
        isolate_server: 0.21,
        recommended_action: 'BLOCK_SOURCES',
        risk_reduction: 0.59
      },
      traffic_history: generateTrafficSeries('SCANNING')
    }
  },
  {
    id: 4,
    key: 'ATTACK_IMMINENT',
    name: 'Stage 4: Attack Imminent (DDoS Forecast)',
    description: 'Critical volumetric SYN surge and botnet convergence. Model projects saturation within 3–5 minutes.',
    state: {
      timestamp: '2026-08-26T19:05:00',
      network_status: 'CRITICAL',
      threat: {
        score: 0.87,
        momentum: 0.18,
        time_to_escalation: 4
      },
      forecast: {
        'DDoS': 0.87,
        'Credential Attack': 0.42,
        'Port Scan': 0.23,
        'Exfiltration': 0.12
      },
      trajectory: {
        current_stage: 'ATTACK_IMMINENT',
        next_stage: 'DDoS',
        stages: ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'],
        stage_progress: 0.88
      },
      evidence: [
        { name: 'SYN traffic', change: 0.68, baseline_value: '1.2k pkts/s', current_value: '4.85k pkts/s', severity: 'HIGH' },
        { name: 'Unique source IPs', change: 0.54, baseline_value: '420 hosts', current_value: '1.92k hosts', severity: 'HIGH' },
        { name: 'Failed connections', change: 0.72, baseline_value: '14 conn/s', current_value: '128 conn/s', severity: 'HIGH' },
        { name: 'Traffic momentum', change: 0.61, baseline_value: '0.05 Mb/s²', current_value: '1.82 Mb/s²', severity: 'HIGH' }
      ],
      simulation: {
        no_action: 0.93,
        block_sources: 0.39,
        isolate_server: 0.24,
        recommended_action: 'ISOLATE_SERVER',
        risk_reduction: 0.73
      },
      traffic_history: generateTrafficSeries('ATTACK_IMMINENT')
    }
  },
  {
    id: 5,
    key: 'SIMULATION',
    name: 'Stage 5: Counterfactual Simulation',
    description: 'Evaluating predictive branches: No Intervention (93% failure) vs Server Isolation (24% risk).',
    state: {
      timestamp: '2026-08-26T19:07:30',
      network_status: 'CRITICAL',
      threat: {
        score: 0.87,
        momentum: 0.18,
        time_to_escalation: 3
      },
      forecast: {
        'DDoS': 0.87,
        'Credential Attack': 0.42,
        'Port Scan': 0.23,
        'Exfiltration': 0.12
      },
      trajectory: {
        current_stage: 'ATTACK_IMMINENT',
        next_stage: 'DDoS',
        stages: ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'],
        stage_progress: 0.92
      },
      evidence: [
        { name: 'SYN traffic', change: 0.68, baseline_value: '1.2k pkts/s', current_value: '4.85k pkts/s', severity: 'HIGH' },
        { name: 'Unique source IPs', change: 0.54, baseline_value: '420 hosts', current_value: '1.92k hosts', severity: 'HIGH' },
        { name: 'Failed connections', change: 0.72, baseline_value: '14 conn/s', current_value: '128 conn/s', severity: 'HIGH' },
        { name: 'Traffic momentum', change: 0.61, baseline_value: '0.05 Mb/s²', current_value: '1.82 Mb/s²', severity: 'HIGH' }
      ],
      simulation: {
        no_action: 0.93,
        block_sources: 0.39,
        isolate_server: 0.24,
        recommended_action: 'ISOLATE_SERVER',
        risk_reduction: 0.73
      },
      traffic_history: generateTrafficSeries('SIMULATION')
    }
  },
  {
    id: 6,
    key: 'MITIGATED',
    name: 'Stage 6: Mitigated Defense State',
    description: 'Intervention executed. Affected node isolated, malicious packets sinkholed, traffic restored to safe baseline.',
    state: {
      timestamp: new Date().toISOString(),
      network_status: 'SAFE',
      threat: {
        score: 0.18,
        momentum: -0.12,
        time_to_escalation: 0
      },
      forecast: {
        'DDoS': 0.12,
        'Credential Attack': 0.11,
        'Port Scan': 0.08,
        'Exfiltration': 0.04
      },
      trajectory: {
        current_stage: 'NORMAL',
        next_stage: 'MONITORING',
        stages: ['NORMAL', 'ANOMALY', 'SCANNING', 'ATTACK_IMMINENT', 'DDoS'],
        stage_progress: 0.10
      },
      evidence: [
        { name: 'SYN traffic', change: -0.65, baseline_value: '1.2k pkts/s', current_value: '1.28k pkts/s', severity: 'LOW' },
        { name: 'Unique source IPs', change: -0.58, baseline_value: '420 hosts', current_value: '435 hosts', severity: 'LOW' },
        { name: 'Failed connections', change: -0.70, baseline_value: '14 conn/s', current_value: '15.1 conn/s', severity: 'LOW' },
        { name: 'Traffic momentum', change: -0.62, baseline_value: '0.05 Mb/s²', current_value: '-0.08 Mb/s²', severity: 'LOW' }
      ],
      simulation: {
        no_action: 0.18,
        block_sources: 0.15,
        isolate_server: 0.12,
        recommended_action: 'NO_ACTION',
        risk_reduction: 0.0
      },
      traffic_history: generateTrafficSeries('MITIGATED')
    }
  }
];

export const DEFAULT_STATE: CyberDefenseState = DEMO_STAGES[3].state;
