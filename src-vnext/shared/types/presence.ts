import type { Timestamp } from "firebase/firestore"

// ---------------------------------------------------------------------------
// Field Locking
// ---------------------------------------------------------------------------

/** A lock on a specific field by a user */
export interface FieldLock {
  userId: string
  userName: string
  userAvatar: string | null
  fieldPath: string
  acquiredAt: Timestamp
  /** Updated every LOCK_HEARTBEAT_INTERVAL_MS; expired after LOCK_EXPIRATION_MS */
  heartbeat: Timestamp
}

/**
 * Presence document for an entity.
 * Stored at: /clients/{clientId}/{entityType}/{entityId}/presence/state
 */
export interface EntityPresence {
  locks: Record<string, FieldLock>
  lastActivity: Timestamp
}

/** Active editor info grouped by user (for UI display) */
export interface ActiveEditor {
  userId: string
  userName: string
  userAvatar: string | null
  fields: string[]
  lastActivity: Timestamp
}

// ---------------------------------------------------------------------------
// Hook return types
// ---------------------------------------------------------------------------

export interface UseEntityPresenceResult {
  locks: Record<string, FieldLock>
  activeEditors: ActiveEditor[]
  isLoading: boolean
  hasActiveEditors: boolean
}

export interface UseFieldLockResult {
  acquireLock: () => Promise<boolean>
  releaseLock: () => Promise<void>
  isLocked: boolean
  lockedBy: { userId: string; userName: string; userAvatar: string | null } | null
  hasLock: boolean
  isAcquiring: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Heartbeat interval — 30 seconds */
export const LOCK_HEARTBEAT_INTERVAL_MS = 30_000

/** Lock expiration — 60 seconds without heartbeat */
export const LOCK_EXPIRATION_MS = 60_000

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Human-readable field labels for the presence bar */
const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  title: "Title",
  description: "Description",
  notes: "Notes",
  status: "Status",
  date: "Date",
  talent: "Talent",
  products: "Products",
  location: "Location",
  locationId: "Location",
  tags: "Tags",
  styleName: "Style Name",
  styleNumber: "Style Number",
}

export function formatFieldNames(fields: readonly string[]): string {
  if (fields.length === 0) return ""

  const formatted = fields.map((f) => FIELD_LABELS[f] ?? f)

  if (formatted.length === 1) return formatted[0]
  if (formatted.length === 2) return `${formatted[0]} and ${formatted[1]}`
  return `${formatted.slice(0, -1).join(", ")}, and ${formatted[formatted.length - 1]}`
}

export function formatActiveEditorsSummary(editors: readonly ActiveEditor[]): string {
  if (editors.length === 0) return ""
  if (editors.length === 1) {
    return `${editors[0].userName} is editing ${formatFieldNames(editors[0].fields)}`
  }
  if (editors.length === 2) {
    return `${editors[0].userName} and ${editors[1].userName} are editing`
  }
  return `${editors[0].userName} and ${editors.length - 1} others are editing`
}
