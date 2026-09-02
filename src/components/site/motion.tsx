import React, { useEffect, useRef, useState } from 'react';

/* ============================================================================
   Motion system.
   One rAF loop drives every pointer-reactive element, so adding cursor effects,
   magnetics and parallax costs a single listener rather than one per component.
   Everything degrades: no fine pointer (touch) = no cursor effects; reduced
   motion = no transitions at all.
   ========================================================================== */

if (typeof document !== 'undefined' && !document.getElementById('motion-kf')) {
  const st = document.createElement('style');
  st.id = 'motion-kf';
  st.textContent = '@keyframes wordRise{from{transform:translateY(110%);opacity:0}to{transform:translateY(0);opacity:1}}';
  document.head.appendChild(st);
}

export const finePointer = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Sub = (x: number, y: number) => void;
const subs = new Set<Sub>();
let targetX = 0, targetY = 0, curX = 0, curY = 0, raf = 0, listening = false;

function loop() {
  curX += (targetX - curX) * 0.14;
  curY += (targetY - curY) * 0.14;
  subs.forEach((s) => s(curX, curY));
  raf = requestAnimationFrame(loop);
}

function ensureListening() {
  if (listening) return;
  listening = true;
  targetX = curX = window.innerWidth / 2;
  targetY = curY = window.innerHeight / 2;
  window.addEventListener('pointermove', (e) => { targetX = e.clientX; targetY = e.clientY; }, { passive: true });
  raf = requestAnimationFrame(loop);
}

export function subscribePointer(fn: Sub) {
  ensureListening();
  subs.add(fn);
  return () => { subs.delete(fn); if (!subs.size) cancelAnimationFrame(raf), (listening = false); };
}

/* ------------------------------------------------------------------ cursor */

/**
 * A ring that trails the real cursor. The native cursor is deliberately kept —
 * people need it to grab sliders, and this is a page built to be poked at.
 */
export const Cursor: React.FC = () => {
  const ring = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [big, setBig] = useState(false);

  useEffect(() => {
    if (!finePointer() || reducedMotion()) return;
    setActive(true);
    const un = subscribePointer((x, y) => {
      const el = ring.current;
      if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
    });

    const over = (e: PointerEvent) => {
      const t = (e.target as HTMLElement)?.closest?.('a,button,input,[data-cursor]');
      setBig(!!t);
    };
    window.addEventListener('pointerover', over, { passive: true });
    return () => { un(); window.removeEventListener('pointerover', over); };
  }, []);

  if (!active) return null;
  return (
    <div
      ref={ring}
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 z-[100] rounded-full mix-blend-difference"
      style={{
        width: big ? 56 : 26,
        height: big ? 56 : 26,
        border: '1.5px solid #ffffff',
        transition: 'width .28s cubic-bezier(.2,.8,.2,1), height .28s cubic-bezier(.2,.8,.2,1)',
        willChange: 'transform',
      }}
    />
  );
};

/* ---------------------------------------------------------- scroll progress */

export const ScrollProgress: React.FC = () => {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      const p = h > 0 ? window.scrollY / h : 0;
      if (bar.current) bar.current.style.transform = `scaleX(${p})`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-[3px] z-[90] bg-transparent" aria-hidden="true">
      <div ref={bar} className="h-full bg-signal origin-left" style={{ transform: 'scaleX(0)', willChange: 'transform' }} />
    </div>
  );
};

/* ---------------------------------------------------------------- parallax */

/** Element drifts with the pointer. depth ~ -30..30 px of travel. */
export function useParallax<T extends HTMLElement = HTMLDivElement>(depth = 14) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!finePointer() || reducedMotion()) return;
    return subscribePointer((x, y) => {
      const el = ref.current;
      if (!el) return;
      const dx = (x / window.innerWidth - 0.5) * 2;
      const dy = (y / window.innerHeight - 0.5) * 2;
      el.style.transform = `translate3d(${dx * depth}px, ${dy * depth}px, 0)`;
    });
  }, [depth]);
  return ref;
}

/* ---------------------------------------------------------------- magnetic */

export const Magnetic: React.FC<{ children: React.ReactNode; strength?: number; className?: string }> = ({
  children, strength = 0.35, className = '',
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !finePointer() || reducedMotion()) return;
    const move = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate3d(${dx * strength}px, ${dy * strength}px, 0)`;
    };
    const leave = () => { el.style.transform = 'translate3d(0,0,0)'; };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); };
  }, [strength]);
  return (
    <span
      ref={ref}
      className={`inline-block ${className}`}
      style={{ transition: 'transform .45s cubic-bezier(.2,.8,.2,1)', willChange: 'transform' }}
    >
      {children}
    </span>
  );
};

/* -------------------------------------------------------------- split text */

/**
 * Masked word-by-word reveal. Each word sits in an overflow-hidden box and
 * rises into place with a stagger — the standard editorial entrance, and the
 * reason the headlines feel authored rather than just placed.
 */
export const SplitText: React.FC<{
  text: string; className?: string; delay?: number; stagger?: number;
}> = ({ text, className = '', delay = 0, stagger = 45 }) => {
  const ref = useRef<HTMLSpanElement>(null);
  // Visible by default. Only words measured below the fold get hidden and then
  // revealed on scroll, so a missed observer costs an animation, not the copy.
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (reducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    // On screen at load: render as-is. An entrance here means starting hidden,
    // and anything that stops the animation finishing would leave the headline
    // blank. Not worth 0.9s of polish on the element that must never fail.
    if (r.top < window.innerHeight) return;

    setHidden(true);
    const failsafe = window.setTimeout(() => setHidden(false), 3000);
    const io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) { setHidden(false); io.disconnect(); } });
    }, { threshold: 0.15 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(failsafe); };
  }, []);

  const words = text.split(' ');
  return (
    <span ref={ref} className={className}>
      {words.map((word, i) => {
        const ms = delay + i * stagger;
        const style: React.CSSProperties = {
          transform: hidden ? 'translateY(110%)' : 'translateY(0)',
          opacity: hidden ? 0 : 1,
          transition: `transform .95s cubic-bezier(.16,1,.3,1) ${ms}ms, opacity .7s ease ${ms}ms`,
        };
        return (
          <span key={i} className="inline-block overflow-hidden align-bottom" style={{ paddingBottom: '.06em' }}>
            <span className="inline-block" style={{ ...style, willChange: 'transform' }}>{word}</span>
            {i < words.length - 1 && <span>&nbsp;</span>}
          </span>
        );
      })}
    </span>
  );
};

/* ---------------------------------------------------------------- marquee */

export const Marquee: React.FC<{ items: string[]; speed?: number }> = ({ items, speed = 38 }) => (
  <div className="relative overflow-hidden border-y-2 border-ink py-4 select-none" aria-hidden="true">
    <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    <div
      className="flex whitespace-nowrap will-change-transform"
      style={{ animation: `marquee ${speed}s linear infinite` }}
    >
      {[0, 1].map((copy) => (
        <div key={copy} className="flex shrink-0">
          {items.map((t, i) => (
            <span key={i} className="flex items-center gap-6 px-6 font-display font-extrabold text-2xl sm:text-4xl tracking-tight">
              {t}
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-signal" />
            </span>
          ))}
        </div>
      ))}
    </div>
  </div>
);

/* --------------------------------------------------------------- count up */

export function useCountUp(target: number, shown: boolean, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!shown) return;
    if (reducedMotion()) { setV(target); return; }
    let start = 0, id = 0;
    const step = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, (t - start) / ms);
      setV(target * (1 - Math.pow(1 - p, 3))); // ease-out cubic
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [target, shown, ms]);
  return v;
}

/* --------------------------------------------------------- scroll-linked */

/** Returns 0→1 as the element travels through the viewport. */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height + window.innerHeight;
      setP(Math.max(0, Math.min(1, (window.innerHeight - r.top) / total)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return { ref, p };
}
