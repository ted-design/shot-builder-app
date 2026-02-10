// src/lib/time/crewCallEffective.js
// Shared helpers for crew call time computation with offset/previous-day support

import { parseTimeToMinutes, minutesToTime12h } from "../timeUtils";

/**
 * Check if a value is a valid HH:MM time string (24-hour format).
 * @param {string|null|undefined} value
 * @returns {boolean}
 */
export function isTimeString(value) {
  if (!value) return false;
  const match = String(value)
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;

  const hour = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minutes)) return false;

  return hour >= 0 && hour <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * Check if input looks like a time but is ambiguous (missing AM/PM).
 * Matches patterns like "6:17", "12:30" (1-12 hour range without AM/PM).
 * Hours 0 and 13-23 are unambiguous 24-hour format and return false.
 *
 * @param {string|null|undefined} raw - Raw user input
 * @returns {boolean} - True if input is time-like but missing AM/PM
 *
 * @example
 * isAmbiguousTimeInput("6:17")    // => true (needs AM/PM)
 * isAmbiguousTimeInput("6:17 AM") // => false (has AM/PM)
 * isAmbiguousTimeInput("14:30")   // => false (unambiguous 24-hour)
 * isAmbiguousTimeInput("00:30")   // => false (unambiguous 24-hour)
 * isAmbiguousTimeInput("OFF")     // => false (not time-like)
 */
export function isAmbiguousTimeInput(raw) {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();

  // Match HH:MM where no AM/PM present
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;

  const hour = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);

  // Validate ranges
  if (hour < 0 || hour > 23) return false;
  if (mins < 0 || mins > 59) return false;

  // Hours 1-12 are ambiguous without AM/PM
  // Hours 0, 13-23 are unambiguous 24-hour format
  return hour >= 1 && hour <= 12;
}

/**
 * Parse user-typed time input into minutes from midnight.
 * Accepts:
 *  - "6:17 AM", "6:17AM", "06:17 am"
 *  - "11:30 PM", "11:30PM"
 *  - Must have AM/PM present to be valid (strict 12-hour format)
 *
 * @param {string} raw - Raw user input
 * @returns {{ minutes: number } | null} - Parsed minutes (0-1439) or null if invalid
 *
 * @example
 * parseTimeInputToMinutes("6:17 AM")  // => { minutes: 377 }
 * parseTimeInputToMinutes("11:30 PM") // => { minutes: 1410 }
 * parseTimeInputToMinutes("6:17")     // => null (no AM/PM)
 */
export function parseTimeInputToMinutes(raw) {
  if (!raw || typeof raw !== "string") return null;

  const normalized = raw.trim().toUpperCase();

  // Require AM/PM to be present for typed input
  const hasAMPM = /\s*(AM|PM)\s*$/i.test(normalized);
  if (!hasAMPM) return null;

  // Extract time parts
  const match = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  // Validate ranges
  if (hours < 1 || hours > 12) return null;
  if (mins < 0 || mins > 59) return null;

  // Convert to 24-hour
  if (period === "AM") {
    if (hours === 12) hours = 0; // 12 AM = 0:xx
  } else {
    // PM
    if (hours !== 12) hours += 12; // 1-11 PM => 13-23
  }

  const minutes = hours * 60 + mins;
  return { minutes };
}

/**
 * Parse typed time input for TimePicker component.
 * Accepts two formats:
 *  1. 12-hour with AM/PM (required): "6:17 AM", "6:17AM", "06:17 am"
 *  2. Unambiguous 24-hour: "14:30", "00:17" (hour 0 or 13-23)
 *
 * Rejects ambiguous times (1-12 without AM/PM): "6:17", "12:30"
 *
 * @param {string} raw - Raw user input
 * @returns {{ minutes: number, canonical: string } | null}
 *   - minutes: 0-1439
 *   - canonical: HH:MM 24-hour format string
 *
 * @example
 * parseTypedTimeInput("6:17 AM")  // => { minutes: 377, canonical: "06:17" }
 * parseTypedTimeInput("14:30")    // => { minutes: 870, canonical: "14:30" }
 * parseTypedTimeInput("00:30")    // => { minutes: 30, canonical: "00:30" }
 * parseTypedTimeInput("6:17")     // => null (ambiguous)
 * parseTypedTimeInput("12:30")    // => null (ambiguous)
 */
export function parseTypedTimeInput(raw) {
  if (!raw || typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Try 12-hour format with AM/PM first
  const result12h = parseTimeInputToMinutes(trimmed);
  if (result12h) {
    const hours = Math.floor(result12h.minutes / 60);
    const mins = result12h.minutes % 60;
    const canonical = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    return { minutes: result12h.minutes, canonical };
  }

  // Try unambiguous 24-hour format (hour 0 or 13-23)
  const match24h = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24h) {
    const hours = parseInt(match24h[1], 10);
    const mins = parseInt(match24h[2], 10);

    // Validate ranges
    if (hours < 0 || hours > 23) return null;
    if (mins < 0 || mins > 59) return null;

    // Check if unambiguous: hour 0 (midnight) or 13-23 are unambiguous
    // Hours 1-12 are ambiguous without AM/PM
    if (hours >= 1 && hours <= 12) {
      return null; // Ambiguous - reject
    }

    const minutes = hours * 60 + mins;
    const canonical = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    return { minutes, canonical };
  }

  return null;
}

/**
 * Format minutes to 12-hour time string with AM/PM.
 * Handles negative values (previous day) by normalizing with modulo.
 *
 * @param {number} minutes - Minutes from midnight (can be negative for prev day)
 * @returns {string} - Formatted time, e.g. "11:30 PM"
 *
 * @example
 * formatMinutesToTime12h(377)  // => "6:17 AM"
 * formatMinutesToTime12h(-30)  // => "11:30 PM" (prev day, normalized)
 */
export function formatMinutesToTime12h(minutes) {
  // Normalize to 0-1439 for display
  const norm = ((minutes % 1440) + 1440) % 1440;
  return minutesToTime12h(norm);
}

/**
 * @typedef {'text' | 'absolute' | 'offset' | 'base' | 'empty'} CrewCallDisplayKind
 */

/**
 * @typedef {Object} EffectiveCrewCallResult
 * @property {CrewCallDisplayKind} kind - Type of display value
 * @property {string} display - Display string (time or text like "OFF")
 * @property {boolean} isPrevDay - True if effective time is previous day (effectiveMinutes < 0)
 * @property {number|null} effectiveMinutes - Effective minutes from midnight (can be negative)
 * @property {number|null} deltaMinutes - Delta from base (for badge display)
 */

/**
 * Compute the effective crew call display with proper precedence and prev-day support.
 *
 * Priority:
 * 1. callText (OFF/O/C/etc) => display text, no time computation
 * 2. absoluteCallMinutes (callTime) => display absolute time
 * 3. offset (direction + minutes) => compute from base, may be prev day
 * 4. baseMinutes => display base crew call
 * 5. empty => no value
 *
 * @param {Object} params
 * @param {number|null} params.baseMinutes - Base crew call in minutes (from day details)
 * @param {number|null} params.absoluteCallMinutes - Absolute override in minutes (from callTime)
 * @param {string|null} params.callText - Text override (OFF/O/C/etc)
 * @param {"early"|"delay"|null} params.offsetDirection - Offset direction
 * @param {number|null} params.offsetMinutes - Offset minutes
 * @returns {EffectiveCrewCallResult}
 *
 * @example
 * // Text override
 * computeEffectiveCrewCallDisplay({ callText: "OFF" })
 * // => { kind: "text", display: "OFF", isPrevDay: false, effectiveMinutes: null, deltaMinutes: null }
 *
 * // Offset causing prev day
 * computeEffectiveCrewCallDisplay({ baseMinutes: 30, offsetDirection: "early", offsetMinutes: 60 })
 * // => { kind: "offset", display: "11:30 PM", isPrevDay: true, effectiveMinutes: -30, deltaMinutes: -60 }
 */
export function computeEffectiveCrewCallDisplay({
  baseMinutes = null,
  absoluteCallMinutes = null,
  callText = null,
  offsetDirection = null,
  offsetMinutes = null,
}) {
  // 1. Text override (OFF/O/C/etc)
  if (callText && typeof callText === "string" && callText.trim()) {
    return {
      kind: "text",
      display: callText.trim(),
      isPrevDay: false,
      effectiveMinutes: null,
      deltaMinutes: null,
    };
  }

  // 2. Absolute time override
  if (typeof absoluteCallMinutes === "number" && Number.isFinite(absoluteCallMinutes)) {
    const delta =
      typeof baseMinutes === "number" && Number.isFinite(baseMinutes)
        ? absoluteCallMinutes - baseMinutes
        : null;
    return {
      kind: "absolute",
      display: formatMinutesToTime12h(absoluteCallMinutes),
      isPrevDay: false, // Absolute times are never prev day in this model
      effectiveMinutes: absoluteCallMinutes,
      deltaMinutes: delta,
    };
  }

  // 3. Offset from base
  if (
    offsetDirection &&
    typeof offsetMinutes === "number" &&
    offsetMinutes > 0 &&
    typeof baseMinutes === "number" &&
    Number.isFinite(baseMinutes)
  ) {
    const delta = offsetDirection === "early" ? -offsetMinutes : offsetMinutes;
    const effective = baseMinutes + delta;
    const isPrevDay = effective < 0;

    return {
      kind: "offset",
      display: formatMinutesToTime12h(effective),
      isPrevDay,
      effectiveMinutes: effective,
      deltaMinutes: delta,
    };
  }

  // 4. Base crew call (no override)
  if (typeof baseMinutes === "number" && Number.isFinite(baseMinutes)) {
    return {
      kind: "base",
      display: formatMinutesToTime12h(baseMinutes),
      isPrevDay: false,
      effectiveMinutes: baseMinutes,
      deltaMinutes: null,
    };
  }

  // 5. Empty
  return {
    kind: "empty",
    display: "",
    isPrevDay: false,
    effectiveMinutes: null,
    deltaMinutes: null,
  };
}

/**
 * Convert HH:MM time string to minutes from midnight (wrapper around parseTimeToMinutes).
 * Returns null if invalid.
 *
 * @param {string|null} timeStr - Time string in HH:MM format
 * @returns {number|null}
 */
export function timeStringToMinutes(timeStr) {
  if (!isTimeString(timeStr)) return null;
  const mins = parseTimeToMinutes(timeStr);
  return Number.isFinite(mins) ? mins : null;
}
