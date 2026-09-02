import React from 'react';
import type { CyberDefenseState } from '../../types/cyberDefense';
import { describe, plainActionTitle } from '../../services/narrative';
import { ShieldCheck, AlertTriangle, Search, Clock, ArrowRight } from 'lucide-react';

interface PlainSummaryProps {
  state: CyberDefenseState;
}

/**
 * The page's plain-English opening. Everything here is generated from the same
 * derived numbers the technical panels show — it just says them in words a
 * non-specialist can follow, so the room understands the situation before
 * anyone has to explain what a standard deviation is.
 */
export const PlainSummary: React.FC<PlainSummaryProps> = ({ state }) => {
  const n = describe(state);
  if (!n) return null;

  const status = state.network_status;
  const safe = status === 'SAFE';

  const tone = safe
    ? { ring: 'border-emerald-500/30', chip: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border-emerald-500/30', accent: 'text-emerald-600 dark:text-emerald-400', Icon: ShieldCheck }
    : status === 'WATCH'
    ? { ring: 'border-amber-500/30', chip: 'bg-amber-500/12 text-amber-600 dark:text-amber-400 border-amber-500/30', accent: 'text-amber-600 dark:text-amber-400', Icon: Search }
    : status === 'ELEVATED'
    ? { ring: 'border-orange-500/30', chip: 'bg-orange-500/12 text-orange-600 dark:text-orange-400 border-orange-500/30', accent: 'text-orange-600 dark:text-orange-400', Icon: AlertTriangle }
    : { ring: 'border-rose-500/35', chip: 'bg-rose-500/12 text-rose-600 dark:text-rose-400 border-rose-500/30', accent: 'text-rose-600 dark:text-rose-400', Icon: AlertTriangle };

  const Icon = tone.Icon;

  return (
    <div className={`bg-white dark:bg-[#12141A] border ${tone.ring} rounded-[16px] p-5 sm:p-6 shadow-apple dark:shadow-apple-dark`}>
      <div className="flex items-start gap-4">
        <span className={`hidden sm:flex flex-none w-10 h-10 rounded-xl items-center justify-center border ${tone.chip}`}>
          <Icon className="w-5 h-5" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              What&rsquo;s happening
            </span>
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${tone.chip}`}>
              {status}
            </span>
          </div>

          {/* the one sentence someone should walk away with */}
          <h2 className={`text-xl sm:text-2xl font-semibold tracking-tight mb-2 ${tone.accent}`}>
            {n.statusLine}
          </h2>

          {/* what is going on, in human terms */}
          <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed max-w-3xl">
            {n.headline}
          </p>

          {/* the evidence, plainly */}
          {n.reasons.length > 0 && (
            <ul className="mt-3 space-y-1">
              {n.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
                  <span className={`mt-[7px] w-1.5 h-1.5 rounded-full flex-none ${safe ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {r}
                </li>
              ))}
            </ul>
          )}

          {n.reassurance && (
            <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400 italic">{n.reassurance}</p>
          )}

          {/* what next + what to do */}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl bg-neutral-50 dark:bg-[#161922] border border-neutral-100 dark:border-neutral-800/80 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
                <Clock className="w-3 h-3" /> What happens next
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">{n.prediction}</p>
            </div>

            <div className="rounded-xl bg-neutral-50 dark:bg-[#161922] border border-neutral-100 dark:border-neutral-800/80 p-3">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
                <ArrowRight className="w-3 h-3" /> What we should do
              </div>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-snug">
                <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                  {plainActionTitle(state.derivation!.decision.bestAction)}.
                </span>{' '}
                {n.recommendation}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
