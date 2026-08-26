import type { CyberDefenseState, TrafficDataPoint } from '../types/cyberDefense';

export function createLiveTrafficTick(
  currentState: CyberDefenseState,
  timeRangeSec: number = 60
): { nextState: CyberDefenseState; newPoint: TrafficDataPoint } {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];
  const history = currentState.traffic_history || [];
  const lastPoint = history[history.length - 1];

  const baseline = 240 + Math.sin(Date.now() / 10000) * 15;
  const threshold = 480;

  let targetVolume = baseline;
  if (currentState.network_status === 'WATCH') {
    targetVolume = baseline + 120 + Math.random() * 30;
  } else if (currentState.network_status === 'ELEVATED') {
    targetVolume = baseline + 220 + Math.random() * 50;
  } else if (currentState.network_status === 'CRITICAL') {
    targetVolume = baseline + 320 + Math.random() * 80;
  }

  const prevVolume = lastPoint ? lastPoint.traffic_volume : baseline;
  const currentVolume = Math.round(prevVolume * 0.7 + targetVolume * 0.3 + (Math.random() * 10 - 5));

  const newPoint: TrafficDataPoint = {
    timestamp: timeStr,
    time_offset: 0,
    traffic_volume: Math.max(80, currentVolume),
    baseline: Math.round(baseline),
    anomaly_threshold: threshold,
    status: currentVolume > threshold ? 'CRITICAL' : currentState.network_status,
    projected_escalation: currentState.network_status === 'CRITICAL' ? currentVolume + 65 : undefined
  };

  const maxPoints = Math.min(40, Math.max(15, Math.floor(timeRangeSec / 3)));
  const updatedHistory = [...history.slice(-(maxPoints - 1)), newPoint].map((p, idx, arr) => ({
    ...p,
    time_offset: -((arr.length - 1 - idx) * 3)
  }));

  const nextState: CyberDefenseState = {
    ...currentState,
    timestamp: now.toISOString(),
    traffic_history: updatedHistory
  };

  return { nextState, newPoint };
}
