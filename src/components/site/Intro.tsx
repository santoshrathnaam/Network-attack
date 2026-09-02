import React, { useEffect, useRef, useState } from 'react';
import { reducedMotion } from './motion';

// Only ever plays once per page load.
let hasPlayed = false;

/**
 * The opening beat: a count to a hundred while a rule fills, then the sheet
 * lifts away.
 *
 * This is a full-screen overlay, which makes it the single most dangerous
 * component on the site — if it ever fails to leave, the page is unreachable.
 * So its lifecycle runs on plain timeouts (never on animation frames, which
 * stall in background tabs and embedded frames), any re-mount resolves it
 * immediately rather than restarting it, and it does not run at all on touch
 * devices where the risk buys nothing.
 */
export const Intro: React.FC = () => {
  const [phase, setPhase] = useState<'count' | 'wipe' | 'done'>('count');
  const [n, setN] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    const coarsePointer =
      typeof window !== 'undefined' && !window.matchMedia?.('(pointer: fine)').matches;

    // Anything that means "don't play" must also clear the overlay, not just
    // decline to start it. Leaving it mounted was the bug.
    if (hasPlayed || reducedMotion() || coarsePointer) {
      setPhase('done');
      return;
    }
    hasPlayed = true;

    const DURATION = 1600;
    const WIPE = 850;

    // The lifecycle is timeout-driven and independent of the counter, so if
    // frames never arrive the number simply does not animate — the overlay
    // still leaves on schedule.
    const toWipe = window.setTimeout(() => setPhase('wipe'), DURATION);
    const toDone = window.setTimeout(() => setPhase('done'), DURATION + WIPE);

    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION);
      setN(Math.round(100 * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);

    const bail = () => { setN(100); setPhase('done'); };
    window.addEventListener('pointerdown', bail);
    window.addEventListener('keydown', bail);

    return () => {
      window.clearTimeout(toWipe);
      window.clearTimeout(toDone);
      cancelAnimationFrame(raf.current);
      window.removeEventListener('pointerdown', bail);
      window.removeEventListener('keydown', bail);
    };
  }, []);

  if (phase === 'done') return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-paper flex flex-col justify-between px-5 sm:px-8 py-8 sm:py-10"
      style={{
        transform: phase === 'wipe' ? 'translateY(-100%)' : 'translateY(0)',
        transition: 'transform .85s cubic-bezier(.76,0,.24,1)',
      }}
      aria-hidden="true"
    >
      <div className="font-mono text-[11px] uppercase tracking-[0.28em] text-signal">
        SIH26153 · Predictive Cyber Defence
      </div>

      <div className="flex items-end justify-between gap-6">
        <div
          className="font-display font-extrabold leading-[0.85] tracking-[-0.04em] text-ink"
          style={{ fontSize: 'clamp(4rem, 18vw, 15rem)' }}
        >
          <span className="tabular-nums">{n}</span>
        </div>
        <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-inkSoft pb-3 hidden sm:block">
          listening to the network
        </div>
      </div>

      <div className="h-[2px] w-full bg-ink/10 overflow-hidden">
        <div
          className="h-full bg-signal origin-left"
          style={{ transform: `scaleX(${n / 100})`, transition: 'transform .1s linear' }}
        />
      </div>
    </div>
  );
};
