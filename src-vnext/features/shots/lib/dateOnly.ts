import { Timestamp } from "firebase/firestore"

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Format a Firestore Timestamp as a UTC date-only string (YYYY-MM-DD).
 * Returns "" if the timestamp is null/undefined.
 */
export function formatDateOnly(
  ts: Timestamp | null | undefined,
): string {
  if (!ts) return ""
  return ts.toDate().toISOString().slice(0, 10)
}

/**
 * Parse a YYYY-MM-DD string into a Firestore Timestamp at UTC midnight.
 * Returns null for empty strings. Throws for invalid date strings.
 */
export function parseDateOnly(value: string): Timestamp | null {
  const trimmed = value.trim()
  if (trimmed === "") return null

  if (!DATE_ONLY_RE.test(trimmed)) {
    throw new Error(`Invalid date format: "${trimmed}" (expected YYYY-MM-DD)`)
  }

  const d = new Date(`${trimmed}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: "${trimmed}"`)
  }

  // Verify the parsed date components match the input to catch impossible dates
  // like 2026-02-30 which JS silently rolls over to March
  const [year, month, day] = trimmed.split("-").map(Number)
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() + 1 !== month ||
    d.getUTCDate() !== day
  ) {
    throw new Error(`Invalid date: "${trimmed}" (date does not exist)`)
  }

  return Timestamp.fromDate(d)
}
