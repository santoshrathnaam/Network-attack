import React, { useMemo, useState } from 'react';
import {
  BASELINES, readChannels, anomaliesFrom, scoreTerms, threatScore, statusFor,
  counterfactual, classify, traceOf, type RawWindow,
} from '../../services/engine';
import { generateScenario } from '../../mock/trafficModel';
import { useReveal, revealClass } from './useReveal';
import { ParticleNetwork } from './ParticleNetwork';
import { AttackGame } from './AttackGame';
import { Intro } from './Intro';
import {
  Cursor, ScrollProgress, SplitText, Magnetic, Marquee, useParallax, useCountUp,
} from './motion';

interface SiteViewProps { onOpenDashboard: () => void; }

/* ------------------------------------------------------------------ pieces */

const Act: React.FC<{
  n: string; kicker: string; title: React.ReactNode | string; lead?: string; children?: React.ReactNode;
  wide?: boolean; dark?: boolean;
}> = ({ n, kicker, title, lead, children, wide, dark }) => {
  const { ref, shown } = useReveal();
  return (
    <section
      ref={ref}
      className={`relative px-5 sm:px-8 py-20 sm:py-28 overflow-hidden ${dark ? 'bg-ink text-paper' : ''}`}
    >
      {/* the lights go out exactly where the attack lands */}
      {dark && (
        <ParticleNetwork
          hostility={0.85}
          tone="dark"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-50"
        />
      )}
      {/* the rule draws itself in */}
      <div
        className={`absolute top-0 left-0 right-0 h-[2px] origin-left ${dark ? 'bg-paper/20' : 'bg-ink/15'}`}
        style={{
          transform: shown ? 'scaleX(1)' : 'scaleX(0)',
          transition: 'transform 1.1s cubic-bezier(.16,1,.3,1)',
        }}
      />
      <div className={`relative z-10 ${wide ? 'max-w-5xl' : 'max-w-3xl'} mx-auto`}>
        <div className={`flex items-baseline gap-3 mb-5 ${revealClass(shown)}`}>
          <span className="font-mono text-[11px] tracking-[0.22em] text-signal">{n}</span>
          <span className={`font-mono text-[11px] uppercase tracking-[0.22em] ${dark ? 'text-paper/55' : 'text-inkSoft'}`}>{kicker}</span>
        </div>
        <h2 className={`font-display font-extrabold text-[2.1rem] sm:text-[3.4rem] leading-[0.98] tracking-[-0.02em] text-balance ${dark ? 'text-paper' : 'text-ink'}`}>
          {typeof title === 'string' ? <SplitText text={title} /> : title}
        </h2>
        {lead && (
          <p
            className={`mt-5 text-lg sm:text-2xl leading-[1.45] max-w-2xl ${dark ? 'text-paper/70' : 'text-inkSoft'}`}
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? 'translateY(0)' : 'translateY(18px)',
              transition: 'opacity .9s ease .25s, transform .9s cubic-bezier(.16,1,.3,1) .25s',
            }}
          >
            {lead}
          </p>
        )}
        {children && (
          <div
            className="mt-10"
            style={{
              opacity: shown ? 1 : 0,
              transform: shown ? 'translateY(0)' : 'translateY(26px)',
              transition: 'opacity 1s ease .4s, transform 1s cubic-bezier(.16,1,.3,1) .4s',
            }}
          >
            {children}
          </div>
        )}
      </div>
    </section>
  );
};

/** A measurement drawn against the range it normally sits in. */
const Measure: React.FC<{
  name: string; value: number; mean: number; std: number; fmt?: (v: number) => string;
}> = ({ name, value, mean, std, fmt = (v) => Math.round(v).toLocaleString() }) => {
  const lo = Math.min(value, mean - 3 * std);
  const hi = Math.max(value, mean + 7 * std);
  const at = (v: number) => ((v - lo) / Math.max(hi - lo, 1e-6)) * 100;
  const outside = Math.abs(value - mean) > 2 * std;
  const times = mean > 0 ? value / mean : 1;

  return (
    <div className="py-5 border-b border-ink/10 last:border-0">
      <div className="flex items-baseline justify-between gap-4 mb-3">
        <span className="font-semibold text-ink text-lg">{name}</span>
        <span className={`font-mono font-bold text-2xl tabular-nums ${outside ? 'text-signal' : 'text-ink'}`}>
          {fmt(value)}
        </span>
      </div>
      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-ink/15" />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-7 rounded-md border-2"
          style={{
            left: `${at(mean - 2 * std)}%`,
            width: `${Math.max(3, at(mean + 2 * std) - at(mean - 2 * std))}%`,
            borderColor: 'rgba(18,138,90,.45)',
            background: 'rgba(18,138,90,.10)',
          }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-[3px] border-paper transition-all duration-500"
          style={{ left: `${Math.max(1, Math.min(99, at(value)))}%`, background: outside ? '#E5322D' : '#128A5A' }}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm text-inkSoft">
        <span>normally about {fmt(mean)}</span>
        <span className={outside ? 'text-signal font-semibold' : 'text-safe font-semibold'}>
          {outside ? `${times >= 10 ? Math.round(times) : times.toFixed(1)}× higher than usual` : 'normal'}
        </span>
      </div>
    </div>
  );
};

/** A figure that counts up the first time it is seen. */
const CountNumber: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = '' }) => {
  const { ref, shown } = useReveal(0.4);
  const v = useCountUp(value, shown);
  return <span ref={ref as React.RefObject<HTMLSpanElement>}>{Math.round(v)}{suffix}</span>;
};

/* -------------------------------------------------------------------- view */

export const SiteView: React.FC<SiteViewProps> = ({ onOpenDashboard }) => {
  // one shared set of live values for the interactive acts
  const [ex, setEx] = useState({
    pps: BASELINES.pps.mean,
    synRatio: BASELINES.syn.mean,
    uniqueSources: BASELINES.source.mean,
    failedConns: BASELINES.conn.mean,
  });

  const w: RawWindow = { ...ex, portEntropy: 1.3, acceleration: 0, momentum: 0 };
  const anom = anomaliesFrom(readChannels(w, {}));
  const terms = scoreTerms(anom, 0);
  const score = threatScore(terms);
  const status = statusFor(score);

  const verdict =
    status === 'CRITICAL' ? 'Under attack' : status === 'ELEVATED' ? 'Looks like an attack'
    : status === 'WATCH' ? 'Something is off' : 'All calm';
  const verdictColor = status === 'SAFE' ? '#128A5A' : status === 'WATCH' ? '#D97706' : '#E5322D';

  // the defender's options, from the real counterfactual engine
  const peak = useMemo(() => {
    const s = generateScenario('SIMULATION');
    const cw = s.current;
    const a = anomaliesFrom(readChannels(cw, {}));
    const sc = threatScore(scoreTerms(a, cw.acceleration));
    const f = classify(sc, a, cw);
    const top = Object.entries(f).sort((x, y) => y[1] - x[1])[0];
    return counterfactual(sc, cw.momentum, top[0].toUpperCase(), top[1]);
  }, []);

  const hero = useReveal(0.05);
  const headPar = useParallax(-9);
  const [scrolled, setScrolled] = React.useState(0);

  React.useEffect(() => {
    const on = () => setScrolled(Math.min(1, window.scrollY / (window.innerHeight * 0.9)));
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <div className="bg-paper text-ink font-body min-h-screen">
      <Intro />
      <Cursor />
      <ScrollProgress />
      {/* ------------------------------------------------------- hero */}
      <header className="relative min-h-[92vh] flex flex-col justify-center px-5 sm:px-8 overflow-hidden">
        {/* the living network — reacts to the cursor, turns hostile as you scroll */}
        <ParticleNetwork
          hostility={Math.min(1, scrolled * 1.5)}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        <div
          ref={hero.ref}
          className="relative z-10 max-w-6xl mx-auto w-full"
          style={{
            opacity: 1 - scrolled * 0.85,
            transform: `translateY(${scrolled * -60}px)`,
          }}
        >
          <div
            className="font-mono text-[11px] uppercase tracking-[0.28em] text-signal mb-8"
            style={{
              opacity: hero.shown ? 1 : 0,
              transition: 'opacity .8s ease .1s',
            }}
          >
            SIH26153 · Predictive Cyber Defence
          </div>

          <div ref={headPar}>
            <h1 className="font-display font-extrabold text-[3.2rem] sm:text-[7rem] leading-[0.9] tracking-[-0.035em] max-w-5xl">
              <SplitText text="The attack is" delay={120} />
              <br />
              <SplitText text="already happening." className="text-signal" delay={300} />
              <br />
              <SplitText text="Can you see it?" delay={520} />
            </h1>
          </div>

          <p
            className="mt-8 text-xl sm:text-2xl text-inkSoft max-w-xl leading-[1.4]"
            style={{
              opacity: hero.shown ? 1 : 0,
              transform: hero.shown ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity .9s ease .9s, transform .9s cubic-bezier(.16,1,.3,1) .9s',
            }}
          >
            A computer can — about five minutes before it takes the server down.
            Here is exactly how, in four short steps and one game.
          </p>
        </div>

        <div
          className="absolute bottom-8 left-0 right-0 z-10 text-center font-mono text-[11px] uppercase tracking-[0.22em] text-inkSoft"
          style={{ opacity: 1 - scrolled * 2 }}
        >
          <span className="inline-block animate-bounce">scroll ↓</span>
        </div>
      </header>

      {/* ------------------------------------------------------- act 1 */}
      <Act
        n="01"
        kicker="What a network is"
        title="Every dot is somebody asking the server for something."
        lead="Most of them are ordinary people loading a page. A server can answer thousands a second — until far too many arrive at once, and nobody gets an answer. That is the whole attack."
      />

      <Marquee items={[
        'requests arriving',
        'half-finished conversations',
        'machines calling in',
        'failed attempts',
      ]} />

      {/* ------------------------------------------------------- act 2 */}
      <Act
        n="02"
        kicker="What normal looks like"
        title="To spot something wrong, first you learn what right looks like."
        lead="We watch four simple things and remember the range each one normally sits in — the green band. Today, all four are sitting inside it."
      >
        <div className="rounded-3xl border-2 border-ink px-6 sm:px-8 py-2 bg-paper">
          <Measure name="Requests arriving" value={BASELINES.pps.mean} mean={BASELINES.pps.mean} std={BASELINES.pps.std} />
          <Measure name="Conversations left half-finished" value={BASELINES.syn.mean} mean={BASELINES.syn.mean} std={BASELINES.syn.std} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Measure name="Different machines calling in" value={BASELINES.source.mean} mean={BASELINES.source.mean} std={BASELINES.source.std} />
          <Measure name="Failed attempts" value={BASELINES.conn.mean} mean={BASELINES.conn.mean} std={BASELINES.conn.std} />
        </div>
      </Act>

      {/* ------------------------------------------------------- act 3 */}
      <Act
        n="03"
        kicker="Measuring strange"
        title="Drag it. Watch the dot leave the green."
        lead="Anything outside the green band is unusual, and we can say exactly how unusual with one number between 0 and 1."
      >
        <div className="rounded-3xl border-2 border-ink p-6 sm:p-8 bg-paper">
          <label className="flex items-baseline justify-between mb-2">
            <span className="font-semibold text-lg">Requests arriving right now</span>
            <span className="font-mono font-bold text-2xl tabular-nums text-signal">
              {Math.round(ex.pps).toLocaleString()}
            </span>
          </label>
          <input
            type="range" min={80} max={1900} step={10} value={ex.pps}
            onChange={(e) => setEx({ ...ex, pps: parseFloat(e.target.value) })}
            aria-label="Requests arriving"
            className="w-full h-3 rounded-full appearance-none cursor-pointer bg-ink/10 mb-6"
            style={{ backgroundImage: `linear-gradient(to right,#E5322D ${((ex.pps - 80) / 1820) * 100}%, transparent ${((ex.pps - 80) / 1820) * 100}%)` }}
          />
          <Measure name="Requests arriving" value={ex.pps} mean={BASELINES.pps.mean} std={BASELINES.pps.std} />
          <div className="mt-6 flex items-end justify-between gap-6">
            <div className="flex-1">
              <div className="font-semibold mb-2">How unusual is that?</div>
              <div className="h-4 rounded-full bg-ink/10 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(1.5, anom.traffic * 100)}%`, background: '#E5322D' }} />
              </div>
              <div className="mt-2 text-sm text-inkSoft">0 = completely normal · 1 = as strange as it gets</div>
            </div>
            <div className="font-mono font-extrabold text-6xl tabular-nums leading-none">
              {anom.traffic.toFixed(2)}
            </div>
          </div>
        </div>
      </Act>

      {/* ------------------------------------------------------- act 4 */}
      <Act
        n="04"
        kicker="One number to act on"
        title="Four strange numbers add up to one alarm."
        lead="Each of the four gets that same 0-to-1 treatment. Some matter more than others — leaving conversations half-finished is the biggest giveaway. Add them up and you have the alarm."
        wide
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">
          <div className="rounded-3xl border-2 border-ink p-6 sm:p-8 bg-paper space-y-6">
            {([
              ['pps', 'Requests arriving', 80, 1900, 10, (v: number) => Math.round(v).toLocaleString()],
              ['synRatio', 'Left half-finished', 0, 1, 0.01, (v: number) => `${Math.round(v * 100)}%`],
              ['uniqueSources', 'Different machines', 5, 300, 1, (v: number) => Math.round(v).toString()],
              ['failedConns', 'Failed attempts', 0, 180, 1, (v: number) => Math.round(v).toString()],
            ] as const).map(([key, label, min, max, step, fmt]) => {
              const val = ex[key] as number;
              const pct = ((val - min) / (max - min)) * 100;
              return (
                <div key={key}>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className="font-semibold">{label}</span>
                    <span className="font-mono font-bold tabular-nums">{fmt(val)}</span>
                  </div>
                  <input
                    type="range" min={min} max={max} step={step} value={val}
                    aria-label={label}
                    onChange={(e) => setEx({ ...ex, [key]: parseFloat(e.target.value) })}
                    className="w-full h-3 rounded-full appearance-none cursor-pointer bg-ink/10"
                    style={{ backgroundImage: `linear-gradient(to right,#E5322D ${pct}%, transparent ${pct}%)` }}
                  />
                </div>
              );
            })}
            <button
              onClick={() => setEx({ pps: BASELINES.pps.mean, synRatio: BASELINES.syn.mean, uniqueSources: BASELINES.source.mean, failedConns: BASELINES.conn.mean })}
              className="text-sm font-semibold text-inkSoft hover:text-signal transition-colors"
            >
              ↺ Put everything back to normal
            </button>
          </div>

          <div className="rounded-3xl border-2 border-ink p-7 bg-paper text-center lg:sticky lg:top-8">
            <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-inkSoft mb-4">the alarm</div>
            <div className="font-display font-extrabold text-7xl leading-none tabular-nums" style={{ color: verdictColor }}>
              {Math.round(score * 100)}
            </div>
            <div className="mt-3 font-bold text-xl" style={{ color: verdictColor }}>{verdict}</div>
            <div className="mt-6 space-y-2 text-left">
              {terms.filter((t) => t.key !== 'accel').map((t) => (
                <div key={t.key} className="flex items-center gap-2">
                  <span className="flex-1 text-xs text-inkSoft truncate">
                    {({ syn: 'half-finished', traffic: 'requests', source: 'machines', conn: 'failures' } as Record<string, string>)[t.key]}
                  </span>
                  <div className="w-20 h-2 rounded-full bg-ink/10 overflow-hidden">
                    <div className="h-full bg-signal transition-all duration-300"
                      style={{ width: `${Math.min(100, (t.contribution / 0.3) * 100)}%` }} />
                  </div>
                  <span className="font-mono text-xs tabular-nums w-9 text-right">+{t.contribution.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Act>

      {/* ------------------------------------------------------- the game */}
      <Act
        n="05"
        kicker="Now you try it"
        title="Your turn. Try to get away with it."
        lead="You have met the four numbers. Now play the other side and see how quickly they give you away."
        wide
        dark
      >
        <AttackGame />
      </Act>

      {/* ------------------------------------------------------- act 6 */}
      <Act
        n="06"
        kicker="The point of all this"
        title="Spotting it is easy. Knowing what to do is the hard part."
        lead="Once the alarm goes off there are three choices, and each costs something. So we play each one forward five minutes and compare how much danger is left."
        wide
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { key: 'NO_ACTION', title: 'Do nothing', note: 'Nobody is inconvenienced. The attack carries on.' },
            { key: 'BLOCK_SOURCES', title: 'Block the bad addresses', note: 'Fast, and nobody really notices. Some attackers slip through.' },
            { key: 'ISOLATE_SERVER', title: 'Pull the server offline', note: 'Stops it dead — but the service is down for everyone.' },
          ].map((o) => {
            const risk = peak.scenarios[o.key]['5m'];
            const best = peak.best === o.key;
            return (
              <div key={o.key} data-cursor
                className={`rounded-3xl border-2 p-6 transition-all duration-500 hover:-translate-y-2 ${best ? 'border-safe bg-safe/[0.06]' : 'border-ink/20 hover:border-ink'}`}>
                {best && (
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-safe mb-2">the pick</div>
                )}
                <div className="font-display font-extrabold text-2xl leading-tight mb-2">{o.title}</div>
                <p className="text-inkSoft mb-6 min-h-[48px] leading-snug">{o.note}</p>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-inkSoft mb-1">
                  danger left after 5 min
                </div>
                <div className="font-display font-extrabold text-5xl tabular-nums"
                  style={{ color: risk > 0.6 ? '#E5322D' : risk > 0.3 ? '#D97706' : '#128A5A' }}>
                  <CountNumber value={risk * 100} suffix="%" />
                </div>
                <div className="mt-3 h-2.5 rounded-full bg-ink/10 overflow-hidden">
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.max(2, risk * 100)}%`, background: risk > 0.6 ? '#E5322D' : risk > 0.3 ? '#D97706' : '#128A5A' }} />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-8 text-xl sm:text-2xl leading-[1.45] text-ink max-w-3xl">
          That is the whole system: not an alarm that shouts{' '}
          <span className="text-inkSoft">&ldquo;something is wrong&rdquo;</span>, but one that says{' '}
          <span className="text-signal font-semibold">&ldquo;do this one thing, and most of the damage never happens.&rdquo;</span>
        </p>
      </Act>

      {/* ------------------------------------------------------- outro */}
      <section className="px-5 sm:px-8 py-24 border-t-2 border-ink">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="font-display font-extrabold text-[2.4rem] sm:text-[4rem] leading-[0.95] tracking-[-0.03em] mb-6">
            Every number here was measured, not written.
          </h2>
          <p className="text-lg sm:text-xl text-inkSoft mb-10 leading-[1.5]">
            Nothing on this page is a mock-up. Each figure comes out of the same engine the
            real system runs — which is why moving any dial changes all of them at once.
          </p>
          <Magnetic strength={0.4}>
            <button
              onClick={onOpenDashboard}
              data-cursor
              className="px-8 py-4 rounded-full bg-ink text-paper font-bold text-lg hover:bg-signal transition-colors"
            >
              Show me the technical panel →
            </button>
          </Magnetic>
          <div className="mt-14 font-mono text-[11px] uppercase tracking-[0.2em] text-inkSoft">
            SIH26153 · NTRO · AI-based network attack forecasting
          </div>
        </div>
      </section>
    </div>
  );
};
