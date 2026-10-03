import React from 'react';

/**
 * IconButton Component
 * Circular or squircle glass button for compact icons.
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.icon
 * @param {string} props.ariaLabel - Essential for screen-reader accessibility
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {'glass' | 'ghost' | 'primary'} [props.variant='glass']
 * @param {boolean} [props.active=false]
 */
export const IconButton = ({
  icon,
  ariaLabel,
  size = 'md',
  variant = 'glass',
  active = false,
  className = '',
  ...props
}) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-sm p-1.5 rounded-lg',
    md: 'w-10 h-10 text-base p-2 rounded-xl',
    lg: 'w-12 h-12 text-lg p-2.5 rounded-2xl',
  };

  const variantMap = {
    glass: 'bg-[var(--glass)] hover:bg-[var(--glass-hover)] border border-[var(--glass-border)] hover:border-[var(--glass-highlight)] text-[var(--text)] shadow-[var(--shadow-sm)] backdrop-blur-xl',
    ghost: 'bg-transparent hover:bg-[var(--glass-hover)] text-[var(--text-secondary)] hover:text-[var(--text)] border border-transparent hover:border-[var(--glass-border-subtle)] backdrop-blur-md',
    primary: 'bg-[var(--primary)] text-white hover:brightness-105 shadow-md border border-white/25',
  };

  const activeClasses = active
    ? 'ring-2 ring-[var(--primary)] text-[var(--primary)] bg-[var(--primary-light)]'
    : '';

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`inline-flex items-center justify-center transition-all duration-200 outline-none backdrop-blur-md active:scale-95 cursor-pointer ${variantMap[variant] || variantMap.glass} ${sizeMap[size] || sizeMap.md} ${activeClasses} ${className}`}
      {...props}
    >
      {icon}
    </button>
  );
};
