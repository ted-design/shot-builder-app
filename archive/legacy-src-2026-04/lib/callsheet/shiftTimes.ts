import { minutesToTimeString, parseTimeToMinutes } from "../timeUtils";

export function isHHMM(value: unknown) {
  return typeof value === "string" && /^\d{1,2}:\d{2}$/.test(value.trim());
}

export function shiftTimeString(time: unknown, deltaMinutes: number): string | null {
  if (!isHHMM(time)) return null;
  if (!Number.isFinite(deltaMinutes) || deltaMinutes === 0) return String(time).trim();
  const base = parseTimeToMinutes(String(time).trim());
  const next = base + deltaMinutes;
  return minutesToTimeString(next);
}

