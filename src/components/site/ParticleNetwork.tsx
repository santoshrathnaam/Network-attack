import React, { useEffect, useRef } from 'react';
import { subscribePointer, reducedMotion } from './motion';

interface Props {
  /** 0..1 — how much of the swarm has turned hostile and is converging. */
  hostility?: number;
  className?: string;
  /** Which ground it is drawn on, so the neutral nodes stay legible. */
  tone?: 'light' | 'dark';
}

interface Node {
  x: number; y: number; vx: number; vy: number;
  hostile: boolean; r: number; hit: number;
}

const INK_LIGHT = '17,17,17';
const INK_DARK = '236,236,231';
const SIGNAL = '229,50,45';

/**
 * The hero's signature moment: a living network drawn on canvas.
 *
 * Nodes drift and link to their neighbours. Your cursor pushes them aside and
 * reaches out to whatever is nearby. As you scroll, a growing share of them
 * turn hostile, break formation and converge on the server — so the page's
 * opening image performs the exact thing the page is about.
 *
 * One rAF loop, transform-free drawing, paused when off-screen, and a single
 * static frame when the visitor prefers reduced motion.
 */
export const ParticleNetwork: React.FC<Props> = ({ hostility = 0, className = '', tone = 'light' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostilityRef = useRef(hostility);
  hostilityRef.current = hostility;
  const toneRef = useRef(tone);
  toneRef.current = tone;

  const nodesRef = useRef<Node[]>([]);
  const pointerRef = useRef({ x: -9999, y: -9999 });
  const sizeRef = useRef({ w: 0, h: 0 });
  const visibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const still = reducedMotion();

    const build = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };

      const count = Math.max(38, Math.min(120, Math.round((w * h) / 13000)));
      nodesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        hostile: false,
        r: 1.4 + Math.random() * 1.9,
        hit: 0,
      }));
    };

    build();
    const ro = new ResizeObserver(build);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const unsub = subscribePointer((x, y) => {
      const rect = canvas.getBoundingClientRect();
      pointerRef.current = { x: x - rect.left, y: y - rect.top };
    });

    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { visibleRef.current = e.isIntersecting; }),
      { threshold: 0 },
    );
    io.observe(canvas);

    let raf = 0;
    let t = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      if (!visibleRef.current) return;

      const { w, h } = sizeRef.current;
      if (!w || !h) return;
      const nodes = nodesRef.current;
      const hostileShare = hostilityRef.current;
      const INK = toneRef.current === 'dark' ? INK_DARK : INK_LIGHT;
      const p = pointerRef.current;
      t += 0.016;

      // the target everything converges on
      const sx = w * (w < 640 ? 0.5 : 0.84);
      const sy = h * (w < 640 ? 0.78 : 0.52);

      ctx.clearRect(0, 0, w, h);

      // assign hostility by index so the share grows smoothly with scroll
      const hostileCount = Math.round(nodes.length * hostileShare);
      for (let i = 0; i < nodes.length; i++) nodes[i].hostile = i < hostileCount;

      // ---- update -------------------------------------------------------
      if (!still) {
        for (const n of nodes) {
          if (n.hostile) {
            const dx = sx - n.x, dy = sy - n.y;
            const d = Math.hypot(dx, dy) || 1;
            n.vx += (dx / d) * 0.035;
            n.vy += (dy / d) * 0.035;
            if (d < 26) { // impact — flash and respawn at the edge
              n.hit = 1;
              n.x = -20 - Math.random() * 120;
              n.y = Math.random() * h;
              n.vx = 0.4 + Math.random() * 0.5;
              n.vy = (Math.random() - 0.5) * 0.3;
            }
          }

          // the cursor shoulders nodes out of the way
          const pdx = n.x - p.x, pdy = n.y - p.y;
          const pd = Math.hypot(pdx, pdy);
          if (pd < 130 && pd > 0.01) {
            const push = (1 - pd / 130) * 0.9;
            n.vx += (pdx / pd) * push;
            n.vy += (pdy / pd) * push;
          }

          n.x += n.vx;
          n.y += n.vy;
          n.vx *= n.hostile ? 0.975 : 0.955;
          n.vy *= n.hostile ? 0.975 : 0.955;

          // gentle idle drift so the field never settles
          if (!n.hostile) {
            n.vx += Math.sin(t * 0.5 + n.y * 0.01) * 0.006;
            n.vy += Math.cos(t * 0.4 + n.x * 0.01) * 0.006;
          }

          if (n.x < -140) n.x = w + 10;
          if (n.x > w + 140) n.x = -10;
          if (n.y < -40) n.y = h + 10;
          if (n.y > h + 40) n.y = -10;
          if (n.hit > 0) n.hit -= 0.04;
        }
      }

      // ---- links --------------------------------------------------------
      const LINK = w < 640 ? 92 : 118;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const d = Math.sqrt(d2);
          const hostile = a.hostile || b.hostile;
          const alpha = (1 - d / LINK) * (hostile ? 0.42 : 0.17);
          ctx.strokeStyle = `rgba(${hostile ? SIGNAL : INK},${alpha})`;
          ctx.lineWidth = hostile ? 1 : 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // ---- cursor reaching out -------------------------------------------
      if (p.x > -1000) {
        for (const n of nodes) {
          const d = Math.hypot(n.x - p.x, n.y - p.y);
          if (d < 165) {
            ctx.strokeStyle = `rgba(${SIGNAL},${(1 - d / 165) * 0.5})`;
            ctx.lineWidth = 0.9;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(n.x, n.y);
            ctx.stroke();
          }
        }
      }

      // ---- nodes ---------------------------------------------------------
      for (const n of nodes) {
        ctx.fillStyle = n.hostile ? `rgba(${SIGNAL},0.92)` : `rgba(${INK},0.5)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + (n.hit > 0 ? n.hit * 3 : 0), 0, Math.PI * 2);
        ctx.fill();
      }

      // ---- the server ----------------------------------------------------
      const pulse = 1 + Math.sin(t * 2.2) * 0.06 + hostileShare * 0.35;
      const ringR = 26 * pulse;
      ctx.strokeStyle = `rgba(${hostileShare > 0.25 ? SIGNAL : INK},${0.25 + hostileShare * 0.5})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sy, ringR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = `rgba(${hostileShare > 0.25 ? SIGNAL : INK},${0.75 + hostileShare * 0.25})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 5.5, 0, Math.PI * 2);
      ctx.fill();

      if (still) cancelAnimationFrame(raf); // one static frame is enough
    };

    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      unsub();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
};
