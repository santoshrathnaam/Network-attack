import React, { ReactNode } from 'react';

interface MetricValueProps {
  value: string | number;
  label: string;
  unit?: string;
  sublabel?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  semanticColor?: 'safe' | 'watch' | 'elevated' | 'critical' | 'neutral';
  dominant?: boolean;
  className?: string;
  icon?: ReactNode;
}

export const MetricValue: React.FC<MetricValueProps> = ({
  value,
  label,
  unit,
  sublabel,
  trend,
  trendValue,
  semanticColor = 'neutral',
  dominant = true,
  className = '',
  icon
}) => {
  let colorClass = 'text-neutral-900 dark:text-neutral-50';
  if (semanticColor === 'safe') colorClass = 'text-emerald-600 dark:text-emerald-400';
  if (semanticColor === 'watch') colorClass = 'text-amber-600 dark:text-amber-400';
  if (semanticColor === 'elevated') colorClass = 'text-orange-600 dark:text-orange-400';
  if (semanticColor === 'critical') colorClass = 'text-rose-600 dark:text-rose-400';

  return (
    <div className={`flex flex-col ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wider uppercase text-neutral-400 dark:text-neutral-500">
          {label}
        </span>
        {icon && <span className="text-neutral-400 dark:text-neutral-500">{icon}</span>}
      </div>

      <div className="flex items-baseline gap-1 mt-1.5">
        <span
          className={`font-semibold tracking-tight tabular-nums ${
            dominant ? 'text-3xl sm:text-4xl' : 'text-xl'
          } ${colorClass}`}
        >
          {value}
        </span>
        {unit && (
          <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
            {unit}
          </span>
        )}
      </div>

      {(sublabel || trendValue) && (
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-neutral-500 dark:text-neutral-400">
          {trend && (
            <span
              className={`font-medium ${
                trend === 'up'
                  ? 'text-rose-600 dark:text-rose-400'
                  : trend === 'down'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-neutral-500'
              }`}
            >
              {trend === 'up' ? '▲' : trend === 'down' ? '▼' : '—'} {trendValue}
            </span>
          )}
          {sublabel && <span className="text-neutral-400 dark:text-neutral-500">{sublabel}</span>}
        </div>
      )}
    </div>
  );
};
