import { useEffect, useRef, useState } from 'react';

function reducedMotionQuery() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Reveal-on-scroll, built so failure is invisible rather than fatal.
 *
 * Content starts VISIBLE. Only elements measured below the fold get hidden and
 * then revealed as they scroll in. That inversion matters: if an observer never
 * fires, the viewport is odd, or a compositor skips the transition, the reader
 * still sees the page — the worst case is a missing animation, never missing
 * words.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(threshold = 0.18) {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (reducedMotionQuery()) return;
    const el = ref.current;
    if (!el) return;

    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight) return; // on screen already: leave it alone

    setShown(false);
    const failsafe = window.setTimeout(() => setShown(true), 3000);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) { setShown(true); io.unobserve(e.target); }
        });
      },
      { threshold, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(failsafe); };
  }, [threshold]);

  return { ref, shown };
}

/** Class helper for the reveal transition. */
export const revealClass = (shown: boolean, delayMs = 0) =>
  `transition-all duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] ${
    shown ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
  }` + (delayMs ? ` [transition-delay:${delayMs}ms]` : '');
