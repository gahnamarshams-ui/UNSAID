import React from 'react';

/**
 * Avatar Component
 * Displays user photo or initials with glowing glass ring and optional status dot.
 * 
 * @param {Object} props
 * @param {string} [props.name='User']
 * @param {string} [props.src]
 * @param {'sm' | 'md' | 'lg'} [props.size='md']
 * @param {boolean} [props.isOnline=false]
 */
export const Avatar = ({
  name = 'User',
  src,
  size = 'md',
  isOnline = false,
  className = '',
}) => {
  const sizeMap = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base font-semibold',
  };

  const dotSizeMap = {
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3.5 h-3.5',
  };

  const getInitials = (n) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`${sizeMap[size] || sizeMap.md} rounded-full overflow-hidden flex items-center justify-center font-medium bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] text-white shadow-[var(--shadow-sm)] border border-[var(--glass-highlight)]`}
      >
        {src ? (
          <img src={src} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{getInitials(name)}</span>
        )}
      </div>

      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 ${dotSizeMap[size] || dotSizeMap.md} rounded-full bg-[var(--success)] ring-2 ring-[var(--surface)]`}
          aria-label="Online status"
          title="Online"
        />
      )}
    </div>
  );
};
