import React from 'react';
import { ShieldCheck, EyeOff } from 'lucide-react';
import { useIdentity } from '../../hooks/useIdentity';

/**
 * IdentityToggle Component
 * Allows authenticated users to switch between "Public" and "Anonymous" identity modes.
 * Displays the current active publishing attribution cleanly with Liquid Glass styling.
 */
export const IdentityToggle = ({ className = '', compact = false }) => {
  const { isAnonymous, activeName, setIdentityMode } = useIdentity();

  return (
    <div
      className={`inline-flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:px-3 sm:py-1.5 rounded-2xl bg-[var(--surface)] border border-[var(--glass-border)] shadow-xs select-none ${className}`}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)] flex items-center gap-1">
          {isAnonymous ? (
            <EyeOff className="w-3.5 h-3.5 text-[var(--cyan)]" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--primary)]" />
          )}
          Identity:
        </span>

        {/* Toggle Switch Pills */}
        <div className="inline-flex p-0.5 rounded-full bg-[var(--surface-hover)] border border-[var(--glass-border)]">
          <button
            type="button"
            onClick={() => setIdentityMode('public')}
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              !isAnonymous
                ? 'bg-[var(--primary)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Public
          </button>
          <button
            type="button"
            onClick={() => setIdentityMode('anonymous')}
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              isAnonymous
                ? 'bg-[var(--cyan)] text-white shadow-xs'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Anonymous
          </button>
        </div>
      </div>

      {!compact && (
        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 sm:border-l sm:border-[var(--glass-border)] sm:pl-2.5">
          <span>Posting as:</span>
          <strong
            className={`font-semibold truncate max-w-[140px] sm:max-w-[180px] ${
              isAnonymous ? 'text-[var(--cyan)] font-mono' : 'text-[var(--text)]'
            }`}
          >
            {activeName}
          </strong>
        </div>
      )}
    </div>
  );
};
