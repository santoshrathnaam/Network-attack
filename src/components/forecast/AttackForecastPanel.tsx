import React from 'react';
import { ForecastData } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { ShieldAlert, Crosshair, Lock, Database } from 'lucide-react';

interface AttackForecastPanelProps {
  forecast: ForecastData;
}

export const AttackForecastPanel: React.FC<AttackForecastPanelProps> = ({ forecast }) => {
  // Sort entries descending by probability
  const entries = Object.entries(forecast).sort((a, b) => b[1] - a[1]);
  const highest = entries[0];

  const getAttackIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('ddos') || lower.includes('flood')) return <ShieldAlert className="w-4 h-4" />;
    if (lower.includes('port') || lower.includes('scan')) return <Crosshair className="w-4 h-4" />;
    if (lower.includes('credential') || lower.includes('auth')) return <Lock className="w-4 h-4" />;
    return <Database className="w-4 h-4" />;
  };

  return (
    <Card
      title="Attack Forecast"
      subtitle="Multivariate classification probability distribution"
      badge={
        highest && (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800/40">
            Primary: {highest[0]}
          </span>
        )
      }
    >
      <div className="space-y-4 pt-1">
        {entries.map(([attackType, prob], index) => {
          const percentage = Math.round(prob * 100);
          const isDominant = index === 0;

          let barColor = 'bg-neutral-300 dark:bg-neutral-700';
          let textColor = 'text-neutral-700 dark:text-neutral-300';

          if (isDominant) {
            if (prob >= 0.7) {
              barColor = 'bg-rose-500';
              textColor = 'text-rose-600 dark:text-rose-400 font-bold';
            } else if (prob >= 0.4) {
              barColor = 'bg-orange-500';
              textColor = 'text-orange-600 dark:text-orange-400 font-bold';
            } else {
              barColor = 'bg-amber-500';
              textColor = 'text-amber-600 dark:text-amber-400 font-bold';
            }
          }

          return (
            <div key={attackType} className="group">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`${
                      isDominant
                        ? 'text-neutral-900 dark:text-neutral-100 font-semibold'
                        : 'text-neutral-600 dark:text-neutral-400 font-medium'
                    }`}
                  >
                    {attackType}
                  </span>
                  {isDominant && (
                    <span className="text-[10px] uppercase font-semibold text-rose-500 tracking-wider">
                      Dominant Threat
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm tabular-nums ${textColor}`}>
                    {percentage}%
                  </span>
                </div>
              </div>

              {/* Progress bar container */}
              <div className="h-2 w-full bg-neutral-100 dark:bg-neutral-800/80 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
                  style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-400 dark:text-neutral-500">
        <span>Classifier: Temporal Attention Ensemble</span>
        <span className="font-mono">Entropy: 0.28</span>
      </div>
    </Card>
  );
};
