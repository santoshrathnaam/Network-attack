import React from 'react';
import type { DerivationData } from '../../types/cyberDefense';
import { useReveal } from '../site/useReveal';

interface Props { derivation?: DerivationData; }

const PLAIN: Record<string, string> = {
  syn: 'Half-finished connections',
  traffic: 'Requests arriving',
  source: 'Machines connecting',
  connection: 'Failed attempts',
};
const TERM_PLAIN: Record<string, string> = {
  syn: 'Half-finished connections',
  traffic: 'Requests arriving',
  source: 'Machines connecting',
  conn: 'Failed attempts',
  accel: 'How fast it is rising',
};
const ACTION_PLAIN: Record<string, string> = {
  NO_ACTION: 'Do nothing',
  BLOCK_SOURCES: 'Block the bad addresses',
  ISOLATE_SERVER: 'Pull the server offline',
};

const fmt = (key: string, v: number) =>
  key === 'syn' ? v.toFixed(2) : Math.round(v).toLocaleString();

/** One numbered step in the chain. */
const Step: React.FC<{
  n: string; title: string; note: string; children: React.ReactNode; delay?: number;
}> = ({ n, title, note, children, delay = 0 }) => {
  const { ref, shown } = useReveal(0.12);
  return (
    <div
      ref={ref}
      className="grid grid-cols-1 sm:grid-cols-[80px_1fr] gap-x-6 gap-y-3 py-8 border-t-2 border-ink/10 first:border-t-0"
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity .8s ease ${delay}ms, transform .8s cubic-bezier(.16,1,.3,1) ${delay}ms`,
      }}
    >
      <div className="font-display font-extrabold text-4xl sm:text-5xl leading-none text-ink/15 tabular-nums">
        {n}
      </div>
      <div className="min-w-0">
        <h4 className="font-display font-extrabold text-xl sm:text-2xl leading-tight tracking-[-0.01em] mb-1">
          {title}
        </h4>
        <p className="text-inkSoft mb-5 max-w-xl leading-snug">{note}</p>
        {children}
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; children: React.ReactNode; accent?: boolean }> = ({
  label, children, accent,
}) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-ink/10 last:border-0">
    <span className={`text-sm sm:text-base ${accent ? 'font-semibold text-ink' : 'text-inkSoft'}`}>{label}</span>
    <span className="font-mono text-sm sm:text-base tabular-nums text-ink whitespace-nowrap">{children}</span>
  </div>
);

/**
 * The audit trail, end to end.
 *
 * Four measurements, four comparisons, one sum, one projection — every step
 * shown with the live figures in it. The point is not that a viewer checks the
 * arithmetic, but that they can see there IS arithmetic, and that it starts
 * from something measured rather than something chosen.
 */
export const DerivationChain: React.FC<Props> = ({ derivation }) => {
  if (!derivation) return null;
  const { channels, terms, score, decision, stage } = derivation;
  const stageWord = stage.replace('_', ' ').toLowerCase();

  return (
    <div className="rounded-3xl border-2 border-ink bg-paper px-6 sm:px-10 py-4">
      {/* 01 — measured */}
      <Step
        n="01"
        title="We measure four things"
        note="Straight off the wire, every few seconds. Nothing here is a judgement yet — these are just readings."
      >
        {channels.map((c) => (
          <Row key={c.key} label={PLAIN[c.key] ?? c.label} accent>
            {fmt(c.key, c.current)}
            <span className="text-inkSoft"> {c.key === 'traffic' ? '/sec' : c.key === 'syn' ? 'ratio' : ''}</span>
          </Row>
        ))}
      </Step>

      {/* 02 — compared */}
      <Step
        n="02"
        title="We compare each with its normal"
        note="Every network has its own rhythm. We learn what each measurement usually sits at, and how much it usually wanders."
        delay={60}
      >
        {channels.map((c) => (
          <Row key={c.key} label={PLAIN[c.key] ?? c.label}>
            {fmt(c.key, c.current)} <span className="text-inkSoft">vs usual</span> {fmt(c.key, c.baselineMean)}
            <span className="text-inkSoft"> ±{fmt(c.key, c.baselineStd)}</span>
          </Row>
        ))}
      </Step>

      {/* 03 — scored */}
      <Step
        n="03"
        title="That gap becomes a score from 0 to 1"
        note="How far past normal, divided by how much it normally wanders. We stop counting at six — so one wild reading can never run away with the answer."
        delay={120}
      >
        {channels.map((c) => {
          const steps = Math.abs(c.z);
          const capped = steps > 6;
          return (
            <Row key={c.key} label={PLAIN[c.key] ?? c.label}>
              <span className="text-inkSoft">
                ({fmt(c.key, c.current)} − {fmt(c.key, c.baselineMean)}) ÷ {fmt(c.key, c.baselineStd)} ={' '}
              </span>
              {steps.toFixed(1)}
              <span className="text-inkSoft">{capped ? ' → capped at 6 → ' : ' ÷ 6 → '}</span>
              <span className="text-signal font-semibold">{c.anomaly.toFixed(2)}</span>
            </Row>
          );
        })}
      </Step>

      {/* 04 — weighted */}
      <Step
        n="04"
        title="We weight them and add up"
        note="Some giveaways matter more than others. Half-finished connections carry the most weight, because that is what a flood looks like and ordinary busy traffic does not."
        delay={180}
      >
        {terms.map((t) => (
          <Row key={t.key} label={TERM_PLAIN[t.key] ?? t.label}>
            <span className="text-inkSoft">{t.weight.toFixed(2)} × {t.anomaly.toFixed(2)} = </span>
            {t.contribution.toFixed(3)}
          </Row>
        ))}
        <div className="mt-4 pt-4 border-t-2 border-ink flex items-end justify-between gap-4">
          <span className="font-display font-extrabold text-xl">Total</span>
          <div className="text-right">
            <div className="font-display font-extrabold text-5xl sm:text-6xl leading-none tabular-nums text-signal">
              {Math.round(score * 100)}
            </div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-inkSoft mt-1.5">
              {stageWord}
            </div>
          </div>
        </div>
      </Step>

      {/* 05 — projected */}
      <Step
        n="05"
        title="Then we play each response forward"
        note="Where we are, plus how much worse it gets on its own, minus what the action takes off. Lowest danger left wins."
        delay={240}
      >
        {decision.options.map((o) => {
          const best = o.action === decision.bestAction;
          return (
            <div
              key={o.action}
              className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3 border-b border-ink/10 last:border-0 ${
                best ? 'text-ink' : 'text-inkSoft'
              }`}
            >
              <span className={`text-sm sm:text-base ${best ? 'font-bold' : ''}`}>
                {ACTION_PLAIN[o.action] ?? o.action}
                {best && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.16em] text-signal">chosen</span>}
              </span>
              <span className="font-mono text-sm sm:text-base tabular-nums whitespace-nowrap">
                {Math.round(o.start * 100)} + {Math.round(o.growth * 100)} − {Math.round(o.defense * 100)} ={' '}
                <span className={`font-bold ${best ? 'text-signal' : ''}`}>{Math.round(o.risk * 100)}%</span>
              </span>
            </div>
          );
        })}
      </Step>

      {/* footer */}
      <div className="py-7 border-t-2 border-ink/10">
        <p className="text-inkSoft leading-snug max-w-2xl">
          Change any measurement — in the sandbox below, or by moving through the timeline — and
          every figure on this page recalculates. There is no stored answer to look up.
        </p>
      </div>
    </div>
  );
};
