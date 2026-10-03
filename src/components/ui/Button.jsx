import React from 'react';

/**
 * Button Component
 * Highly flexible glassmorphic button with primary, secondary, ghost, and danger variants.
 * 
 * Features:
 * - Isolated pointer events to prevent gesture/liquid hold leakage
 * - Explicit touchAction: manipulation for responsive tap without zoom delays
 * 
 * @param {Object} props
 * @param {'primary' | 'secondary' | 'ghost' | 'danger'} [props.variant='primary']
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {React.ReactNode} [props.icon]
 * @param {React.ReactNode} [props.iconRight]
 * @param {boolean} [props.isLoading=false]
 * @param {boolean} [props.fullWidth=false]
 */
export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  isLoading = false,
  fullWidth = false,
  className = '',
  disabled,
  onPointerDown,
  ...props
}) => {
  const sizeClasses = {
    sm: 'text-xs px-3.5 py-1.5 rounded-full gap-1.5',
    md: 'text-sm px-5 py-2.5 rounded-full gap-2',
    lg: 'text-base px-6 py-3.5 rounded-full gap-2.5 font-semibold',
  };

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  const handlePointerDown = (e) => {
    // Isolate button pointer events so regular buttons never bubble to gestures
    e.stopPropagation();
    if (onPointerDown) {
      onPointerDown(e);
    }
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    if (props.onPointerUp) {
      props.onPointerUp(e);
    }
  };

  const handlePointerCancel = (e) => {
    e.stopPropagation();
    if (props.onPointerCancel) {
      props.onPointerCancel(e);
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    if (props.onClick) {
      props.onClick(e);
    }
  };

  return (
    <button
      className={`btn ${variantClasses[variant] || 'btn-primary'} ${sizeClasses[size] || sizeClasses.md} ${widthClass} ${className} ${disabled || isLoading ? 'opacity-60 cursor-not-allowed pointer-events-none' : ''}`}
      disabled={disabled || isLoading}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onClick={handleClick}
      style={{ touchAction: 'manipulation', ...props.style }}
      {...props}
    >
      {isLoading ? (
        <span
          className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
      ) : (
        icon && <span className="inline-flex shrink-0 items-center justify-center">{icon}</span>
      )}
      <span>{children}</span>
      {!isLoading && iconRight && (
        <span className="inline-flex shrink-0 items-center justify-center">{iconRight}</span>
      )}
    </button>
  );
};
