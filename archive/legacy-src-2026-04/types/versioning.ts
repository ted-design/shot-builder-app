/**
 * Types for version history and field-level locking
 *
 * Version History: Full document snapshots saved on every edit
 * Field Locking: Real-time indicators when another user is editing a field
 */

import { Timestamp } from "firebase/firestore";

// ============================================================================
// Version History Types
// ============================================================================

/**
 * Supported entity types for versioning
 */
export type VersionedEntityType = "shots" | "productFamilies" | "talent" | "locations";

/**
 * Type of change that created this version
 */
export type VersionChangeType = "create" | "update" | "rollback";

/**
 * A snapshot of a document at a specific point in time
 * Stored in: /clients/{clientId}/{entityType}/{entityId}/versions/{versionId}
 */
export interface DocumentVersion {
  /** Auto-generated Firestore ID */
  id: string;

  /** Full document state at this point in time */
  snapshot: Record<string, unknown>;

  /** When this version was created */
  createdAt: Timestamp;

  /** User ID who made this change */
  createdBy: string;

  /** Display name of user (denormalized for UI) */
  createdByName: string;

  /** Avatar URL of user (denormalized for UI) */
  createdByAvatar: string | null;

  /** Type of change that created this version */
  changeType: VersionChangeType;

  /** List of field names that changed from previous version */
  changedFields: string[];

  /** When this version expires and should be deleted (15 days from creation) */
  expiresAt: Date;
}

/**
 * Data required to create a new version (without auto-generated fields)
 */
export interface CreateVersionData {
  snapshot: Record<string, unknown>;
  createdBy: string;
  createdByName: string;
  createdByAvatar: string | null;
  changeType: VersionChangeType;
  changedFields: string[];
}

// ============================================================================
// Field Locking / Presence Types
// ============================================================================

/**
 * A lock on a specific field by a user
 */
export interface FieldLock {
  /** User ID who holds the lock */
  userId: string;

  /** Display name of user */
  userName: string;

  /** Avatar URL of user */
  userAvatar: string | null;

  /** The field path being edited (e.g., "name", "description", "products") */
  fieldPath: string;

  /** When the lock was first acquired */
  acquiredAt: Timestamp;

  /** Last heartbeat timestamp - updated every 30s, expires after 60s */
  heartbeat: Timestamp;
}

/**
 * Presence document for an entity
 * Stored in: /clients/{clientId}/{entityType}/{entityId}/presence
 */
export interface EntityPresence {
  /** Map of fieldPath -> lock info */
  locks: Record<string, FieldLock>;

  /** Last activity timestamp for this document */
  lastActivity: Timestamp;
}

/**
 * Active editor info grouped by user (for UI display)
 */
export interface ActiveEditor {
  userId: string;
  userName: string;
  userAvatar: string | null;
  fields: string[];
  lastActivity: Timestamp;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useVersionHistory hook
 */
export interface UseVersionHistoryResult {
  /** List of versions, newest first */
  versions: DocumentVersion[];

  /** Loading state */
  isLoading: boolean;

  /** Error if fetch failed */
  error: Error | null;

  /** Refetch versions */
  refetch: () => void;
}

/**
 * Return type for useFieldLock hook
 */
export interface UseFieldLockResult {
  /** Acquire the lock for this field */
  acquireLock: () => Promise<boolean>;

  /** Release the lock */
  releaseLock: () => Promise<void>;

  /** Is this field locked by someone else? */
  isLocked: boolean;

  /** Who has the lock (if locked by someone else) */
  lockedBy: { userId: string; userName: string; userAvatar: string | null } | null;

  /** Do I currently have the lock? */
  hasLock: boolean;

  /** Is lock acquisition in progress? */
  isAcquiring: boolean;
}

/**
 * Return type for useEntityPresence hook
 */
export interface UseEntityPresenceResult {
  /** All current locks on this entity */
  locks: Record<string, FieldLock>;

  /** Active editors grouped by user */
  activeEditors: ActiveEditor[];

  /** Loading state */
  isLoading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Version retention period in days
 */
export const VERSION_RETENTION_DAYS = 15;

/**
 * Heartbeat interval in milliseconds (30 seconds)
 */
export const LOCK_HEARTBEAT_INTERVAL_MS = 30 * 1000;

/**
 * Lock expiration time in milliseconds (60 seconds without heartbeat)
 */
export const LOCK_EXPIRATION_MS = 60 * 1000;

/**
 * Maximum versions to fetch in a single query
 */
export const MAX_VERSIONS_PER_QUERY = 50;
