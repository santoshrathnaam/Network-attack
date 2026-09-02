import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BASELINES, readChannels, anomaliesFrom, scoreTerms, threatScore,
  statusFor, stageFor, classify, counterfactual, traceOf, type RawWindow,
} from '../../services/engine';
import { generateScenario } from '../../mock/trafficModel';
import { ChevronDown, Play, Pause, RotateCcw, ArrowRight } from 'lucide-react';

/**
 * The explainer. One idea per screen, big type, no jargon — built so someone
 * who knows nothing about networks can follow the whole argument by scrolling.
 * Every number is still computed by the real engine.
 */

// ---------------------------------------------------------------- primitives

const Section: React.FC<{
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  lead?: string;
}> = ({ eyebrow, title, lead, children }) => (
  <section className="py-16 sm:py-24 border-b border-neutral-200/70 dark:border-neutral-800/70">
    <div className="max-w-3xl mx-auto px-5">
      {eyebrow && (
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 mb-3">
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl sm:text-[2.6rem] leading-[1.1] font-extrabold tracking-tight text-neutral-900 dark:text-white mb-4">
        {title}
      </h2>
      {lead && (
        <p className="text-lg sm:text-xl leading-relaxed text-neutral-600 dark:text-neutral-300 mb-8">{lead}</p>
      )}
      {children}
    </div>
  </section>
);

/** A single measurement shown against its normal range. Big and obvious. */
const Gauge: React.FC<{
  name: string;
  value: number;
  mean: number;
  std: number;
  format?: (v: number) => string;
}> = ({ name, value, mean, std, format = (v) => Math.round(v).toString() }) => {
  const lo = Math.min(value, mean - 3 * std);
  const hi = Math.max(value, mean + 7 * std);
  const pos = (v: number) => ((v - lo) / Math.max(hi - lo, 1e-6)) * 100;
  const bandL = pos(mean - 2 * std);
  const bandR = pos(mean + 2 * std);
  const marker = Math.max(1, Math.min(99, pos(value)));
  const ratio = mean > 0 ? value / mean : 1;
  const outside = value > mean + 2 * std || value < mean - 2 * std;

  return (
    <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A] p-5">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-base font-semibold text-neutral-800 dark:text-neutral-100">{name}</span>
        <span className={`text-2xl font-extrabold tabular-nums ${outside ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {format(value)}
        </span>
      </div>

      <div className="relative h-9">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-neutral-150 dark:bg-neutral-800" style={{ background: undefined }} />
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-neutral-200 dark:bg-neutral-800" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-7 rounded-lg bg-emerald-500/20 border-2 border-emerald-500/50"
          style={{ left: `${bandL}%`, width: `${Math.max(2, bandR - bandL)}%` }}
        />
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-[3px] border-white dark:border-[#12141A] shadow-md transition-all duration-300 ${outside ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{ left: `${marker}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-neutral-400 dark:text-neutral-500">
          usually around {format(mean)}
        </span>
        <span className={`font-semibold ${outside ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {outside ? `${ratio >= 10 ? Math.round(ratio) : ratio.toFixed(1)}× normal` : 'normal'}
        </span>
      </div>
    </div>
  );
};

const Slider: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  display: string;
  hot: boolean;
}> = ({ label, value, min, max, step, onChange, display, hot }) => {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{label}</label>
        <span className={`text-base font-extrabold tabular-nums ${hot ? 'text-rose-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2.5 rounded-full appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-800"
        style={{ backgroundImage: `linear-gradient(to right, ${hot ? '#f43f5e' : '#10b981'} ${pct}%, transparent ${pct}%)` }}
      />
    </div>
  );
};

// ---------------------------------------------------------------- main view

interface ExplainViewProps {
  onOpenDashboard: () => void;
}

export const ExplainView: React.FC<ExplainViewProps> = ({ onOpenDashboard }) => {
  // Shared explore state for the interactive sections.
  const [ex, setEx] = useState({
    pps: BASELINES.pps.mean,
    synRatio: BASELINES.syn.mean,
    uniqueSources: BASELINES.source.mean,
    failedConns: BASELINES.conn.mean,
  });

  const exWindow: RawWindow = {
    ...ex, portEntropy: 1.3, acceleration: 0, momentum: 0,
  };
  const exChannels = readChannels(exWindow, {});
  const exAnom = anomaliesFrom(exChannels);
  const exTerms = scoreTerms(exAnom, 0);
  const exScore = threatScore(exTerms);
  const exStatus = statusFor(exScore);

  const quiet = { pps: BASELINES.pps.mean, syn: BASELINES.syn.mean, src: BASELINES.source.mean, fail: BASELINES.conn.mean };

  return (
    <div className="bg-[#FBFBFD] dark:bg-[#0B0D12] text-neutral-900 dark:text-neutral-100">
      {/* ------------------------------------------------ hero */}
      <div className="min-h-[78vh] flex flex-col items-center justify-center text-center px-5 py-20">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-5">
          Predictive Cyber Defense · SIH26153
        </div>
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.05] max-w-3xl text-balance">
          Can a computer see an attack coming{' '}
          <span className="text-emerald-600 dark:text-emerald-400">before it happens?</span>
        </h1>
        <p className="mt-6 text-lg sm:text-xl text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
          Scroll down. It takes two minutes, and you don&rsquo;t need to know anything
          about networks or security.
        </p>
        <ChevronDown className="w-7 h-7 mt-12 text-neutral-400 animate-bounce" />
      </div>

      {/* ------------------------------------------------ 1. what we watch */}
      <Section
        eyebrow="Step 1"
        title="A network is just four numbers we keep an eye on."
        lead="Forget the jargon. To spot trouble, we only need to watch four simple things — and know what each one usually looks like."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Gauge name="Traffic" value={quiet.pps} mean={BASELINES.pps.mean} std={BASELINES.pps.std} />
          <Gauge name="Half-finished connections" value={quiet.syn} mean={BASELINES.syn.mean} std={BASELINES.syn.std} format={(v) => v.toFixed(2)} />
          <Gauge name="Machines connecting" value={quiet.src} mean={BASELINES.source.mean} std={BASELINES.source.std} />
          <Gauge name="Failed connections" value={quiet.fail} mean={BASELINES.conn.mean} std={BASELINES.conn.std} />
        </div>
        <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-300">
          Right now every dot sits inside its <span className="font-semibold text-emerald-600 dark:text-emerald-400">green zone</span> —
          the range this network normally lives in. <span className="font-semibold">That is what &ldquo;nothing is wrong&rdquo; looks like.</span>
        </p>
      </Section>

      {/* ------------------------------------------------ 2. unusual */}
      <Section
        eyebrow="Step 2"
        title="Trouble means a number leaves its green zone."
        lead="Drag the slider. Watch the dot leave the green zone, and watch how we turn 'that's weird' into a number between 0 and 1."
      >
        <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A] p-5 sm:p-6">
          <Slider
            label="Traffic right now"
            value={ex.pps}
            min={80}
            max={1800}
            step={10}
            onChange={(v) => setEx({ ...ex, pps: v })}
            display={`${Math.round(ex.pps)} /sec`}
            hot={exAnom.traffic > 0.01}
          />
          <div className="mt-6">
            <Gauge name="Traffic" value={ex.pps} mean={BASELINES.pps.mean} std={BASELINES.pps.std} />
          </div>

          <div className="mt-6 flex items-center gap-4 sm:gap-6 flex-wrap">
            <div className="flex-1 min-w-[190px]">
              <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-1.5">
                How unusual is that?
              </div>
              <div className="h-4 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-rose-500 transition-all duration-300"
                  style={{ width: `${Math.max(1.5, exAnom.traffic * 100)}%` }}
                />
              </div>
            </div>
            <div className="text-5xl font-extrabold tabular-nums text-neutral-900 dark:text-white">
              {exAnom.traffic.toFixed(2)}
            </div>
          </div>
          <p className="mt-3 text-neutral-500 dark:text-neutral-400">
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">0.00</span> means completely normal.{' '}
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">1.00</span> means as strange as it gets.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------ 3. one score */}
      <Section
        eyebrow="Step 3"
        title="Four &ldquo;how unusual&rdquo; numbers become one score."
        lead="Do that for all four, add them together — some matter more than others — and you get a single Threat Score. Move any slider and watch it react."
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">
          <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A] p-5 sm:p-6 space-y-5">
            <Slider label="Traffic" value={ex.pps} min={80} max={1800} step={10}
              onChange={(v) => setEx({ ...ex, pps: v })}
              display={`${Math.round(ex.pps)}/s`} hot={exAnom.traffic > 0.2} />
            <Slider label="Half-finished connections" value={ex.synRatio} min={0} max={1} step={0.01}
              onChange={(v) => setEx({ ...ex, synRatio: v })}
              display={`${Math.round(ex.synRatio * 100)}%`} hot={exAnom.syn > 0.2} />
            <Slider label="Machines connecting" value={ex.uniqueSources} min={5} max={300} step={1}
              onChange={(v) => setEx({ ...ex, uniqueSources: v })}
              display={`${Math.round(ex.uniqueSources)}`} hot={exAnom.source > 0.2} />
            <Slider label="Failed connections" value={ex.failedConns} min={0} max={180} step={1}
              onChange={(v) => setEx({ ...ex, failedConns: v })}
              display={`${Math.round(ex.failedConns)}`} hot={exAnom.connection > 0.2} />

            <button
              onClick={() => setEx({ pps: BASELINES.pps.mean, synRatio: BASELINES.syn.mean, uniqueSources: BASELINES.source.mean, failedConns: BASELINES.conn.mean })}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-500 hover:text-emerald-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Put everything back to normal
            </button>
          </div>

          <ScoreDial score={exScore} status={exStatus} />
        </div>

        <div className="mt-5 rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A] p-5">
          <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-3">
            Where the score comes from
          </div>
          <div className="space-y-2.5">
            {exTerms.filter((t) => t.key !== 'accel').map((t) => (
              <div key={t.key} className="flex items-center gap-3">
                <span className="w-44 sm:w-52 text-sm text-neutral-600 dark:text-neutral-300 truncate">
                  {({ syn: 'Half-finished connections', traffic: 'Traffic', source: 'Machines connecting', conn: 'Failed connections' } as Record<string, string>)[t.key]}
                </span>
                <div className="flex-1 h-3 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (t.contribution / 0.3) * 100)}%` }} />
                </div>
                <span className="w-14 text-right text-sm font-bold tabular-nums text-neutral-700 dark:text-neutral-200">
                  +{t.contribution.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t-2 border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">Add them up</span>
            <span className="text-2xl font-extrabold tabular-nums">{exScore.toFixed(2)}</span>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------ 4. watch an attack */}
      <AttackPlayer />

      {/* ------------------------------------------------ 5. what to do */}
      <ResponseSection />

      {/* ------------------------------------------------ outro */}
      <div className="py-20 px-5 text-center">
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-4">That&rsquo;s the whole idea.</h2>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-xl mx-auto mb-8 leading-relaxed">
          Learn what normal looks like, measure how far things drift from it, add it up,
          and act before the line goes off the chart.
        </p>
        <button
          onClick={onOpenDashboard}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold hover:opacity-90 transition-opacity"
        >
          See the full operator dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------- score dial

const ScoreDial: React.FC<{ score: number; status: string }> = ({ score, status }) => {
  const color =
    status === 'CRITICAL' ? '#f43f5e' : status === 'ELEVATED' ? '#f97316' : status === 'WATCH' ? '#f59e0b' : '#10b981';
  const word =
    status === 'CRITICAL' ? 'Under attack' : status === 'ELEVATED' ? 'Looks like an attack' : status === 'WATCH' ? "Something's off" : 'All calm';
  const C = 2 * Math.PI * 52;

  return (
    <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A] p-6 flex flex-col items-center lg:sticky lg:top-6">
      <div className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 mb-3">Threat Score</div>
      <div className="relative w-[150px] h-[150px]">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" className="stroke-neutral-200 dark:stroke-neutral-800" />
          <circle cx="60" cy="60" r="52" fill="none" strokeWidth="12" stroke={color} strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - score)}
            style={{ transition: 'stroke-dashoffset .4s ease, stroke .3s ease' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl font-extrabold tabular-nums" style={{ color }}>
            {Math.round(score * 100)}%
          </span>
        </div>
      </div>
      <div className="mt-3 text-lg font-bold" style={{ color }}>{word}</div>
    </div>
  );
};

// ---------------------------------------------------------------- attack player

const AttackPlayer: React.FC = () => {
  const scenario = useMemo(() => generateScenario('SIMULATION'), []);
  const trace = useMemo(() => traceOf(scenario.windows), [scenario]);
  const n = trace.length;

  const [frame, setFrame] = useState(n - 1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = window.setInterval(() => {
      setFrame((f) => {
        if (f >= n - 1) { setPlaying(false); return f; }
        return f + 1;
      });
    }, 180);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [playing, n]);

  const start = () => { setFrame(0); setPlaying(true); };

  const p = trace[frame];
  const score = p.score;
  const stage = stageFor(score);
  const status = statusFor(score);

  const caption =
    score < 0.25 ? 'Quiet. Everything is sitting in its normal range.'
    : score < 0.45 ? 'Something changed. A couple of numbers just left their green zone.'
    : score < 0.70 ? 'This is not noise any more — the pattern looks like someone probing the network.'
    : score < 0.85 ? 'An attack is forming. Traffic and half-finished connections are way past normal.'
    : 'Full attack. The server is being flooded.';

  // chart geometry
  const W = 640, H = 240, padL = 44, padR = 16, padT = 16, padB = 30;
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - Math.min(1, v)) * (H - padT - padB);
  const visible = trace.slice(0, frame + 1);
  const line = visible.map((q, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(q.score).toFixed(1)}`).join(' ');
  const area = visible.length > 1
    ? `${line} L ${x(frame).toFixed(1)} ${y(0)} L ${x(0).toFixed(1)} ${y(0)} Z` : '';
  const color = status === 'CRITICAL' ? '#f43f5e' : status === 'ELEVATED' ? '#f97316' : status === 'WATCH' ? '#f59e0b' : '#10b981';

  return (
    <Section
      eyebrow="Step 4"
      title="Now watch a real attack happen."
      lead="This is five minutes of network activity, sped up. Press play and watch the score climb as the attack builds."
    >
      <div className="rounded-2xl border-2 border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A] p-5 sm:p-6">
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={playing ? () => setPlaying(false) : start}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold hover:opacity-90 transition-opacity"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? 'Pause' : frame >= n - 1 ? 'Play again' : 'Play'}
          </button>
          <div className="text-4xl font-extrabold tabular-nums ml-auto" style={{ color }}>
            {Math.round(score * 100)}%
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* stage bands */}
          {[
            { from: 0, to: 0.25, label: 'calm', fill: 'rgba(16,185,129,0.07)' },
            { from: 0.25, to: 0.45, label: 'odd', fill: 'rgba(245,158,11,0.07)' },
            { from: 0.45, to: 0.70, label: 'probing', fill: 'rgba(249,115,22,0.07)' },
            { from: 0.70, to: 1.0, label: 'attack', fill: 'rgba(244,63,94,0.08)' },
          ].map((b) => (
            <g key={b.label}>
              <rect x={padL} y={y(b.to)} width={W - padL - padR} height={Math.abs(y(b.from) - y(b.to))} fill={b.fill} />
              <text x={W - padR - 6} y={y(b.to) + 13} textAnchor="end"
                className="fill-neutral-400 dark:fill-neutral-500" fontSize="10" fontWeight="600">
                {b.label}
              </text>
            </g>
          ))}
          {/* y labels */}
          {[0, 0.5, 1].map((v) => (
            <text key={v} x={padL - 8} y={y(v) + 4} textAnchor="end" className="fill-neutral-400" fontSize="11">
              {Math.round(v * 100)}%
            </text>
          ))}
          {area && <path d={area} fill={color} fillOpacity="0.14" />}
          {line && <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
          <circle cx={x(frame)} cy={y(score)} r="6" fill={color} stroke="white" strokeWidth="3" />
          <text x={padL} y={H - 8} className="fill-neutral-400" fontSize="11">start</text>
          <text x={W - padR} y={H - 8} textAnchor="end" className="fill-neutral-400" fontSize="11">5 min later</text>
        </svg>

        <div className="mt-4 rounded-xl bg-neutral-50 dark:bg-[#161922] border border-neutral-100 dark:border-neutral-800 p-4">
          <p className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">{caption}</p>
          <div className="mt-2.5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">
            <span>Traffic <b className="text-neutral-700 dark:text-neutral-200">{Math.round(p.raw.pps)}/s</b></span>
            <span>Half-finished <b className="text-neutral-700 dark:text-neutral-200">{Math.round(p.raw.synRatio * 100)}%</b></span>
            <span>Machines <b className="text-neutral-700 dark:text-neutral-200">{Math.round(p.raw.uniqueSources)}</b></span>
            <span>Failed <b className="text-neutral-700 dark:text-neutral-200">{Math.round(p.raw.failedConns)}</b></span>
          </div>
        </div>

        <input
          type="range" min={0} max={n - 1} step={1} value={frame}
          onChange={(e) => { setPlaying(false); setFrame(parseInt(e.target.value)); }}
          className="w-full mt-4 h-2 rounded-full appearance-none cursor-pointer bg-neutral-200 dark:bg-neutral-800"
          aria-label="Scrub through the attack"
        />
        <p className="mt-2 text-sm text-neutral-400">Drag to move through time yourself.</p>
      </div>
    </Section>
  );
};

// ---------------------------------------------------------------- response

const ResponseSection: React.FC = () => {
  const scenario = useMemo(() => generateScenario('SIMULATION'), []);
  const w = scenario.current;
  const channels = readChannels(w, {});
  const anom = anomaliesFrom(channels);
  const score = threatScore(scoreTerms(anom, w.acceleration));
  const forecast = classify(score, anom, w);
  const top = Object.entries(forecast).sort((a, b) => b[1] - a[1])[0];
  const cf = counterfactual(score, w.momentum, top[0].toUpperCase(), top[1]);

  const options = [
    { key: 'NO_ACTION', title: 'Do nothing', note: 'Nobody is inconvenienced. The attack keeps going.' },
    { key: 'BLOCK_SOURCES', title: 'Block the bad addresses', note: 'Quick, and users barely notice. Some attackers get through.' },
    { key: 'ISOLATE_SERVER', title: 'Take the server offline', note: 'Stops it dead, but the service goes down for everyone.' },
  ];

  return (
    <Section
      eyebrow="Step 5"
      title="So what do we actually do about it?"
      lead="The useful part isn't the alarm — it's answering 'what happens if I do X?'. We play each choice forward five minutes and compare the danger left over."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {options.map((o) => {
          const risk = cf.scenarios[o.key]['5m'];
          const best = cf.best === o.key;
          return (
            <div key={o.key}
              className={`rounded-2xl border-2 p-5 transition-colors ${best ? 'border-emerald-500 bg-emerald-500/[0.04]' : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#12141A]'}`}>
              {best && (
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                  Best option
                </div>
              )}
              <div className="text-lg font-bold mb-1">{o.title}</div>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 min-h-[40px]">{o.note}</p>
              <div className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                Danger in 5 minutes
              </div>
              <div className={`text-4xl font-extrabold tabular-nums ${risk > 0.6 ? 'text-rose-500' : risk > 0.3 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {Math.round(risk * 100)}%
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                <div className={`h-full rounded-full ${risk > 0.6 ? 'bg-rose-500' : risk > 0.3 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${Math.max(2, risk * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-lg text-neutral-600 dark:text-neutral-300">
        That is the whole point of the system: not just{' '}
        <span className="font-semibold">&ldquo;something is wrong&rdquo;</span>, but{' '}
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          &ldquo;do this one, and you avoid most of the damage.&rdquo;
        </span>
      </p>
    </Section>
  );
};
