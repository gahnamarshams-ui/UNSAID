import React from 'react';
import { useLiquidHold } from '../../hooks/useLiquidHold';

/**
 * LiquidButton Component
 * Apple iOS-inspired liquid hold element.
 * Expands gently, glows, and animates a liquid radial fill as you press and hold.
 * 
 * @param {Object} props
 * @param {number} [props.holdDuration=500] - Duration in ms before hold activates
 * @param {Function} [props.onHoldComplete] - Fired when held for full duration
 * @param {Function} [props.onClick] - Regular tap/click handler
 * @param {React.ReactNode} props.children
 */
export const LiquidButton = ({
  children,
  holdDuration = 550,
  onHoldComplete,
  onClick,
  className = '',
  ariaLabel,
  disabled = false,
  ...props
}) => {
  const { isHolding, progress, holdProps } = useLiquidHold({
    holdDuration,
    onHoldComplete: () => {

      if (!disabled && onHoldComplete) {
        onHoldComplete();
      }
    },
  });

  const handleClick = (e) => {
    if (disabled) return;
    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={`liquid-button relative group cursor-pointer select-none outline-none border border-[var(--glass-border)] rounded-2xl overflow-hidden backdrop-blur-xl transition-all duration-300 ${
        isHolding
          ? 'scale-[1.06] shadow-[var(--liquid-glow)] border-[var(--primary)]'
          : 'hover:scale-[1.02] hover:border-[var(--glass-highlight)] shadow-[var(--shadow)]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onClick={handleClick}
      {...holdProps}
      {...props}
    >
      {/* Top subtle highlight reflection */}
      <div
        className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-[var(--glass-highlight)] to-transparent opacity-75 pointer-events-none"
        aria-hidden="true"
      />

      {/* Background Liquid Ring / Fill on hold */}
      <span
        className="absolute inset-0 bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] opacity-0 transition-opacity duration-200 pointer-events-none"
        style={{
          opacity: isHolding ? Math.max(0.15, progress * 0.45) : 0,
        }}
        aria-hidden="true"
      />

      {/* Radial expansion wave */}
      {isHolding && (
        <span
          className="absolute inset-0 rounded-2xl bg-[var(--primary)] pointer-events-none opacity-20 blur-md transition-all ease-out"
          style={{
            transform: `scale(${1 + progress * 0.3})`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Progress ring or edge bar along the bottom */}
      {isHolding && (
        <span
          className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-[var(--primary)] via-[var(--cyan)] to-[var(--primary-secondary)] transition-all ease-linear"
          style={{
            width: `${Math.round(progress * 100)}%`,
          }}
          aria-hidden="true"
        />
      )}

      {/* Content wrapper */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        {children}
      </span>
    </button>
  );
};
