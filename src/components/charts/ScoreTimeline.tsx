import React, { useRef, useState } from 'react';
import type { DerivationData } from '../../types/cyberDefense';

interface ScoreTimelineProps {
  derivation?: DerivationData;
}

const BANDS = [
  { from: 0.00, to: 0.25, label: 'calm', fill: 'rgba(16,185,129,0.08)' },
  { from: 0.25, to: 0.45, label: 'odd', fill: 'rgba(245,158,11,0.08)' },
  { from: 0.45, to: 0.70, label: 'probing', fill: 'rgba(249,115,22,0.08)' },
  { from: 0.70, to: 1.00, label: 'attack', fill: 'rgba(244,63,94,0.09)' },
];

/**
 * The threat score over the last few minutes.
 *
 * Hover is handled by ONE mousemove listener on the svg rather than a hit-target
 * per point. Per-point onMouseEnter rects re-render underneath the cursor on
 * every state change, which re-fires enter/leave in a loop and makes the chart
 * flicker; sampling the pointer position once per move cannot do that.
 */
export const ScoreTimeline: React.FC<ScoreTimelineProps> = ({ derivation }) => {
  const trace = derivation?.trace ?? [];
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  if (trace.length < 2) return null;
  const n = trace.length;

  const W = 720, H = 260, padL = 44, padR = 58, padT = 16, padB = 28;
  const x = (i: number) => padL + (i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - Math.min(1, Math.max(0, v))) * (H - padT - padB);

  const active = hover ?? n - 1;
  const p = trace[active];
  const score = p.score;
  const color = score >= 0.75 ? '#f43f5e' : score >= 0.5 ? '#f97316' : score >= 0.25 ? '#f59e0b' : '#10b981';

  const line = trace.map((q, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(q.score).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(n - 1).toFixed(1)} ${y(0)} L ${x(0).toFixed(1)} ${y(0)} Z`;

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0) return;
    const vx = ((e.clientX - r.left) / r.width) * W;   // client px → viewBox units
    const i = Math.round(((vx - padL) / (W - padL - padR)) * (n - 1));
    const clamped = Math.max(0, Math.min(n - 1, i));
    setHover((prev) => (prev === clamped ? prev : clamped)); // no-op updates don't re-render
  };

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-sm text-neutral-500 dark:text-neutral-400">
          {hover === null ? 'Right now' : `${(n - 1 - active) * 15} seconds ago`}
        </span>
        <span className="text-3xl font-extrabold tabular-nums" style={{ color }}>
          {Math.round(score * 100)}%
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto cursor-crosshair"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        {BANDS.map((b) => (
          <g key={b.label}>
            <rect x={padL} y={y(b.to)} width={W - padL - padR} height={Math.abs(y(b.from) - y(b.to))} fill={b.fill} />
            <text x={W - padR + 6} y={y(b.to) + 13} fontSize="10" fontWeight="600" className="fill-neutral-400 dark:fill-neutral-500">
              {b.label}
            </text>
          </g>
        ))}

        {[0, 0.5, 1].map((v) => (
          <text key={v} x={padL - 8} y={y(v) + 4} textAnchor="end" fontSize="11" className="fill-neutral-400">
            {Math.round(v * 100)}%
          </text>
        ))}

        <path d={area} fill={color} fillOpacity="0.13" />
        <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />

        <line x1={x(active)} x2={x(active)} y1={padT} y2={H - padB}
          className="stroke-neutral-400/60" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx={x(active)} cy={y(score)} r="6" fill={color} className="stroke-white dark:stroke-[#12141A]" strokeWidth="3" />

        <text x={padL} y={H - 6} fontSize="11" className="fill-neutral-400">
          {Math.round(((n - 1) * 15) / 60)} min ago
        </text>
        <text x={W - padR} y={H - 6} textAnchor="end" fontSize="11" className="fill-neutral-400">now</text>
      </svg>

      {/* readings for the highlighted moment — always visible, never overlaps */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Traffic', value: `${Math.round(p.raw.pps)}/s` },
          { label: 'Half-finished', value: `${Math.round(p.raw.synRatio * 100)}%` },
          { label: 'Machines', value: `${Math.round(p.raw.uniqueSources)}` },
          { label: 'Failed', value: `${Math.round(p.raw.failedConns)}` },
        ].map((r) => (
          <div key={r.label} className="rounded-xl bg-neutral-50 dark:bg-[#161922] border border-neutral-100 dark:border-neutral-800 px-3 py-2">
            <div className="text-[11px] text-neutral-400 dark:text-neutral-500">{r.label}</div>
            <div className="text-lg font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{r.value}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-neutral-400">Move your mouse across the chart to read any moment.</p>
    </div>
  );
};
