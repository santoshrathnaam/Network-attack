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
      className={`bg-white dark:bg-[#12141A] border border-[#E5E5EA] dark:border-[#222733] rounded-[16px] p-5 shadow-apple dark:shadow-apple-dark transition-all duration-200 ${className}`}
    >
      {(title || subtitle || badge || action) && (
        <div
          className={`flex items-center justify-between pb-3.5 mb-3.5 ${
            headerBorder ? 'border-b border-[#F0F0F3] dark:border-[#1E232E]' : ''
          }`}
        >
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              {title && (
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {title}
                </h3>
              )}
              {badge}
            </div>
            {subtitle && (
              <p className="text-xs text-neutral-400 dark:text-neutral-500">
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
