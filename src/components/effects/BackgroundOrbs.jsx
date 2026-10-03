import React from 'react';

/**
 * BackgroundOrbs Component
 * Liquid Glass V2 ambient background environment.
 * Renders large, slowly drifting blurred translucent blobs/orbs:
 * Lavender, Cyan, Pink, and Blue that illuminate and refract through glass cards.
 * Completely inert to pointer events (pointer-events: none).
 */
export const BackgroundOrbs = () => {
  return (
    <div
      className="fixed inset-0 overflow-hidden pointer-events-none z-0"
      style={{ contain: 'strict', transform: 'translate3d(0, 0, 0)' }}
      aria-hidden="true"
    >
      {/* 1. Lavender Ambient Orb - Top-Left */}
      <div
        className="absolute -top-28 -left-28 w-[380px] h-[380px] sm:w-[540px] sm:h-[540px] rounded-full blur-[64px] opacity-45 dark:opacity-35 orb-drift-1"
        style={{
          background: 'radial-gradient(circle, rgba(196, 181, 253, 0.7) 0%, rgba(139, 92, 246, 0.45) 45%, rgba(124, 92, 255, 0.15) 70%, transparent 85%)',
          willChange: 'transform',
        }}
      />

      {/* 2. Cyan Ambient Orb - Top-Right */}
      <div
        className="absolute top-16 -right-28 w-[400px] h-[400px] sm:w-[560px] sm:h-[560px] rounded-full blur-[64px] opacity-45 dark:opacity-35 orb-drift-2"
        style={{
          background: 'radial-gradient(circle, rgba(103, 232, 249, 0.65) 0%, rgba(6, 182, 212, 0.38) 45%, rgba(14, 165, 233, 0.12) 70%, transparent 85%)',
          willChange: 'transform',
          animationDelay: '-3s',
        }}
      />

      {/* 3. Soft Pink / Rose Ambient Orb - Mid-Center / Left */}
      <div
        className="absolute top-[45%] -left-16 w-[340px] h-[340px] sm:w-[480px] sm:h-[480px] rounded-full blur-[64px] opacity-40 dark:opacity-25 orb-drift-3"
        style={{
          background: 'radial-gradient(circle, rgba(251, 207, 232, 0.7) 0%, rgba(244, 114, 182, 0.4) 45%, rgba(244, 63, 94, 0.1) 70%, transparent 85%)',
          willChange: 'transform',
          animationDelay: '-6s',
        }}
      />

      {/* 4. Deep Sky Blue Ambient Orb - Bottom-Right */}
      <div
        className="absolute -bottom-28 right-8 w-[420px] h-[420px] sm:w-[560px] sm:h-[560px] rounded-full blur-[64px] opacity-45 dark:opacity-30 orb-drift-4"
        style={{
          background: 'radial-gradient(circle, rgba(147, 197, 253, 0.68) 0%, rgba(59, 130, 246, 0.4) 45%, rgba(37, 99, 235, 0.12) 70%, transparent 85%)',
          willChange: 'transform',
          animationDelay: '-9s',
        }}
      />

      {/* 5. Central Lavender-Cyan Subtle Prismatic Bridge */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[300px] h-[300px] sm:w-[440px] sm:h-[440px] rounded-full blur-[64px] opacity-25 dark:opacity-20 pulsing-orb"
        style={{
          background: 'radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, rgba(34, 211, 238, 0.25) 50%, transparent 80%)',
          willChange: 'transform, opacity',
        }}
      />

      {/* Subtle Noise / Grid Texture for optical glass realism */}
      <div
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(var(--text) 1px, transparent 1px)`,
          backgroundSize: '36px 36px',
        }}
      />
    </div>
  );
};

