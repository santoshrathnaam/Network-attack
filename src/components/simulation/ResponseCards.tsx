import React from 'react';
import type { DerivationData } from '../../types/cyberDefense';

interface ResponseCardsProps {
  derivation?: DerivationData;
  onChoose?: (action: string) => void;
}

const COPY: Record<string, { title: string; note: string }> = {
  NO_ACTION: { title: 'Do nothing', note: 'Nobody is inconvenienced. The attack keeps going.' },
  BLOCK_SOURCES: { title: 'Block the bad addresses', note: 'Quick, and users barely notice. Some attackers still get through.' },
  ISOLATE_SERVER: { title: 'Take the server offline', note: 'Stops it dead, but the service goes down for everyone.' },
};

/** The three choices, side by side, judged on one number: danger left in 5 minutes. */
export const ResponseCards: React.FC<ResponseCardsProps> = ({ derivation, onChoose }) => {
  if (!derivation) return null;
  const { options, bestAction } = derivation.decision;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {options.map((o) => {
        const copy = COPY[o.action] ?? { title: o.action, note: '' };
        const best = o.action === bestAction;
        const tone = o.risk > 0.6 ? 'text-rose-500' : o.risk > 0.3 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400';
        const bar = o.risk > 0.6 ? 'bg-rose-500' : o.risk > 0.3 ? 'bg-amber-500' : 'bg-emerald-500';
        return (
          <button
            key={o.action}
            onClick={() => onChoose?.(o.action)}
            className={`text-left rounded-2xl border-2 p-5 transition-colors ${
              best
                ? 'border-emerald-500 bg-emerald-500/[0.05]'
                : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A] hover:border-neutral-300 dark:hover:border-neutral-700'
            }`}
          >
            {best && (
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                Best option
              </div>
            )}
            <div className="text-lg font-bold text-neutral-900 dark:text-neutral-50 mb-1">{copy.title}</div>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 min-h-[40px]">{copy.note}</p>
            <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
              Danger in 5 minutes
            </div>
            <div className={`text-4xl font-extrabold tabular-nums ${tone}`}>{Math.round(o.risk * 100)}%</div>
            <div className="mt-2 h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
              <div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.max(2, o.risk * 100)}%` }} />
            </div>
          </button>
        );
      })}
    </div>
  );
};
