import { useCallback, useEffect, useRef, useState } from "react"
import {
  doc,
  setDoc,
  updateDoc,
  deleteField,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import {
  LOCK_HEARTBEAT_INTERVAL_MS,
  LOCK_EXPIRATION_MS,
  type FieldLock,
  type UseFieldLockResult,
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
 * Acquire / release a field-level lock for collaborative editing.
 *
 * Writes to `/clients/{clientId}/{entityType}/{entityId}/presence/state`
 * using a merged `locks` map keyed by `fieldPath`.
 *
 * - 30 s heartbeat keeps the lock alive.
 * - Lock auto-releases on unmount.
 * - Other users see this lock via `useEntityPresence`.
 */
export function useFieldLock(
  clientId: string | null,
  entityType: string,
  entityId: string | undefined,
  fieldPath: string,
  options: { enabled?: boolean } = {},
): UseFieldLockResult {
  const { user } = useAuth()

  const [lockState, setLockState] = useState<{
    isLocked: boolean
    lockedBy: { userId: string; userName: string; userAvatar: string | null } | null
    hasLock: boolean
  }>({ isLocked: false, lockedBy: null, hasLock: false })

  const [isAcquiring, setIsAcquiring] = useState(false)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasLockRef = useRef(false)

  const presencePath =
    clientId && entityType && entityId
      ? `clients/${clientId}/${entityType}/${entityId}/presence/state`
      : null

  // Subscribe to lock status for this field
  useEffect(() => {
    if (!presencePath || !fieldPath || options.enabled === false) return

    const presenceRef = doc(db, presencePath)
    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        const data = snapshot.data() as { locks?: Record<string, FieldLock> } | undefined
        const lock = data?.locks?.[fieldPath]

        if (!lock || isLockExpired(lock)) {
          setLockState({ isLocked: false, lockedBy: null, hasLock: hasLockRef.current })
        } else if (lock.userId === user?.uid) {
          hasLockRef.current = true
          setLockState({ isLocked: false, lockedBy: null, hasLock: true })
        } else {
          hasLockRef.current = false
          setLockState({
            isLocked: true,
            lockedBy: {
              userId: lock.userId,
              userName: lock.userName,
              userAvatar: lock.userAvatar,
            },
            hasLock: false,
          })
        }
      },
      (err) => {
        console.error("[useFieldLock] Subscription error:", err)
      },
    )

    return unsubscribe
  }, [presencePath, fieldPath, user?.uid, options.enabled])

  // Clean up heartbeat on unmount
  useEffect(() => {
    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current)
        heartbeatRef.current = null
      }
    }
  }, [])

  const acquireLock = useCallback(async (): Promise<boolean> => {
    if (!presencePath || !user || !fieldPath) return false
    if (lockState.isLocked && !lockState.hasLock) return false
    if (lockState.hasLock) return true

    setIsAcquiring(true)
    try {
      const presenceRef = doc(db, presencePath)
      await setDoc(
        presenceRef,
        {
          locks: {
            [fieldPath]: {
              userId: user.uid,
              userName: user.displayName ?? user.email ?? "Unknown",
              userAvatar: user.photoURL ?? null,
              fieldPath,
              acquiredAt: serverTimestamp(),
              heartbeat: serverTimestamp(),
            },
          },
          lastActivity: serverTimestamp(),
        },
        { merge: true },
      )

      hasLockRef.current = true

      // Start heartbeat
      if (heartbeatRef.current) clearInterval(heartbeatRef.current)
      heartbeatRef.current = setInterval(async () => {
        try {
          await updateDoc(doc(db, presencePath), {
            [`locks.${fieldPath}.heartbeat`]: serverTimestamp(),
            lastActivity: serverTimestamp(),
          })
        } catch {
          hasLockRef.current = false
          if (heartbeatRef.current) {
            clearInterval(heartbeatRef.current)
            heartbeatRef.current = null
          }
        }
      }, LOCK_HEARTBEAT_INTERVAL_MS)

      return true
    } catch (err) {
      console.error("[useFieldLock] Failed to acquire lock:", err)
      return false
    } finally {
      setIsAcquiring(false)
    }
  }, [presencePath, user, fieldPath, lockState.isLocked, lockState.hasLock])

  const releaseLock = useCallback(async (): Promise<void> => {
    if (!presencePath || !fieldPath || !hasLockRef.current) return

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    hasLockRef.current = false

    try {
      await updateDoc(doc(db, presencePath), {
        [`locks.${fieldPath}`]: deleteField(),
        lastActivity: serverTimestamp(),
      })
    } catch (err) {
      console.error("[useFieldLock] Failed to release lock:", err)
    }
  }, [presencePath, fieldPath])

  // Auto-release on unmount
  useEffect(() => {
    return () => {
      if (hasLockRef.current && presencePath && fieldPath) {
        updateDoc(doc(db, presencePath), {
          [`locks.${fieldPath}`]: deleteField(),
        }).catch(() => {
          // Best-effort cleanup
        })
      }
    }
  }, [presencePath, fieldPath])

  return {
    acquireLock,
    releaseLock,
    isLocked: lockState.isLocked,
    lockedBy: lockState.lockedBy,
    hasLock: lockState.hasLock,
    isAcquiring,
  }
}
