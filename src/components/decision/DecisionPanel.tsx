import React from 'react';
import type { DerivationData } from '../../types/cyberDefense';
import { CONFIG, resetConfig } from '../../services/engine';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';

interface DecisionPanelProps {
  derivation?: DerivationData;
  /** Called after any assumption changes so the page re-derives. */
  onChange: () => void;
}

const TITLE: Record<string, string> = {
  NO_ACTION: 'Do nothing',
  BLOCK_SOURCES: 'Block the bad addresses',
  ISOLATE_SERVER: 'Take the server offline',
};

const pc = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Why the system picked what it picked — and the levers behind it.
 *
 * The top half shows the arithmetic for every option so the choice is not a
 * verdict but a visible comparison. The bottom half exposes the assumptions
 * that arithmetic rests on, editable, so anyone can disagree with them and see
 * immediately whether the recommendation actually depends on that assumption.
 */
export const DecisionPanel: React.FC<DecisionPanelProps> = ({ derivation, onChange }) => {
  if (!derivation) return null;
  const { options, bestAction, horizon } = derivation.decision;
  const mins = horizon === '2m' ? 2 : horizon === '10m' ? 10 : 5;

  const setWeight = (k: keyof typeof CONFIG.weights, v: number) => {
    CONFIG.weights[k] = v;
    onChange();
  };
  const setAction = (a: string, field: 'base' | 'rate', v: number) => {
    CONFIG.actions[a][field] = v;
    onChange();
  };

  return (
    <div className="space-y-4">
      {/* ---------------- why this decision ---------------- */}
      <div className="bg-white dark:bg-[#12141A] border border-[#E5E5EA] dark:border-[#222733] rounded-[16px] p-5">
        <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50 mb-1">
          Why this one wins
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Each option is played forward {mins} minutes. We start from where we are, add how much
          worse it gets on its own, then subtract what the action takes off. Lowest result wins.
        </p>

        <div className="space-y-3">
          {options.map((o) => {
            const best = o.action === bestAction;
            return (
              <div
                key={o.action}
                className={`rounded-xl border-2 p-3.5 ${
                  best ? 'border-emerald-500 bg-emerald-500/[0.05]' : 'border-neutral-200 dark:border-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2 gap-3">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100">
                    {TITLE[o.action] ?? o.action}
                  </span>
                  {best && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                      chosen
                    </span>
                  )}
                </div>

                {/* the arithmetic, in words and numbers */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <Piece label="where we are" value={pc(o.start)} tone="neutral" />
                  <Op>+</Op>
                  <Piece label="it gets worse" value={pc(o.growth)} tone="bad" />
                  <Op>−</Op>
                  <Piece label="this action stops" value={pc(o.defense)} tone="good" />
                  <Op>=</Op>
                  <span
                    className={`text-xl font-extrabold tabular-nums ${
                      o.risk > 0.6 ? 'text-rose-500' : o.risk > 0.3 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {pc(o.risk)}
                  </span>
                </div>

                <div className="mt-2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${o.risk > 0.6 ? 'bg-rose-500' : o.risk > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.max(2, o.risk * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------- the assumptions ---------------- */}
      <div className="bg-white dark:bg-[#12141A] border border-[#E5E5EA] dark:border-[#222733] rounded-[16px] p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-50 flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-neutral-400" />
            Disagree with it? Change the assumptions.
          </h3>
          <button
            onClick={() => { resetConfig(); onChange(); }}
            className="flex-none flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-emerald-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-5">
          These numbers are the system&rsquo;s opinions, not facts. Move them and watch whether the
          recommendation actually changes — if it doesn&rsquo;t, the choice was robust.
        </p>

        {/* how far ahead */}
        <div className="mb-6">
          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            How far ahead do we judge?
          </div>
          <div className="flex gap-2">
            {(['2m', '5m', '10m'] as const).map((h) => (
              <button
                key={h}
                onClick={() => { CONFIG.horizon = h; onChange(); }}
                className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  CONFIG.horizon === h
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-500 hover:border-neutral-300'
                }`}
              >
                {h === '2m' ? '2 minutes' : h === '5m' ? '5 minutes' : '10 minutes'}
              </button>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-1.5">
            Look far enough ahead and every defence looks perfect — that is why the default is 5 minutes.
          </p>
        </div>

        {/* how much each signal counts */}
        <div className="mb-6">
          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            How much does each signal count?
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            These add up to the threat score. Raise one and that signal drives the alarm more.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
            {([
              ['syn', 'Half-finished connections'],
              ['traffic', 'Traffic volume'],
              ['source', 'Machines connecting'],
              ['conn', 'Failed connections'],
            ] as const).map(([k, label]) => (
              <Lever
                key={k}
                label={label}
                value={CONFIG.weights[k]}
                min={0}
                max={0.6}
                step={0.01}
                display={CONFIG.weights[k].toFixed(2)}
                onChange={(v) => setWeight(k, v)}
              />
            ))}
          </div>
        </div>

        {/* how strong each defence is */}
        <div>
          <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
            How well does each response actually work?
          </div>
          <p className="text-xs text-neutral-400 mb-3">
            &ldquo;Immediately&rdquo; is what it stops the moment you do it. &ldquo;Per minute&rdquo; is
            how much more it keeps stopping while it runs.
          </p>
          <div className="space-y-4">
            {['BLOCK_SOURCES', 'ISOLATE_SERVER'].map((a) => (
              <div key={a} className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-3.5">
                <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 mb-3">
                  {TITLE[a]}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <Lever
                    label="Stops immediately"
                    value={CONFIG.actions[a].base}
                    min={0} max={0.6} step={0.01}
                    display={pc(CONFIG.actions[a].base)}
                    onChange={(v) => setAction(a, 'base', v)}
                  />
                  <Lever
                    label="Stops per minute"
                    value={CONFIG.actions[a].rate}
                    min={0} max={0.2} step={0.005}
                    display={pc(CONFIG.actions[a].rate)}
                    onChange={(v) => setAction(a, 'rate', v)}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const Op: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="text-neutral-400 font-bold">{children}</span>
);

const Piece: React.FC<{ label: string; value: string; tone: 'neutral' | 'good' | 'bad' }> = ({ label, value, tone }) => (
  <span className="inline-flex flex-col leading-tight">
    <span
      className={`font-bold tabular-nums ${
        tone === 'bad' ? 'text-rose-500' : tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' : 'text-neutral-700 dark:text-neutral-200'
      }`}
    >
      {value}
    </span>
    <span className="text-[10px] text-neutral-400">{label}</span>
  </span>
);

const Lever: React.FC<{
  label: string; value: number; min: number; max: number; step: number; display: string;
  onChange: (v: number) => void;
}> = ({ label, value, min, max, step, display, onChange }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-neutral-600 dark:text-neutral-300">{label}</span>
        <span className="text-sm font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{display}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-full appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-800"
        style={{ backgroundImage: `linear-gradient(to right, #10b981 ${pct}%, transparent ${pct}%)` }}
      />
    </div>
  );
};
