import React, { useMemo } from 'react';

interface NetworkFlowProps {
  /** 0..1 — how much traffic is flowing. Drives dot count and speed. */
  intensity?: number;
  /** 0..1 — how much of it is hostile. Drives how many dots are red. */
  hostility?: number;
  /** Server takes visible damage as this rises. */
  damage?: number;
  height?: number;
}

/**
 * The one picture the whole site rests on: little dots travel from the
 * outside world into a server. Calm traffic is dark and sparse; an attack is
 * red and crowded. No labels, no jargon — you just see it.
 */
export const NetworkFlow: React.FC<NetworkFlowProps> = ({
  intensity = 0.15,
  hostility = 0,
  damage = 0,
  height = 220,
}) => {
  const count = Math.round(6 + intensity * 30);
  const dots = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        lane: i % 5,
        delay: (i * 0.37) % 3,
        seed: (i * 97) % 100,
      })),
    [],
  );

  const speed = 3.2 - intensity * 2.1; // seconds to cross
  const shake = damage > 0.55 ? 'animate-[shake_.35s_ease-in-out_infinite]' : '';

  return (
    <div className="relative w-full select-none overflow-hidden" style={{ height }} aria-hidden="true">
      <style>{`
        @keyframes flow-across { from { left: 0; } to { left: calc(100% - 118px); } }
        @keyframes shake {
          0%,100% { transform: translate(0,0) }
          25% { transform: translate(-2px,1px) }
          75% { transform: translate(2px,-1px) }
        }
        @media (prefers-reduced-motion: reduce) {
          .flow-dot { animation: none !important; opacity: .35 }
        }
      `}</style>

      {/* lanes */}
      {[0, 1, 2, 3, 4].map((lane) => (
        <div
          key={lane}
          className="absolute left-0 right-[128px] border-t border-dashed border-ink/10"
          style={{ top: `${14 + lane * 19}%` }}
        />
      ))}

      {/* travelling dots */}
      {dots.slice(0, count).map((d, i) => {
        const hostile = d.seed / 100 < hostility;
        return (
          <span
            key={i}
            className="flow-dot absolute rounded-full"
            style={{
              top: `calc(${14 + d.lane * 19}% - 3px)`,
              left: 0,
              width: hostile ? 7 : 6,
              height: hostile ? 7 : 6,
              background: hostile ? '#E5322D' : '#111111',
              opacity: hostile ? 0.9 : 0.55,
              animation: `flow-across ${speed + (d.seed % 7) * 0.12}s linear ${d.delay}s infinite`,
              maxWidth: 8,
            }}
          />
        );
      })}

      {/* the server */}
      <div className={`absolute right-0 top-1/2 -translate-y-1/2 ${shake}`}>
        <div
          className="w-[104px] rounded-md border-2 p-2.5 bg-paper"
          style={{
            borderColor: damage > 0.55 ? '#E5322D' : '#111111',
            boxShadow: damage > 0.2 ? `0 0 0 ${Math.round(damage * 10)}px rgba(229,50,45,.08)` : 'none',
          }}
        >
          {[0, 1, 2].map((r) => (
            <div key={r} className="flex items-center gap-1.5 mb-1.5 last:mb-0">
              <span
                className="w-2 h-2 rounded-full"
                style={{ background: damage > (r + 1) * 0.3 ? '#E5322D' : '#128A5A' }}
              />
              <span className="flex-1 h-1.5 rounded-sm bg-ink/15" />
            </div>
          ))}
        </div>
        <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-inkSoft">
          server
        </div>
      </div>
    </div>
  );
};
