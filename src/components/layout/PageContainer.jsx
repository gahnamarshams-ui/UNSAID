import React from 'react';

/**
 * PageContainer Component
 * Responsive content wrapper with standard max-width, side padding, and bottom padding for mobile pill navigation.
 * 
 * @param {Object} props
 * @param {'sm' | 'md' | 'lg' | 'full'} [props.size='lg']
 * @param {React.ReactNode} props.children
 */
export const PageContainer = ({
  children,
  size = 'lg',
  className = '',
}) => {
  const sizeMap = {
    sm: 'max-w-3xl',
    md: 'max-w-5xl',
    lg: 'max-w-7xl',
    full: 'max-w-none',
  };

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 pb-28 md:pb-12 ${sizeMap[size] || sizeMap.lg} ${className}`}
    >
      {children}
    </div>
  );
};
