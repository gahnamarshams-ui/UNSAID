import React from 'react';

/**
 * Badge Component
 * Accessible, semantic badge supporting High, Medium, Low, Primary, Cyan, and Neutral.
 * Colors are powered entirely by CSS variables.
 * 
 * @param {Object} props
 * @param {'high' | 'medium' | 'low' | 'primary' | 'cyan' | 'neutral'} [props.variant='neutral']
 * @param {'sm' | 'md'} [props.size='md']
 * @param {React.ReactNode} [props.dot]
 */
export const Badge = ({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
}) => {
  const variantMap = {
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
    primary: 'badge-primary',
    cyan: 'badge-cyan',
    neutral: 'badge-neutral',
  };

  const sizeMap = {
    sm: 'text-[10px] px-2 py-0.5 tracking-wider',
    md: 'text-xs px-2.5 py-1',
  };

  const dotColorMap = {
    high: 'bg-[var(--danger)]',
    medium: 'bg-[var(--warning)]',
    low: 'bg-[var(--success)]',
    primary: 'bg-[var(--primary)]',
    cyan: 'bg-[var(--cyan)]',
    neutral: 'bg-[var(--text-muted)]',
  };

  return (
    <span
      className={`badge ${variantMap[variant] || 'badge-neutral'} ${sizeMap[size] || sizeMap.md} ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full inline-block shrink-0 ${dotColorMap[variant] || 'bg-current'}`}
          aria-hidden="true"
        />
      )}
      <span>{children}</span>
    </span>
  );
};
