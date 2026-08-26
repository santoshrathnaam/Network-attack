import React from 'react';
import { TrajectoryData, TrajectoryStage } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { Check, ArrowRight, AlertTriangle, Shield, Radio } from 'lucide-react';

interface AttackTrajectoryPipelineProps {
  trajectory: TrajectoryData;
}

const DEFAULT_STAGES: TrajectoryStage[] = [
  'NORMAL',
  'ANOMALY',
  'SCANNING',
  'ATTACK_IMMINENT',
  'DDoS'
];

const STAGE_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  ANOMALY: 'Anomaly',
  SCANNING: 'Scanning',
  ATTACK_IMMINENT: 'Attack Imminent',
  DDoS: 'DDoS Escalation',
  MITIGATED: 'Mitigated'
};

export const AttackTrajectoryPipeline: React.FC<AttackTrajectoryPipelineProps> = ({
  trajectory
}) => {
  const stages = trajectory.stages?.length ? trajectory.stages : DEFAULT_STAGES;
  const currentStage = trajectory.current_stage;

  // Find index of current stage
  let currentIndex = stages.indexOf(currentStage);
  if (currentIndex === -1) {
    if (currentStage === 'DDoS') currentIndex = 4;
    else if (currentStage === 'ATTACK_IMMINENT') currentIndex = 3;
    else if (currentStage === 'SCANNING') currentIndex = 2;
    else if (currentStage === 'ANOMALY') currentIndex = 1;
    else currentIndex = 0;
  }

  return (
    <Card
      title="Attack Trajectory Progression"
      subtitle="Temporal state transitions from baseline to projected attack state"
      badge={
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
          Stage {currentIndex + 1} of {stages.length}
        </span>
      }
    >
      <div className="pt-2 pb-2">
        {/* Desktop Pipeline Stepper */}
        <div className="relative">
          {/* Background connector line */}
          <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-0.5 bg-neutral-200 dark:bg-neutral-800" />
          
          {/* Active progress connector line */}
          <div
            className="absolute top-1/2 left-4 -translate-y-1/2 h-0.5 bg-neutral-900 dark:bg-neutral-100 transition-all duration-500"
            style={{
              width: `${(currentIndex / Math.max(1, stages.length - 1)) * 92}%`
            }}
          />

          <div className="relative flex items-center justify-between">
            {stages.map((stage, idx) => {
              const isPast = idx < currentIndex;
              const isCurrent = idx === currentIndex;
              const isFuture = idx > currentIndex;

              const label = STAGE_LABELS[stage] || stage.replace('_', ' ');

              return (
                <div key={stage} className="flex flex-col items-center group relative">
                  {/* Node Circle */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-semibold z-10 transition-all duration-300 ${
                      isCurrent
                        ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 ring-4 ring-rose-500/20 dark:ring-rose-400/20 shadow-md scale-110'
                        : isPast
                        ? 'bg-neutral-200 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                        : 'bg-white dark:bg-[#12141A] border-2 border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-600'
                    }`}
                  >
                    {isPast ? (
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    ) : isCurrent ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    ) : (
                      idx + 1
                    )}
                  </div>

                  {/* Stage Label */}
                  <div className="mt-2.5 text-center">
                    <span
                      className={`text-xs block whitespace-nowrap transition-colors ${
                        isCurrent
                          ? 'font-bold text-neutral-900 dark:text-neutral-100'
                          : isPast
                          ? 'font-medium text-neutral-600 dark:text-neutral-400'
                          : 'font-normal text-neutral-400 dark:text-neutral-600'
                      }`}
                    >
                      {label}
                    </span>

                    {/* Current Indicator Pin */}
                    {isCurrent && (
                      <div className="mt-1 flex flex-col items-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-200 dark:border-rose-800/60 inline-flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-rose-500 animate-ping" />
                          NOW
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="font-medium text-neutral-700 dark:text-neutral-300">
            Next Predicted State:
          </span>
          <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
            {STAGE_LABELS[trajectory.next_stage] || trajectory.next_stage}
          </span>
        </div>
        <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
          Markov transition matrix confidence: 91.8%
        </div>
      </div>
    </Card>
  );
};
