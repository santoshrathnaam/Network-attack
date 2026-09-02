import React, { ReactNode } from 'react';

interface CardProps {
  title?: string;
  subtitle?: string;
  badge?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  headerBorder?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  badge,
  action,
  children,
  className = '',
  headerBorder = false
}) => {
  return (
    <div
      className={`bg-paper border-2 border-ink/15 rounded-3xl p-6 transition-colors duration-200 ${className}`}
    >
      {(title || subtitle || badge || action) && (
        <div
          className={`flex items-start justify-between gap-4 pb-4 mb-4 ${
            headerBorder ? 'border-b-2 border-ink/10' : ''
          }`}
        >
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-2.5">
              {title && (
                <h3 className="font-display font-extrabold text-xl leading-tight tracking-[-0.01em] text-ink">
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-sm text-inkSoft leading-snug max-w-xl">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};
