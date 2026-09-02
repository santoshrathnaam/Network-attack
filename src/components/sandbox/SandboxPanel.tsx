import React from 'react';
import { Card } from '../common/Card';
import { BASELINES } from '../../services/engine';
import { SlidersHorizontal, Power, RotateCcw } from 'lucide-react';

export interface SandboxInputs {
  synRatio: number;
  pps: number;
  uniqueSources: number;
  failedConns: number;
  portEntropy: number;
}

export const SANDBOX_DEFAULTS: SandboxInputs = {
  synRatio: BASELINES.syn.mean,
  pps: BASELINES.pps.mean,
  uniqueSources: BASELINES.source.mean,
  failedConns: BASELINES.conn.mean,
  portEntropy: 1.3,
};

export const SANDBOX_PRESETS: Record<string, SandboxInputs> = {
  'Quiet': { synRatio: 0.13, pps: 220, uniqueSources: 44, failedConns: 5, portEntropy: 1.3 },
  'Port scan': { synRatio: 0.28, pps: 400, uniqueSources: 170, failedConns: 24, portEntropy: 4.6 },
  'SYN flood': { synRatio: 0.90, pps: 1450, uniqueSources: 110, failedConns: 42, portEntropy: 1.1 },
  'Brute force': { synRatio: 0.34, pps: 270, uniqueSources: 22, failedConns: 140, portEntropy: 1.5 },
};

interface Field {
  key: keyof SandboxInputs;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  baseline?: number;
  decimals?: number;
}

const FIELDS: Field[] = [
  { key: 'synRatio', label: 'Half-finished connections', unit: 'share', min: 0, max: 1, step: 0.01, baseline: BASELINES.syn.mean, decimals: 2 },
  { key: 'pps', label: 'Requests arriving', unit: 'per second', min: 40, max: 2000, step: 10, baseline: BASELINES.pps.mean },
  { key: 'uniqueSources', label: 'Machines connecting', unit: 'count', min: 3, max: 320, step: 1, baseline: BASELINES.source.mean },
  { key: 'failedConns', label: 'Failed attempts', unit: 'count', min: 0, max: 200, step: 1, baseline: BASELINES.conn.mean },
  { key: 'portEntropy', label: 'How scattered the targets are', unit: 'spread', min: 0, max: 6, step: 0.1, decimals: 1 },
];

interface SandboxPanelProps {
  enabled: boolean;
  inputs: SandboxInputs;
  onToggle: (on: boolean) => void;
  onChange: (next: SandboxInputs) => void;
  streaming: boolean;
}

/**
 * Live input bench. These dials are the only thing the operator sets — the
 * anomaly scores, threat score, forecast and recommendation are all derived
 * from them by the same engine that drives the scripted stages. Drag one and
 * every panel on the page recomputes in real time.
 */
export const SandboxPanel: React.FC<SandboxPanelProps> = ({ enabled, inputs, onToggle, onChange, streaming }) => {
  const set = (k: keyof SandboxInputs, v: number) => onChange({ ...inputs, [k]: v });

  return (
    <Card
      title="Live Sandbox"
      subtitle="Set the network by hand and watch every number above recalculate"
      badge={
        enabled ? (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full bg-emerald-500 ${streaming ? 'animate-pulse' : ''}`} />
            live · engine running
          </span>
        ) : (
          <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border border-neutral-200 dark:border-neutral-700">
            off · showing demo timeline
          </span>
        )
      }
      action={
        <div className="flex items-center gap-2">
          {enabled && (
            <button
              onClick={() => onChange({ ...SANDBOX_DEFAULTS })}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Baseline
            </button>
          )}
          <button
            onClick={() => onToggle(!enabled)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              enabled
                ? 'bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600'
                : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-emerald-500 hover:text-emerald-600'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {enabled ? 'Sandbox on' : 'Enable sandbox'}
          </button>
        </div>
      }
    >
      {!enabled ? (
        <div className="flex items-start gap-3 text-xs text-neutral-500 dark:text-neutral-400 py-1">
          <SlidersHorizontal className="w-4 h-4 mt-0.5 flex-none text-neutral-400" />
          <p className="max-w-2xl">
            Turn this on to take manual control of the network telemetry. The threat score, attack
            forecast and recommended response are not stored anywhere — they are computed from these
            five numbers, so moving any dial moves every panel on the page.
          </p>
        </div>
      ) : (
        <>
          {/* presets */}
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries(SANDBOX_PRESETS).map(([name, vals]) => (
              <button
                key={name}
                onClick={() => onChange({ ...vals })}
                className="text-xs font-medium px-2.5 py-1 rounded-lg bg-neutral-50 dark:bg-[#161922] border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-emerald-500/60 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
              >
                {name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-3">
            {FIELDS.map((f) => {
              const v = inputs[f.key];
              const pct = ((v - f.min) / (f.max - f.min)) * 100;
              const off = f.baseline !== undefined && Math.abs(v - f.baseline) > f.baseline * 0.35;
              return (
                <div key={f.key}>
                  <div className="flex items-baseline justify-between mb-1">
                    <label htmlFor={`sb-${f.key}`} className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {f.label} <span className="text-neutral-400 dark:text-neutral-500 font-normal">{f.unit}</span>
                    </label>
                    <span className={`text-xs font-mono font-semibold tabular-nums ${off ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {f.decimals ? v.toFixed(f.decimals) : Math.round(v)}
                    </span>
                  </div>
                  <input
                    id={`sb-${f.key}`}
                    type="range"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    value={v}
                    onChange={(e) => set(f.key, parseFloat(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-emerald-500 bg-neutral-200 dark:bg-neutral-800"
                    style={{ backgroundImage: `linear-gradient(to right, ${off ? '#f43f5e' : '#10b981'} ${pct}%, transparent ${pct}%)` }}
                  />
                  {f.baseline !== undefined && (
                    <div className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500 mt-0.5">
                      usually {f.decimals ? f.baseline.toFixed(f.decimals) : Math.round(f.baseline)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
};
