/**
 * Recursively strips `undefined` values from objects and arrays
 * to prevent Firestore "Cannot use 'undefined' as a Firestore value" errors.
 *
 * - Top-level `undefined` → `null`
 * - Object keys with `undefined` values → omitted
 * - Array elements: recursed (undefined → null within arrays)
 * - Firestore sentinel objects (serverTimestamp, etc.) → passed through
 * - Primitives, null, Date → passed through
 */
export function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null || typeof value !== "object") return value
  if (Array.isArray(value)) return value.map(sanitizeForFirestore)
  // Preserve Firestore sentinel objects (e.g. serverTimestamp())
  // They have an internal _methodName property
  if ("_methodName" in (value as Record<string, unknown>)) return value
  // Preserve Date objects and Firestore Timestamps
  if (value instanceof Date) return value
  if ("toDate" in (value as Record<string, unknown>)) return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) {
      out[k] = sanitizeForFirestore(v)
    }
  }
  return out
}
