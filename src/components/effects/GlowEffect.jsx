import React from 'react';

/**
 * GlowEffect Component
 * Adds targeted subtle atmospheric glow behind any component.
 */
export const GlowEffect = ({
  color = 'var(--primary)',
  size = 'medium',
  className = '',
}) => {
  const sizeMap = {
    small: 'w-24 h-24 blur-xl opacity-30',
    medium: 'w-48 h-48 blur-2xl opacity-40',
    large: 'w-72 h-72 blur-3xl opacity-50',
  };

  return (
    <div
      className={`absolute -z-10 rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 ${sizeMap[size] || sizeMap.medium} ${className}`}
      style={{
        background: color,
      }}
      aria-hidden="true"
    />
  );
};
