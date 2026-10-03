import React from 'react';

/**
 * SectionHeader Component
 * Clean typography header for sections and dashboard cards.
 * 
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.subtitle]
 * @param {React.ReactNode} [props.badge]
 * @param {React.ReactNode} [props.action]
 */
export const SectionHeader = ({
  title,
  subtitle,
  badge,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 ${className}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text)]">
            {title}
          </h2>
          {badge}
        </div>
        {subtitle && (
          <p className="text-sm text-[var(--text-muted)] font-normal max-w-2xl">
            {subtitle}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {action}
        </div>
      )}
    </div>
  );
};
