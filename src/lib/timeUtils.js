// src/lib/timeUtils.js
// Time manipulation utilities for the Call Sheet Builder

/**
 * Parse a time string (HH:MM or HH:MM AM/PM) into minutes from midnight.
 *
 * @param {string} timeStr - Time string in HH:MM or HH:MM AM/PM format
 * @returns {number} Minutes from midnight (0-1439)
 *
 * @example
 * parseTimeToMinutes("09:30") // => 570
 * parseTimeToMinutes("9:30 AM") // => 570
 * parseTimeToMinutes("2:30 PM") // => 870
 */
export function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") {
    return 0;
  }

  const normalized = timeStr.trim().toUpperCase();

  // Check for AM/PM format
  const isPM = normalized.includes("PM");
  const isAM = normalized.includes("AM");
  const cleanTime = normalized.replace(/\s*(AM|PM)\s*/i, "").trim();

  const [hoursStr, minutesStr] = cleanTime.split(":");
  let hours = parseInt(hoursStr, 10) || 0;
  const minutes = parseInt(minutesStr, 10) || 0;

  // Handle 12-hour format conversion
  if (isPM && hours !== 12) {
    hours += 12;
  } else if (isAM && hours === 12) {
    hours = 0;
  }

  // Clamp to valid range
  hours = Math.max(0, Math.min(23, hours));

  return hours * 60 + minutes;
}

/**
 * Convert minutes from midnight to HH:MM format (24-hour).
 *
 * @param {number} totalMinutes - Minutes from midnight
 * @returns {string} Time string in HH:MM format
 *
 * @example
 * minutesToTimeString(570) // => "09:30"
 * minutesToTimeString(870) // => "14:30"
 */
export function minutesToTimeString(totalMinutes) {
  const clamped = Math.max(0, Math.min(1439, totalMinutes));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Convert minutes from midnight to 12-hour format with AM/PM.
 *
 * @param {number} totalMinutes - Minutes from midnight
 * @returns {string} Time string in "h:mm AM/PM" format
 *
 * @example
 * minutesToTime12h(570) // => "9:30 AM"
 * minutesToTime12h(870) // => "2:30 PM"
 */
export function minutesToTime12h(totalMinutes) {
  const clamped = Math.max(0, Math.min(1439, totalMinutes));
  const hours24 = Math.floor(clamped / 60);
  const minutes = clamped % 60;

  const period = hours24 >= 12 ? "PM" : "AM";
  let hours12 = hours24 % 12;
  if (hours12 === 0) hours12 = 12;

  return `${hours12}:${String(minutes).padStart(2, "0")} ${period}`;
}

/**
 * Calculate end time given start time and duration.
 *
 * @param {string} startTime - Start time in HH:MM format
 * @param {number} durationMinutes - Duration in minutes
 * @returns {string} End time in HH:MM format
 *
 * @example
 * calculateEndTime("09:30", 45) // => "10:15"
 */
export function calculateEndTime(startTime, durationMinutes) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + durationMinutes;
  return minutesToTimeString(endMinutes);
}

/**
 * Calculate duration between two times.
 *
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @returns {number} Duration in minutes
 *
 * @example
 * calculateDuration("09:30", "10:15") // => 45
 */
export function calculateDuration(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  return Math.max(0, endMinutes - startMinutes);
}

/**
 * Round time to nearest increment.
 *
 * @param {string} timeStr - Time string in HH:MM format
 * @param {number} incrementMinutes - Increment to round to (e.g., 5, 15, 30)
 * @returns {string} Rounded time in HH:MM format
 *
 * @example
 * roundToIncrement("09:37", 15) // => "09:45"
 * roundToIncrement("09:22", 15) // => "09:15"
 */
export function roundToIncrement(timeStr, incrementMinutes = 15) {
  const minutes = parseTimeToMinutes(timeStr);
  const rounded = Math.round(minutes / incrementMinutes) * incrementMinutes;
  return minutesToTimeString(rounded);
}

/**
 * Snap time down to nearest increment (floor).
 *
 * @param {string} timeStr - Time string in HH:MM format
 * @param {number} incrementMinutes - Increment to snap to
 * @returns {string} Snapped time in HH:MM format
 *
 * @example
 * snapToIncrement("09:37", 15) // => "09:30"
 */
export function snapToIncrement(timeStr, incrementMinutes = 15) {
  const minutes = parseTimeToMinutes(timeStr);
  const snapped = Math.floor(minutes / incrementMinutes) * incrementMinutes;
  return minutesToTimeString(snapped);
}

/**
 * Format duration in minutes to human-readable string.
 *
 * @param {number} durationMinutes - Duration in minutes
 * @param {object} options - Formatting options
 * @param {boolean} options.short - Use short format (e.g., "1h 30m" vs "1 hour 30 minutes")
 * @returns {string} Formatted duration string
 *
 * @example
 * formatDuration(90) // => "1h 30m"
 * formatDuration(90, { short: false }) // => "1 hour 30 minutes"
 * formatDuration(45) // => "45m"
 */
export function formatDuration(durationMinutes, options = { short: true }) {
  const hours = Math.floor(durationMinutes / 60);
  const minutes = durationMinutes % 60;

  if (options.short) {
    if (hours === 0) {
      return `${minutes}m`;
    }
    if (minutes === 0) {
      return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
  }

  const hourLabel = hours === 1 ? "hour" : "hours";
  const minuteLabel = minutes === 1 ? "minute" : "minutes";

  if (hours === 0) {
    return `${minutes} ${minuteLabel}`;
  }
  if (minutes === 0) {
    return `${hours} ${hourLabel}`;
  }
  return `${hours} ${hourLabel} ${minutes} ${minuteLabel}`;
}

/**
 * Parse duration string to minutes.
 *
 * @param {string} durationStr - Duration string (e.g., "1h 30m", "90m", "1.5h")
 * @returns {number} Duration in minutes
 *
 * @example
 * parseDuration("1h 30m") // => 90
 * parseDuration("90m") // => 90
 * parseDuration("1.5h") // => 90
 * parseDuration("45") // => 45 (assumes minutes)
 */
export function parseDuration(durationStr) {
  if (!durationStr || typeof durationStr !== "string") {
    return 0;
  }

  const normalized = durationStr.trim().toLowerCase();

  // Handle "Xh Ym" format
  const hoursMinutesMatch = normalized.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(\d+)?\s*m?/i);
  if (hoursMinutesMatch) {
    const hours = parseFloat(hoursMinutesMatch[1]) || 0;
    const minutes = parseInt(hoursMinutesMatch[2], 10) || 0;
    return Math.round(hours * 60 + minutes);
  }

  // Handle "Xh" format (including decimals)
  const hoursOnlyMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*h(?:ours?)?$/i);
  if (hoursOnlyMatch) {
    return Math.round(parseFloat(hoursOnlyMatch[1]) * 60);
  }

  // Handle "Xm" or "X min" format
  const minutesMatch = normalized.match(/^(\d+)\s*(?:m(?:in(?:utes?)?)?)?$/i);
  if (minutesMatch) {
    return parseInt(minutesMatch[1], 10);
  }

  // Fallback: try to parse as plain number (assume minutes)
  const plainNumber = parseInt(normalized, 10);
  return isNaN(plainNumber) ? 0 : plainNumber;
}

/**
 * Check if two time ranges overlap.
 *
 * @param {string} start1 - Start time of first range (HH:MM)
 * @param {number} duration1 - Duration of first range in minutes
 * @param {string} start2 - Start time of second range (HH:MM)
 * @param {number} duration2 - Duration of second range in minutes
 * @returns {boolean} True if ranges overlap
 *
 * @example
 * doTimesOverlap("09:00", 30, "09:15", 30) // => true
 * doTimesOverlap("09:00", 30, "10:00", 30) // => false
 */
export function doTimesOverlap(start1, duration1, start2, duration2) {
  const s1 = parseTimeToMinutes(start1);
  const e1 = s1 + duration1;
  const s2 = parseTimeToMinutes(start2);
  const e2 = s2 + duration2;

  // Two ranges overlap if neither ends before the other starts
  return s1 < e2 && s2 < e1;
}

/**
 * Calculate overlap amount in minutes between two time ranges.
 *
 * @param {string} start1 - Start time of first range (HH:MM)
 * @param {number} duration1 - Duration of first range in minutes
 * @param {string} start2 - Start time of second range (HH:MM)
 * @param {number} duration2 - Duration of second range in minutes
 * @returns {number} Overlap in minutes (0 if no overlap)
 */
export function getOverlapMinutes(start1, duration1, start2, duration2) {
  const s1 = parseTimeToMinutes(start1);
  const e1 = s1 + duration1;
  const s2 = parseTimeToMinutes(start2);
  const e2 = s2 + duration2;

  const overlapStart = Math.max(s1, s2);
  const overlapEnd = Math.min(e1, e2);

  return Math.max(0, overlapEnd - overlapStart);
}

/**
 * Generate time slots for a timeline.
 *
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @param {number} incrementMinutes - Interval between slots
 * @returns {Array<{ time: string, minutes: number, label: string }>}
 *
 * @example
 * generateTimeSlots("08:00", "10:00", 30)
 * // => [
 * //   { time: "08:00", minutes: 480, label: "8:00 AM" },
 * //   { time: "08:30", minutes: 510, label: "8:30 AM" },
 * //   { time: "09:00", minutes: 540, label: "9:00 AM" },
 * //   { time: "09:30", minutes: 570, label: "9:30 AM" },
 * //   { time: "10:00", minutes: 600, label: "10:00 AM" }
 * // ]
 */
export function generateTimeSlots(startTime, endTime, incrementMinutes = 30) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const slots = [];

  for (let m = startMinutes; m <= endMinutes; m += incrementMinutes) {
    slots.push({
      time: minutesToTimeString(m),
      minutes: m,
      label: minutesToTime12h(m),
    });
  }

  return slots;
}

/**
 * Get the current time as HH:MM string.
 *
 * @returns {string} Current time in HH:MM format
 */
export function getCurrentTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Check if a time falls within a range.
 *
 * @param {string} time - Time to check (HH:MM)
 * @param {string} rangeStart - Range start (HH:MM)
 * @param {string} rangeEnd - Range end (HH:MM)
 * @returns {boolean} True if time is within range (inclusive of start, exclusive of end)
 */
export function isTimeInRange(time, rangeStart, rangeEnd) {
  const t = parseTimeToMinutes(time);
  const start = parseTimeToMinutes(rangeStart);
  const end = parseTimeToMinutes(rangeEnd);
  return t >= start && t < end;
}

/**
 * Calculate the position (as percentage) of a time within a day range.
 * Useful for positioning entries on a timeline.
 *
 * @param {string} time - Time to calculate position for (HH:MM)
 * @param {string} dayStart - Day start time (HH:MM)
 * @param {string} dayEnd - Day end time (HH:MM)
 * @returns {number} Position as percentage (0-100)
 */
export function getTimePositionPercent(time, dayStart, dayEnd) {
  const t = parseTimeToMinutes(time);
  const start = parseTimeToMinutes(dayStart);
  const end = parseTimeToMinutes(dayEnd);
  const range = end - start;

  if (range <= 0) return 0;

  const offset = t - start;
  return Math.max(0, Math.min(100, (offset / range) * 100));
}

/**
 * Calculate the width (as percentage) of a duration within a day range.
 *
 * @param {number} durationMinutes - Duration in minutes
 * @param {string} dayStart - Day start time (HH:MM)
 * @param {string} dayEnd - Day end time (HH:MM)
 * @returns {number} Width as percentage (0-100)
 */
export function getDurationWidthPercent(durationMinutes, dayStart, dayEnd) {
  const start = parseTimeToMinutes(dayStart);
  const end = parseTimeToMinutes(dayEnd);
  const range = end - start;

  if (range <= 0) return 0;

  return Math.max(0, Math.min(100, (durationMinutes / range) * 100));
}

/**
 * Convert a position percentage back to a time.
 *
 * @param {number} percent - Position as percentage (0-100)
 * @param {string} dayStart - Day start time (HH:MM)
 * @param {string} dayEnd - Day end time (HH:MM)
 * @param {number} snapIncrement - Optional increment to snap to
 * @returns {string} Time in HH:MM format
 */
export function percentToTime(percent, dayStart, dayEnd, snapIncrement = null) {
  const start = parseTimeToMinutes(dayStart);
  const end = parseTimeToMinutes(dayEnd);
  const range = end - start;

  const minutes = start + (percent / 100) * range;
  const clamped = Math.max(start, Math.min(end, minutes));

  if (snapIncrement) {
    const snapped = Math.round(clamped / snapIncrement) * snapIncrement;
    return minutesToTimeString(snapped);
  }

  return minutesToTimeString(Math.round(clamped));
}
