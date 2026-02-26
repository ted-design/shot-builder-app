import { useEffect, useMemo, useState } from "react"
import { doc, onSnapshot } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import {
  LOCK_EXPIRATION_MS,
  type ActiveEditor,
  type EntityPresence,
  type FieldLock,
  type UseEntityPresenceResult,
} from "@/shared/types/presence"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isLockExpired(lock: FieldLock): boolean {
  if (!lock.heartbeat) return true
  const heartbeatTime =
    typeof lock.heartbeat.toDate === "function"
      ? lock.heartbeat.toDate()
      : new Date(lock.heartbeat as unknown as string)
  return Date.now() - heartbeatTime.getTime() > LOCK_EXPIRATION_MS
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribe to all presence/locks on an entity.
 *
 * Returns active editors (excluding self) grouped by user, with expired locks
 * filtered out client-side.
 */
export function useEntityPresence(
  clientId: string | null,
  entityType: string,
  entityId: string | undefined,
  options: { enabled?: boolean; excludeSelf?: boolean } = {},
): UseEntityPresenceResult {
  const { user } = useAuth()
  const [presenceData, setPresenceData] = useState<EntityPresence | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const excludeSelf = options.excludeSelf !== false
  const enabled = options.enabled !== false

  const pathKey =
    clientId && entityType && entityId
      ? `clients/${clientId}/${entityType}/${entityId}/presence/state`
      : null

  useEffect(() => {
    if (!pathKey || !enabled) {
      setPresenceData(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    const presenceRef = doc(db, pathKey)
    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        setPresenceData(
          snapshot.exists()
            ? (snapshot.data() as EntityPresence)
            : null,
        )
        setIsLoading(false)
      },
      (err) => {
        console.error("[useEntityPresence] Subscription error:", err)
        setIsLoading(false)
      },
    )

    return unsubscribe
  }, [pathKey, enabled])

  const { locks, activeEditors } = useMemo(() => {
    if (!presenceData?.locks) {
      return { locks: {} as Record<string, FieldLock>, activeEditors: [] as ActiveEditor[] }
    }

    // Filter expired + optionally self
    const validLocks: Record<string, FieldLock> = {}
    for (const [fieldPath, lock] of Object.entries(presenceData.locks)) {
      if (isLockExpired(lock)) continue
      if (excludeSelf && lock.userId === user?.uid) continue
      validLocks[fieldPath] = lock
    }

    // Group by user
    const editorMap = new Map<string, ActiveEditor>()
    for (const [fieldPath, lock] of Object.entries(validLocks)) {
      const existing = editorMap.get(lock.userId)
      if (existing) {
        existing.fields.push(fieldPath)
        // Track latest activity
        const lockTime =
          typeof lock.heartbeat.toDate === "function"
            ? lock.heartbeat.toDate()
            : new Date(0)
        const existingTime =
          typeof existing.lastActivity.toDate === "function"
            ? existing.lastActivity.toDate()
            : new Date(0)
        if (lockTime > existingTime) {
          existing.lastActivity = lock.heartbeat
        }
      } else {
        editorMap.set(lock.userId, {
          userId: lock.userId,
          userName: lock.userName,
          userAvatar: lock.userAvatar,
          fields: [fieldPath],
          lastActivity: lock.heartbeat,
        })
      }
    }

    const editors = Array.from(editorMap.values()).sort((a, b) => {
      const aTime =
        typeof a.lastActivity.toDate === "function"
          ? a.lastActivity.toDate().getTime()
          : 0
      const bTime =
        typeof b.lastActivity.toDate === "function"
          ? b.lastActivity.toDate().getTime()
          : 0
      return bTime - aTime
    })

    return { locks: validLocks, activeEditors: editors }
  }, [presenceData, user?.uid, excludeSelf])

  return {
    locks,
    activeEditors,
    isLoading,
    hasActiveEditors: activeEditors.length > 0,
  }
}
