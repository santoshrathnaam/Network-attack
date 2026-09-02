import React from 'react';
import type { DerivationData, ChannelReading } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { Activity } from 'lucide-react';
import { plainDeviation, plainChannelLabel } from '../../services/narrative';

interface SignalMatrixProps {
  derivation?: DerivationData;
}

/**
 * The "how do I know?" panel. Every anomaly channel is drawn against its own
 * learned baseline band (mean ± 2σ). When the marker sits inside the band the
 * channel is quiet — that is what makes a NORMAL network read as normal, from
 * the evidence rather than from a label.
 */
export const SignalMatrix: React.FC<SignalMatrixProps> = ({ derivation }) => {
  if (!derivation) return null;
  const { channels, score } = derivation;

  return (
    <Card
      title="Is this normal?"
      subtitle="Each measurement compared with its usual range. Inside the green band = normal."
      badge={
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
          measured, not set
        </span>
      }
      action={
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Derived score</div>
          <div className="text-sm font-mono font-semibold text-neutral-800 dark:text-neutral-200 tabular-nums">
            {score.toFixed(2)}
          </div>
        </div>
      }
    >
      <div className="space-y-3 pt-1">
        {channels.map((c) => (
          <ChannelRow key={c.key} c={c} />
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-2 rounded-sm bg-emerald-500/25 border border-emerald-500/40" />
            usual range
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-500 border-2 border-white dark:border-[#12141A]" />
            right now
          </span>
        </div>
        <span className="flex items-center gap-1 font-mono">
          <Activity className="w-3 h-3" /> full working shown below
        </span>
      </div>
    </Card>
  );
};

const ChannelRow: React.FC<{ c: ChannelReading }> = ({ c }) => {
  const std = c.baselineStd || 1;
  // Axis spans a little below the band to well past it, always including current.
  const lo = Math.min(c.current, c.baselineMean - 3 * std);
  const hi = Math.max(c.current, c.baselineMean + 6 * std);
  const span = Math.max(hi - lo, 1e-6);
  const pos = (v: number) => ((v - lo) / span) * 100;

  const bandL = pos(c.baselineMean - 2 * std);
  const bandR = pos(c.baselineMean + 2 * std);
  const center = pos(c.baselineMean);
  const marker = Math.max(0, Math.min(100, pos(c.current)));

  const within = Math.abs(c.z) <= 2;
  const fmt = (v: number) => (c.key === 'syn' ? v.toFixed(2) : Math.round(v).toString());

  let markerColor = 'bg-emerald-500';
  let pill = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
  // Lead with plain English; the sigma is the small print underneath.
  const verdict = within ? 'normal' : plainDeviation(c.current, c.baselineMean);
  if (!within) {
    if (c.anomaly >= 0.6) {
      markerColor = 'bg-rose-500';
      pill = 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25';
    } else {
      markerColor = 'bg-orange-500';
      pill = 'text-orange-600 dark:text-orange-400 bg-orange-500/10 border-orange-500/25';
    }
  }

  return (
    <div className="grid grid-cols-[132px_1fr_136px] sm:grid-cols-[160px_1fr_152px] gap-3 items-center">
      {/* label + current value */}
      <div className="min-w-0">
        <div className="text-xs font-medium text-neutral-800 dark:text-neutral-200 truncate">
          {plainChannelLabel(c.key)}
        </div>
        <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 tabular-nums">
          {fmt(c.current)} <span className="text-neutral-400 dark:text-neutral-600">/ usual {fmt(c.baselineMean)}</span>
        </div>
      </div>

      {/* baseline band track */}
      <div className="relative h-7">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[3px] rounded bg-neutral-200 dark:bg-neutral-800" />
        {/* shaded normal band */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-4 rounded-md bg-emerald-500/15 border-x border-emerald-500/40"
          style={{ left: `${bandL}%`, width: `${Math.max(0, bandR - bandL)}%` }}
        />
        {/* baseline center */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-px h-4 bg-emerald-500/60"
          style={{ left: `${center}%` }}
        />
        {/* current marker */}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${markerColor} border-2 border-white dark:border-[#12141A] shadow-sm transition-all duration-500`}
          style={{ left: `${marker}%` }}
          title={`current ${fmt(c.current)} · z ${c.z.toFixed(1)}σ`}
        />
      </div>

      {/* verdict in plain words, sigma as small print */}
      <div className="flex flex-col items-end gap-0.5">
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap ${pill}`}>
          {verdict}
        </span>
        <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 tabular-nums">
          score {c.anomaly.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
