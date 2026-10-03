import React from 'react';
import { Sparkles } from 'lucide-react';

/**
 * GlassLoader Component
 * Centered frosted glass loading screen with smooth pulsing glow.
 * 
 * @param {Object} props
 * @param {string} [props.message='Loading...']
 */
export const GlassLoader = ({ message = 'Checking session...' }) => {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
      <div className="glass-card p-8 rounded-3xl flex flex-col items-center gap-4 max-w-sm w-full border border-[var(--glass-border)] shadow-2xl backdrop-blur-2xl">
        <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-[var(--primary)] to-[var(--cyan)] flex items-center justify-center text-white shadow-lg animate-pulse">
          <Sparkles className="w-7 h-7 animate-spin" />
        </div>
        <div className="space-y-1">
          <h3 className="font-semibold text-base text-[var(--text)] tracking-tight">
            {message}
          </h3>
          <p className="text-xs text-[var(--text-muted)]">
            Securing access & verifying workspace
          </p>
        </div>
      </div>
    </div>
  );
};
