import { FirebaseError } from "firebase/app"

// Shared permission-denied branch for shot-write toast catch paths (5b role
// chip + toast copy). One helper instead of per-catch copies — consumed by
// ShotListPage, ShotDetailPageUnified, ShotStatusTapRow, BulkActionBar.
export const SHOT_PERMISSION_DENIED_DESCRIPTION =
  "You don't have permission to edit shots on this project."

export function isShotPermissionDenied(err: unknown): boolean {
  if (err instanceof FirebaseError) return err.code === "permission-denied"
  // String-match fallback (ProjectActionsMenu.tsx precedent): some write
  // paths surface plain Errors carrying only Firestore's message text.
  return (
    err instanceof Error &&
    err.message.includes("Missing or insufficient permissions")
  )
}

/**
 * Toast description for a failed shot write: the 5b permission copy on a
 * rules denial, otherwise the caller's fallback (which may be undefined to
 * keep today's description-less toasts unchanged).
 */
export function shotWriteErrorDescription(
  err: unknown,
  fallback?: string,
): string | undefined {
  return isShotPermissionDenied(err) ? SHOT_PERMISSION_DENIED_DESCRIPTION : fallback
}
