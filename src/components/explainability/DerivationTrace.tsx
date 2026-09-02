import React, { useMemo, useState } from 'react';
import type { DerivationData, DerivationPoint, ChannelReading } from '../../types/cyberDefense';
import { Card } from '../common/Card';
import { TrendingUp } from 'lucide-react';

interface DerivationTraceProps {
  derivation?: DerivationData;
}

// One colour per weighted term, shared with the decomposition panel.
const BANDS = [
  { key: 'syn', label: 'Half-finished connections', color: '#f43f5e' },
  { key: 'traffic', label: 'Traffic volume', color: '#f97316' },
  { key: 'source', label: 'Machines connecting', color: '#f59e0b' },
  { key: 'conn', label: 'Failed connections', color: '#0ea5e9' },
  { key: 'accel', label: 'Rising quickly', color: '#8b5cf6' },
] as const;

const STAGE_LINES = [
  { y: 0.25, label: 'ANOMALY' },
  { y: 0.45, label: 'SCANNING' },
  { y: 0.70, label: 'IMMINENT' },
  { y: 0.85, label: 'DDoS' },
];

/**
 * The "how did it get here" view. The threat score is drawn as a stacked area
 * over every measured window: each band is one weighted signal, the top edge is
 * the score. You watch the bands grow out of the traffic below and stack up to
 * the number — so the number is visibly the sum of measured parts over time,
 * not a figure that appears from nowhere.
 */
export const DerivationTrace: React.FC<DerivationTraceProps> = ({ derivation }) => {
  const trace = derivation?.trace ?? [];
  const channels = derivation?.channels ?? [];
  const [hover, setHover] = useState<number | null>(null);

  const W = 800, H = 300;
  const pad = { top: 18, right: 92, bottom: 24, left: 34 };
  const iW = W - pad.left - pad.right;
  const iH = H - pad.top - pad.bottom;

  const geo = useMemo(() => {
    const n = trace.length;
    if (n === 0) return null;
    const x = (i: number) => pad.left + (i / Math.max(1, n - 1)) * iW;
    const y = (v: number) => pad.top + iH - Math.min(1, v) * iH;

    // cumulative stack per window
    const stacks = trace.map((p) => {
      const c = p.contributions;
      const order = [c.syn, c.traffic, c.source, c.conn, c.accel];
      const cum: number[] = [0];
      order.forEach((v) => cum.push(cum[cum.length - 1] + v));
      return cum; // length 6: boundaries between the 5 bands
    });

    const areas = BANDS.map((_, k) => {
      const top = trace.map((_, i) => `${x(i).toFixed(1)},${y(stacks[i][k + 1]).toFixed(1)}`);
      const bot = trace.map((_, i) => `${x(i).toFixed(1)},${y(stacks[i][k]).toFixed(1)}`).reverse();
      return `M ${top.join(' L ')} L ${bot.join(' L ')} Z`;
    });

    const scoreLine = trace.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
    return { n, x, y, areas, scoreLine, stacks };
  }, [trace]);

  if (!geo) return null;
  const active = hover ?? geo.n - 1;
  const point = trace[active];

  return (
    <Card
      title="How the score built up"
      subtitle="The score over the last few minutes. Each colour is one signal adding to it — hover any point to see the readings behind it."
      badge={
        <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
          last {geo.n} readings
        </span>
      }
    >
      {/* ---- raw signal sparklines: the measured inputs ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
        {channels.map((c) => (
          <Sparkline key={c.key} c={c} activeIndex={active} n={geo.n} />
        ))}
      </div>

      {/* ---- stacked-area derivation chart ---- */}
      <div className="relative w-full overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto select-none" onMouseLeave={() => setHover(null)}>
          {/* y grid + stage thresholds */}
          {[0, 0.25, 0.5, 0.75, 1].map((v) => (
            <line key={v} x1={pad.left} x2={W - pad.right} y1={geo.y(v)} y2={geo.y(v)}
              className="stroke-neutral-100 dark:stroke-neutral-800" strokeWidth="1" />
          ))}
          {STAGE_LINES.map((s) => (
            <g key={s.label}>
              <line x1={pad.left} x2={W - pad.right} y1={geo.y(s.y)} y2={geo.y(s.y)}
                className="stroke-neutral-300 dark:stroke-neutral-700" strokeWidth="1" strokeDasharray="3 4" />
              <text x={W - pad.right + 6} y={geo.y(s.y) + 3} className="text-[9px] fill-neutral-400 dark:fill-neutral-500 font-mono">
                {s.y.toFixed(2)} {s.label}
              </text>
            </g>
          ))}

          {/* stacked contribution bands */}
          {geo.areas.map((d, k) => (
            <path key={BANDS[k].key} d={d} fill={BANDS[k].color} fillOpacity="0.82" stroke={BANDS[k].color} strokeWidth="0.5" />
          ))}

          {/* score line on top */}
          <path d={geo.scoreLine} fill="none" className="stroke-neutral-900 dark:stroke-white" strokeWidth="2" strokeLinejoin="round" />

          {/* active window guide */}
          <line x1={geo.x(active)} x2={geo.x(active)} y1={pad.top} y2={pad.top + iH}
            className="stroke-neutral-500 dark:stroke-neutral-400" strokeWidth="1" strokeDasharray="2 2" />
          <circle cx={geo.x(active)} cy={geo.y(point.score)} r="4"
            className="fill-neutral-900 dark:fill-white stroke-white dark:stroke-[#12141A]" strokeWidth="2" />

          {/* hover hit-areas */}
          {trace.map((_, i) => (
            <rect key={i} x={geo.x(i) - iW / geo.n / 2} y={pad.top} width={iW / geo.n} height={iH}
              fill="transparent" onMouseEnter={() => setHover(i)} className="cursor-crosshair" />
          ))}

          {/* axis labels */}
          <text x={pad.left} y={H - 8} className="text-[9px] fill-neutral-400 font-mono">−{(geo.n - 1) * 15}s</text>
          <text x={W - pad.right} y={H - 8} textAnchor="end" className="text-[9px] fill-neutral-400 font-mono">now</text>
        </svg>

        {/* tooltip: this window's raw measurements → score */}
        <div className="absolute top-1 left-9 bg-neutral-900/92 dark:bg-black/85 text-white rounded-lg px-3 py-2 text-[11px] shadow-lg backdrop-blur-sm pointer-events-none border border-neutral-700 min-w-[188px]">
          <div className="font-mono text-neutral-400 mb-1">
            window {active === geo.n - 1 ? 'now' : `−${(geo.n - 1 - active) * 15}s`}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-neutral-300 mb-1.5">
            <span>SYN {point.raw.synRatio.toFixed(2)}</span>
            <span>{Math.round(point.raw.pps)} pkt/s</span>
            <span>{Math.round(point.raw.uniqueSources)} src</span>
            <span>{Math.round(point.raw.failedConns)} fail</span>
          </div>
          <div className="border-t border-neutral-700 pt-1 flex items-center justify-between">
            <span className="text-neutral-400">threat score</span>
            <span className="font-mono font-semibold tabular-nums text-white">{point.score.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* legend */}
      <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/60 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {BANDS.map((b) => (
          <span key={b.key} className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: b.color }} />
            {b.label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400">
          <span className="w-3.5 h-[2px] bg-neutral-900 dark:bg-white" /> total threat score
        </span>
        <span className="ml-auto flex items-center gap-1 text-[11px] text-neutral-400 font-mono">
          <TrendingUp className="w-3 h-3" /> hover to inspect any moment
        </span>
      </div>
    </Card>
  );
};

// small raw-signal chart with its baseline band
const Sparkline: React.FC<{ c: ChannelReading; activeIndex: number; n: number }> = ({ c, activeIndex, n }) => {
  const w = 170, h = 46, pt = 4, pb = 4;
  const s = c.series.length ? c.series : [c.current];
  const lo = Math.min(...s, c.baselineMean - 2 * c.baselineStd);
  const hi = Math.max(...s, c.baselineMean + 2 * c.baselineStd);
  const span = Math.max(hi - lo, 1e-6);
  const x = (i: number) => (i / Math.max(1, s.length - 1)) * w;
  const y = (v: number) => pt + (h - pt - pb) * (1 - (v - lo) / span);
  const line = s.map((v, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const bandTop = y(c.baselineMean + 2 * c.baselineStd);
  const bandBot = y(c.baselineMean - 2 * c.baselineStd);
  const ai = Math.min(activeIndex, s.length - 1);
  const hot = Math.abs(c.z) > 2;
  const fmt = (v: number) => (c.key === 'syn' ? v.toFixed(2) : Math.round(v).toString());

  return (
    <div className="rounded-lg bg-neutral-50 dark:bg-[#161922] border border-neutral-100 dark:border-neutral-800/80 px-2 py-1.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[10px] font-medium text-neutral-600 dark:text-neutral-400">{c.label}</span>
        <span className={`text-[10px] font-mono font-semibold tabular-nums ${hot ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {fmt(c.current)}
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        <rect x="0" y={Math.min(bandTop, bandBot)} width={w} height={Math.abs(bandBot - bandTop)} className="fill-emerald-500/20" />
        <line x1="0" x2={w} y1={y(c.baselineMean)} y2={y(c.baselineMean)} className="stroke-emerald-500/50" strokeWidth="1" strokeDasharray="2 3" />
        <path d={line} fill="none" stroke={hot ? '#f43f5e' : '#10b981'} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={x(ai)} cy={y(s[ai])} r="2.5" fill={hot ? '#f43f5e' : '#10b981'} />
      </svg>
    </div>
  );
};
