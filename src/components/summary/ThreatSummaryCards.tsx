import React from 'react';
import { ThreatSummary, NetworkStatus } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { TrendingUp, Clock, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface ThreatSummaryCardsProps {
  /** Derived recommendation confidence (0-1). Omitted for raw API payloads. */
  confidence?: number;
  threat: ThreatSummary;
  networkStatus: NetworkStatus;
}

export const ThreatSummaryCards: React.FC<ThreatSummaryCardsProps> = ({
  threat,
  networkStatus,
  confidence
}) => {
  const percentage = Math.round(threat.score * 100);
  const momentumSign = threat.momentum > 0 ? '+' : '';
  const momentumFormatted = `${momentumSign}${Math.round(threat.momentum * 100)}/min`;

  // Semantic color styling
  let semanticClass = 'text-emerald-600 dark:text-emerald-400';
  let progressBg = 'bg-emerald-500';
  let statusDetail = 'Every measurement is sitting inside its normal range.';

  if (networkStatus === 'WATCH') {
    semanticClass = 'text-amber-600 dark:text-amber-400';
    progressBg = 'bg-amber-500';
    statusDetail = 'Some readings have drifted outside their usual range.';
  } else if (networkStatus === 'ELEVATED') {
    semanticClass = 'text-orange-600 dark:text-orange-400';
    progressBg = 'bg-orange-500';
    statusDetail = 'Lots of machines are probing the network at once — someone is looking for a way in.';
  } else if (networkStatus === 'CRITICAL') {
    semanticClass = 'text-rose-600 dark:text-rose-400';
    progressBg = 'bg-rose-500';
    statusDetail = 'The server is close to being overwhelmed. Act now.';
  }

  return (
    <div className="space-y-4">
      {/* Top Network Status Banner */}
      <div className="bg-white dark:bg-[#12141A] border border-[#E5E5EA] dark:border-[#222733] rounded-[16px] p-5 shadow-apple dark:shadow-apple-dark flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Network Status
            </span>
            <Badge status={networkStatus} size="sm" />
          </div>
          <div className="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            Threat Level:{' '}
            <span className={semanticClass}>{networkStatus}</span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-2xl">
            {statusDetail}
          </p>
        </div>

        <div className="flex items-center gap-6 self-start md:self-auto border-t md:border-t-0 pt-3 md:pt-0 border-neutral-100 dark:border-neutral-800">
          <div className="text-right hidden sm:block">
            <div className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              How sure we are
            </div>
            <div className="text-sm font-semibold font-mono text-neutral-800 dark:text-neutral-200">
              {confidence !== undefined ? `${Math.round(confidence * 100)}%` : '—'}
            </div>
          </div>
        </div>
      </div>

      {/* 3 Dominant Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1: Threat Score */}
        <Card className="relative overflow-hidden group">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase">
              Threat Score
            </span>
            {percentage > 70 ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <ShieldCheck className="w-4 h-4 text-neutral-400" />
            )}
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <div className={`text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums ${semanticClass}`}>
              {percentage}%
            </div>
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
              Scale 0–100%
            </span>
          </div>

          {/* Restrained horizontal track bar */}
          <div className="mt-3.5 w-full bg-neutral-100 dark:bg-neutral-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full ${progressBg} transition-all duration-500 ease-out`}
              style={{ width: `${Math.min(100, Math.max(4, percentage))}%` }}
            />
          </div>

          <div className="mt-2.5 text-[11px] text-neutral-400 dark:text-neutral-500 flex justify-between">
            <span>Normal is under 25%</span>
            <span>Critical at 75%</span>
          </div>
        </Card>

        {/* Metric 2: Is it getting worse? */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase">
              Is it getting worse?
            </span>
            <TrendingUp className="w-4 h-4 text-neutral-400" />
          </div>

          <div className="flex items-baseline justify-between mt-1">
            <div
              className={`text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums ${
                threat.momentum > 0.1
                  ? 'text-rose-600 dark:text-rose-400'
                  : threat.momentum < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-neutral-900 dark:text-neutral-50'
              }`}
            >
              {momentumFormatted}
            </div>
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500">
              right now
            </span>
          </div>

          <div className="mt-3.5 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {threat.momentum > 0.15 ? (
              <span className="text-rose-600 dark:text-rose-400 font-medium">
                Rapid escalation: Anomaly vector accelerating
              </span>
            ) : threat.momentum > 0 ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Gradual increase in ingress anomaly signals
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                Stable: No acceleration detected
              </span>
            )}
          </div>

          <div className="mt-2.5 text-[11px] text-neutral-400 dark:text-neutral-500 flex justify-between">
            <span>Change per minute</span>
            <span className="font-mono">{threat.momentum > 0 ? `+${(threat.momentum * 100).toFixed(1)}/min` : '0.0/min'}</span>
          </div>
        </Card>

        {/* Metric 3: Time to Escalation */}
        <Card className="relative overflow-hidden">
          <div className="flex items-center justify-between text-neutral-400 dark:text-neutral-500 mb-1">
            <span className="text-xs font-semibold tracking-wider uppercase">
              Time to Escalation
            </span>
            <Clock className="w-4 h-4 text-neutral-400" />
          </div>

          <div className="flex items-baseline justify-between gap-2 mt-1">
            <div
              className={`text-4xl sm:text-5xl font-semibold tracking-tight tabular-nums min-w-0 truncate ${
                threat.time_to_escalation > 0 && threat.time_to_escalation <= 5
                  ? 'text-rose-600 dark:text-rose-400'
                  : threat.time_to_escalation > 5
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-neutral-900 dark:text-neutral-50'
              }`}
            >
              {threat.time_to_escalation > 0 ? `${threat.time_to_escalation} min` : 'Stable'}
            </div>
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 flex-none whitespace-nowrap">
              {threat.time_to_escalation > 0 ? 'until critical' : 'not rising'}
            </span>
          </div>

          <div className="mt-3.5 text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {threat.time_to_escalation > 0 ? (
              <span>
                Projected trajectory to system saturation under current traffic rate
              </span>
            ) : (
              <span>No critical escalation projected within forecast window</span>
            )}
          </div>

          <div className="mt-2.5 text-[11px] text-neutral-400 dark:text-neutral-500 flex justify-between">
            <span>Accurate to</span>
            <span className="font-mono">± 45s</span>
          </div>
        </Card>
      </div>
    </div>
  );
};
