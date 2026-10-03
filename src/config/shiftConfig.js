/**
 * Shift Configuration & Lifecycle Engine
 * 
 * Workspace-aware shift foundation.
 * Supports configurable active shift start, end, and timezone.
 * Defaults to 06:00 -> 18:00 when unconfigured.
 * Handles both standard daytime and overnight cross-midnight shifts.
 */

export const DEFAULT_SHIFT_CONFIG = {
  shiftStart: '06:00', // 24-hr format HH:MM
  shiftEnd: '18:00',
  activeShiftStart: '06:00',
  activeShiftEnd: '18:00',
  timezone: 'auto',
  labelActive: 'ACTIVE SHIFT',
  labelOffHours: 'OFF HOURS',
};

/**
 * Parses "HH:MM" into minutes from start of day (0 to 1439).
 */
export const parseTimeToMinutes = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map((n) => parseInt(n, 10) || 0);
  return hours * 60 + minutes;
};

/**
 * Converts 24-hour HH:MM string to 12-hour AM/PM format (e.g. "06:00" -> "06:00 AM", "18:00" -> "06:00 PM").
 */
export const formatTimeTo12Hour = (timeStr) => {
  if (!timeStr || typeof timeStr !== 'string') return 'N/A';
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10) || 0;
  const m = String(parseInt(mStr, 10) || 0).padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${m} ${period}`;
};

/**
 * Evaluates whether the current local/workspace time falls inside the active shift.
 * 
 * @param {Object} [customConfig] Optional workspace-specific shift config
 * @param {Date} [referenceDate] Optional reference date for testing
 * @returns {Object} Shift status metadata
 */
export const getShiftStatus = (customConfig = null, referenceDate = new Date()) => {
  const effectiveStart =
    customConfig?.shiftStart ||
    customConfig?.shift_start ||
    customConfig?.activeShiftStart ||
    DEFAULT_SHIFT_CONFIG.shiftStart;

  const effectiveEnd =
    customConfig?.shiftEnd ||
    customConfig?.shift_end ||
    customConfig?.activeShiftEnd ||
    DEFAULT_SHIFT_CONFIG.shiftEnd;

  const config = {
    ...DEFAULT_SHIFT_CONFIG,
    ...(customConfig || {}),
    shiftStart: effectiveStart,
    shiftEnd: effectiveEnd,
    activeShiftStart: effectiveStart,
    activeShiftEnd: effectiveEnd,
  };

  const startMinutes = parseTimeToMinutes(config.shiftStart);
  const endMinutes = parseTimeToMinutes(config.shiftEnd);

  const currentMinutes = referenceDate.getHours() * 60 + referenceDate.getMinutes();

  let isShiftActive = false;

  if (startMinutes < endMinutes) {
    // Normal daytime shift (e.g. 06:00 -> 18:00)
    isShiftActive = currentMinutes >= startMinutes && currentMinutes < endMinutes;
  } else if (startMinutes > endMinutes) {
    // Overnight shift (e.g. 20:00 -> 06:00)
    isShiftActive = currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    // Start equals end: 24/7 active
    isShiftActive = true;
  }

  const start12 = formatTimeTo12Hour(config.activeShiftStart);
  const end12 = formatTimeTo12Hour(config.activeShiftEnd);

  const shiftText = isShiftActive ? 'Active Shift' : 'Off-hours';
  const nextShiftText = isShiftActive ? `Ends ${end12}` : `Next shift starts ${start12}`;

  return {
    isShiftActive,
    label: isShiftActive ? config.labelActive : config.labelOffHours,
    shiftText,
    nextShiftText,
    start: config.activeShiftStart,
    end: config.activeShiftEnd,
    start12,
    end12,
    shiftSummary: `${start12} — ${end12}`,
  };
};
