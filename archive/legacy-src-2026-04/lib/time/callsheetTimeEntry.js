import { parseTypedTimeInput } from "./crewCallEffective";

const TIME_LIKE_PATTERN = /^\d{1,2}:\d{2}(?:\s*(?:AM|PM))?$/i;

function parseTwentyFourHourTime(rawValue) {
  const match = rawValue.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minutes)) return null;
  if (hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null;

  return `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Classify callsheet time input into canonical storage categories.
 *
 * Rules:
 * - Empty -> empty
 * - Valid time -> time (canonical HH:MM)
 * - Time-like but invalid -> invalid-time
 * - Non-time text -> text (only when allowText=true), else invalid-time
 */
export function classifyCallsheetTimeInput(rawValue, options = {}) {
  const allowText = options.allowText === true;
  const trimmed = typeof rawValue === "string" ? rawValue.trim() : "";

  if (!trimmed) {
    return { kind: "empty", canonical: null, text: null };
  }

  const parsed = parseTypedTimeInput(trimmed);
  if (parsed) {
    return { kind: "time", canonical: parsed.canonical, text: null };
  }

  const parsed24h = parseTwentyFourHourTime(trimmed);
  if (parsed24h) {
    return { kind: "time", canonical: parsed24h, text: null };
  }

  if (TIME_LIKE_PATTERN.test(trimmed)) {
    return { kind: "invalid-time", canonical: null, text: null };
  }

  if (allowText) {
    return { kind: "text", canonical: null, text: trimmed };
  }

  return { kind: "invalid-time", canonical: null, text: null };
}
