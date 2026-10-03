import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useLiquidHold Hook
 * Reusable press-and-hold interaction hook inspired by iOS liquid physics.
 * 
 * @param {Object} options
 * @param {number} options.holdDuration - Duration in ms before hold triggers (default 500ms)
 * @param {Function} options.onHoldComplete - Callback when hold duration is reached
 * @param {Function} options.onHoldStart - Callback when press begins
 * @param {Function} options.onHoldEnd - Callback when press ends or cancels
 * @returns {Object} { isHolding, isCompleted, progress, holdProps }
 */
export const useLiquidHold = ({
  holdDuration = 500,
  onHoldComplete,
  onHoldStart,
  onHoldEnd,
} = {}) => {
  const [isHolding, setIsHolding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [progress, setProgress] = useState(0);

  const timerRef = useRef(null);
  const progressAnimRef = useRef(null);
  const startTimeRef = useRef(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (progressAnimRef.current) {
      cancelAnimationFrame(progressAnimRef.current);
      progressAnimRef.current = null;
    }
  }, []);

  const handleStart = useCallback(
    (e) => {
      // Ignore right-click
      if (e.button && e.button !== 0) return;

      cleanup();
      setIsHolding(true);
      setIsCompleted(false);
      setProgress(0);
      startTimeRef.current = Date.now();

      if (onHoldStart) onHoldStart();

      const updateProgress = () => {
        const elapsed = Date.now() - startTimeRef.current;
        const currentProgress = Math.min(elapsed / holdDuration, 1);
        setProgress(currentProgress);

        if (currentProgress < 1) {
          progressAnimRef.current = requestAnimationFrame(updateProgress);
        }
      };

      progressAnimRef.current = requestAnimationFrame(updateProgress);

      timerRef.current = setTimeout(() => {
        setIsCompleted(true);
        setProgress(1);
        if (onHoldComplete) onHoldComplete();
        // Subtle vibration if browser/device supports navigator.vibrate
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try {
            navigator.vibrate(25);
          } catch {
            // Safe fallback
          }
        }

      }, holdDuration);
    },
    [cleanup, holdDuration, onHoldComplete, onHoldStart]
  );

  const handleEnd = useCallback(() => {
    cleanup();
    setIsHolding(false);
    setProgress(0);
    if (onHoldEnd) onHoldEnd();
  }, [cleanup, onHoldEnd]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const holdProps = {
    onPointerDown: handleStart,
    onPointerUp: handleEnd,
    onPointerLeave: handleEnd,
    onPointerCancel: handleEnd,
    onTouchStart: handleStart,
    onTouchEnd: handleEnd,
    onTouchCancel: handleEnd,
  };

  return {
    isHolding,
    isCompleted,
    progress,
    holdProps,
  };
};
