/**
 * RealtimeClock Component
 * 
 * A lightweight, isolated live clock component.
 * - Displays current local time (HH:MM:SS AM/PM) and date.
 * - Updates every 1000ms via setInterval.
 * - Fully cleans up interval on unmount.
 * - Encapsulated state prevents parent dashboard re-renders.
 */

import React, { useState, useEffect } from 'react';
import { Clock, Calendar } from 'lucide-react';

export const RealtimeClock = ({ showDate = true, className = '' }) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formattedTime = now.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const formattedDate = now.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className={`inline-flex items-center gap-3 text-xs ${className}`}>
      {showDate && (
        <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)] font-medium">
          <Calendar className="w-3.5 h-3.5 text-[var(--cyan)]" />
          <span>{formattedDate}</span>
        </span>
      )}
      <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-[var(--text)] tracking-wider">
        <Clock className="w-3.5 h-3.5 text-[var(--primary)]" />
        <span>{formattedTime}</span>
      </span>
    </div>
  );
};
