import React, { useEffect, useRef, useState } from 'react';
import { applyDynamics, traceOf, BASELINES, type RawSignals } from '../../services/engine';
import { NetworkFlow } from './NetworkFlow';
import { Magnetic } from './motion';

type Phase = 'idle' | 'playing' | 'won' | 'caught';

const WINDOWS = 26;
const TICK_MS = 250;
const CAUGHT_AT = 0.60; // the defender acts once it is this confident

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * "You are the attacker."
 *
 * The player pushes three dials; the defender's suspicion is the REAL threat
 * score from the engine, measured over a rolling window exactly as it is
 * everywhere else on the site. Because half-finished connections carry the
 * heaviest weight, the fastest way to do damage is also the fastest way to get
 * caught — so the player discovers the weighting by losing to it.
 */
export const AttackGame: React.FC = () => {
  const [phase, setPhase] = useState<Phase>('idle');
  const [dials, setDials] = useState({ force: 0.15, machines: 0.1, reckless: 0.05 });
  const [damage, setDamage] = useState(0);
  const [suspicion, setSuspicion] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const dialsRef = useRef(dials); dialsRef.current = dials;
  const suspicionRef = useRef(0);
  const historyRef = useRef<RawSignals[]>([]);
  const timer = useRef<number | null>(null);

  const toSignals = (d: typeof dials): RawSignals => ({
    pps: BASELINES.pps.mean + d.force * 1800,
    uniqueSources: BASELINES.source.mean + d.machines * 260,
    synRatio: BASELINES.syn.mean + d.reckless * 0.8,
    failedConns: BASELINES.conn.mean + d.reckless * 60,
    portEntropy: 1.2 + d.machines * 2.5,
  });

  const reset = (startPlaying: boolean) => {
    const base = { force: 0.15, machines: 0.1, reckless: 0.05 };
    setDials(base);
    dialsRef.current = base;
    historyRef.current = Array.from({ length: WINDOWS }, () => toSignals(base));
    setDamage(0); setSuspicion(0); setElapsed(0); suspicionRef.current = 0;
    setPhase(startPlaying ? 'playing' : 'idle');
  };

  useEffect(() => {
    if (phase !== 'playing') return;
    timer.current = window.setInterval(() => {
      const d = dialsRef.current;

      // roll the window forward with the player's current settings
      const hist = historyRef.current;
      hist.push(toSignals(d));
      if (hist.length > WINDOWS) hist.shift();

      // The engine gives the defender's instantaneous reading; their CONFIDENCE
      // builds toward it over time (and fades slower than it rises). Without
      // this the game is over the instant you touch a dial — and it also models
      // the real thing better: one odd window is not yet an accusation.
      const windows = applyDynamics(hist);
      const target = traceOf(windows)[windows.length - 1].score;
      const dt = TICK_MS / 1000;
      let nextSuspicion = suspicionRef.current;
      const k = target > nextSuspicion ? 0.55 : 0.30; // rises faster than it forgets
      nextSuspicion += (target - nextSuspicion) * k * dt * 4;
      nextSuspicion = clamp01(nextSuspicion);
      suspicionRef.current = nextSuspicion;
      setSuspicion(nextSuspicion);
      const score = nextSuspicion;

      // damage: volume alone is slow, half-open connections exhaust it fast
      const rate = (0.5 * d.force + 0.5 * d.reckless) * 5.0; // % per second
      setDamage((prev) => {
        const next = prev + (rate * TICK_MS) / 1000;
        if (next >= 100) { setPhase('won'); return 100; }
        return next;
      });

      setElapsed((e) => e + TICK_MS / 1000);
      if (score >= CAUGHT_AT) setPhase('caught');
    }, TICK_MS);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [phase]);

  const hint =
    suspicion >= 0.48 ? { text: 'They are onto you. Back off, now.', tone: 'text-signal' }
    : suspicion >= 0.32 ? { text: 'Getting noticed. Careful.', tone: 'text-amber-600' }
    : damage < 6 ? { text: 'Barely a scratch. Push harder.', tone: 'text-inkSoft' }
    : { text: 'Slipping through unnoticed.', tone: 'text-safe' };

  return (
    <div className="rounded-3xl border-2 border-ink bg-paper overflow-hidden">
      {/* header */}
      <div className="px-6 sm:px-8 pt-7 pb-5 border-b-2 border-ink/10">
        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal mb-2">
          Your turn
        </div>
        <h3 className="font-display font-extrabold text-3xl sm:text-4xl leading-[1.05] tracking-tight text-ink">
          You are the attacker.
        </h3>
        <p className="mt-2 text-inkSoft text-lg max-w-xl leading-snug">
          Take the server down before the defender notices you. It is watching the
          same four numbers you just met.
        </p>
      </div>

      {/* the picture */}
      <div className="px-6 sm:px-8 pt-5">
        <NetworkFlow
          intensity={phase === 'idle' ? 0.15 : dials.force}
          hostility={phase === 'idle' ? 0 : Math.max(dials.force, dials.reckless)}
          damage={damage / 100}
          height={190}
        />
      </div>

      {/* meters */}
      <div className="px-6 sm:px-8 py-5 grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Meter
          label="Damage to the server"
          hint="Fill this and you win"
          value={damage}
          display={`${Math.round(damage)}%`}
          color="#E5322D"
        />
        <Meter
          label="How suspicious you look"
          hint={`They isolate the server at ${Math.round(CAUGHT_AT * 100)}%`}
          value={suspicion * 100}
          display={`${Math.round(suspicion * 100)}%`}
          color={suspicion >= 0.48 ? '#E5322D' : suspicion >= 0.32 ? '#D97706' : '#128A5A'}
          markerAt={CAUGHT_AT * 100}
        />
      </div>

      {/* dials */}
      <div className="px-6 sm:px-8 pb-6 grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Dial label="How hard you hit" sub="more traffic" value={dials.force}
          disabled={phase !== 'playing'}
          onChange={(v) => setDials((s) => ({ ...s, force: v }))} />
        <Dial label="How many machines" sub="spread it around" value={dials.machines}
          disabled={phase !== 'playing'}
          onChange={(v) => setDials((s) => ({ ...s, machines: v }))} />
        <Dial label="How reckless" sub="don't finish connections" value={dials.reckless}
          disabled={phase !== 'playing'}
          onChange={(v) => setDials((s) => ({ ...s, reckless: v }))} />
      </div>

      {/* status bar */}
      <div className="px-6 sm:px-8 py-5 border-t-2 border-ink/10 flex flex-wrap items-center gap-4">
        {phase === 'idle' && (
          <>
            <Magnetic strength={0.4}>
              <button onClick={() => reset(true)} data-cursor
                className="px-7 py-3.5 rounded-full bg-ink text-paper font-bold hover:bg-signal transition-colors">
                Start the attack
              </button>
            </Magnetic>
            <span className="text-inkSoft">Three dials. One server. Don&rsquo;t get caught.</span>
          </>
        )}

        {phase === 'playing' && (
          <>
            <span className={`font-bold text-lg ${hint.tone}`}>{hint.text}</span>
            <span className="ml-auto font-mono text-sm text-inkSoft">{elapsed.toFixed(0)}s</span>
          </>
        )}

        {phase === 'won' && (
          <Outcome
            title="Server down. You win."
            body="You stayed under the radar long enough to finish the job — which is exactly the case the defender has to catch earlier."
            tone="safe"
            onRetry={() => reset(true)}
          />
        )}

        {phase === 'caught' && (
          <Outcome
            title="Caught. The server was isolated."
            body="Suspicion crossed 75% and the defender pulled the server off the network. Notice what did it: being reckless counts for far more than sheer volume."
            tone="signal"
            onRetry={() => reset(true)}
          />
        )}
      </div>
    </div>
  );
};

const Outcome: React.FC<{ title: string; body: string; tone: 'safe' | 'signal'; onRetry: () => void }> = ({
  title, body, tone, onRetry,
}) => (
  <div className="w-full">
    <div className={`font-display font-extrabold text-2xl mb-1 ${tone === 'safe' ? 'text-safe' : 'text-signal'}`}>
      {title}
    </div>
    <p className="text-inkSoft max-w-2xl mb-4 leading-snug">{body}</p>
    <Magnetic strength={0.35}>
      <button onClick={onRetry} data-cursor
        className="px-6 py-3 rounded-full bg-ink text-paper font-bold hover:bg-signal transition-colors">
        Try again
      </button>
    </Magnetic>
  </div>
);

const Meter: React.FC<{
  label: string; hint: string; value: number; display: string; color: string; markerAt?: number;
}> = ({ label, hint, value, display, color, markerAt }) => (
  <div>
    <div className="flex items-baseline justify-between mb-1.5">
      <span className="font-semibold text-ink">{label}</span>
      <span className="font-mono font-bold text-2xl tabular-nums" style={{ color }}>{display}</span>
    </div>
    <div className="relative h-4 rounded-full bg-ink/10 overflow-hidden">
      <div className="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${clamp01(value / 100) * 100}%`, background: color }} />
      {markerAt !== undefined && (
        <div className="absolute top-0 bottom-0 w-[3px] bg-ink" style={{ left: `${markerAt}%` }} />
      )}
    </div>
    <div className="mt-1 text-sm text-inkSoft">{hint}</div>
  </div>
);

const Dial: React.FC<{
  label: string; sub: string; value: number; disabled: boolean; onChange: (v: number) => void;
}> = ({ label, sub, value, disabled, onChange }) => (
  <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
    <div className="flex items-baseline justify-between mb-1">
      <span className="font-semibold text-ink text-sm">{label}</span>
      <span className="font-mono text-sm text-inkSoft">{Math.round(value * 100)}</span>
    </div>
    <input
      type="range" min={0} max={1} step={0.01} value={value} disabled={disabled}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      aria-label={label}
      className="w-full h-3 rounded-full appearance-none cursor-pointer bg-ink/10"
      style={{ backgroundImage: `linear-gradient(to right, #E5322D ${value * 100}%, transparent ${value * 100}%)` }}
    />
    <div className="mt-1 text-xs text-inkSoft">{sub}</div>
  </div>
);
