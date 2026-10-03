import React from 'react';

/**
 * GlassCard Component
 * Modern translucent card with frosted glass backdrop blur and iOS-inspired lighting.
 * 
 * @param {Object} props
 * @param {'default' | 'interactive' | 'panel' | 'subtle'} [props.variant='default']
 * @param {boolean} [props.glow=false]
 * @param {boolean} [props.floating=false]
 * @param {React.ReactNode} props.children
 */
export const GlassCard = ({
  children,
  variant = 'default',
  glow = false,
  floating = false,
  className = '',
  onClick,
  ...props
}) => {
  const isInteractive = variant === 'interactive' || !!onClick;

  const variantClass = {
    default: 'glass-card',
    panel: 'glass-panel',
    interactive: 'glass-card cursor-pointer active:scale-[0.99]',
    subtle: 'glass rounded-xl',
  }[variant] || 'glass-card';

  const glowClass = glow ? 'glow' : '';
  const floatClass = floating ? 'floating' : '';

  return (
    <div
      className={`${variantClass} ${glowClass} ${floatClass} p-5 sm:p-6 ${className}`}
      onClick={onClick}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (onClick) onClick(e);
              }
            }
          : undefined
      }

      {...props}
    >
      {/* Top subtle highlight reflection */}
      <div
        className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--glass-highlight)] to-transparent opacity-75 pointer-events-none"
        aria-hidden="true"
      />
      {/* Subtle interior ambient liquid highlight */}
      <div
        className="absolute -top-20 -left-20 w-44 h-44 rounded-full bg-white/[0.06] dark:bg-white/[0.03] blur-2xl pointer-events-none"
        aria-hidden="true"
      />
      {children}
    </div>
  );
};
