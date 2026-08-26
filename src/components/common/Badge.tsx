import React from 'react';
import { NetworkStatus } from '../../types/cyberDefense';

interface BadgeProps {
  status: NetworkStatus | string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  label,
  size = 'md',
  showDot = true,
  className = ''
}) => {
  const displayLabel = label || status;

  let colorClasses = 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700';
  let dotColor = 'bg-neutral-400';

  const s = status.toUpperCase();

  if (s === 'SAFE') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40';
    dotColor = 'bg-emerald-500';
  } else if (s === 'WATCH') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40';
    dotColor = 'bg-amber-500';
  } else if (s === 'ELEVATED') {
    colorClasses = 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40';
    dotColor = 'bg-orange-500';
  } else if (s === 'CRITICAL' || s === 'DDoS') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40';
    dotColor = 'bg-rose-500';
  }

  const sizeClasses = {
    sm: 'text-[11px] px-2 py-0.5 font-medium',
    md: 'text-xs px-2.5 py-1 font-medium tracking-wide',
    lg: 'text-sm px-3.5 py-1.5 font-semibold'
  }[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border transition-all duration-150 ${sizeClasses} ${colorClasses} ${className}`}
    >
      {showDot && (
        <span
          className={`w-1.5 h-1.5 rounded-full ${dotColor} ${s === 'CRITICAL' || s === 'ELEVATED' ? 'animate-soft-pulse' : ''}`}
        />
      )}
      <span>{displayLabel}</span>
    </span>
  );
};
