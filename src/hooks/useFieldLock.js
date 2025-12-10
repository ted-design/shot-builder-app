/**
 * Hook for field-level locking in collaborative editing
 *
 * Provides real-time field locking to prevent simultaneous edits
 * to the same field by multiple users.
 *
 * Features:
 * - Acquire/release locks on specific fields
 * - Heartbeat to maintain lock ownership
 * - Auto-release on unmount
 * - Real-time lock status updates
 */

import { useEffect, useRef, useCallback, useState } from "react";
import {
  doc,
  setDoc,
  updateDoc,
  deleteField,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import {
  LOCK_HEARTBEAT_INTERVAL_MS,
  LOCK_EXPIRATION_MS,
} from "../types/versioning";
import { isDemoModeActive } from "../lib/flags";

/**
 * Hook for acquiring and managing a field lock
 *
 * @param {string} clientId - Client ID
 * @param {string} entityType - Entity type (shots, productFamilies, talent, locations)
 * @param {string} entityId - Entity document ID
 * @param {string} fieldPath - The field path to lock (e.g., "name", "description")
 * @param {object} options - Hook options
 * @param {boolean} options.enabled - Whether to enable the hook (default: true)
 * @returns {object} Lock management interface
 *
 * @example
 * const { acquireLock, releaseLock, isLocked, lockedBy } = useFieldLock(
 *   clientId, 'shots', shotId, 'name'
 * );
 *
 * // On field focus
 * const canEdit = await acquireLock();
 * if (!canEdit) {
 *   toast.info({ title: `${lockedBy.userName} is editing this field` });
 * }
 *
 * // On field blur
 * await releaseLock();
 */
export function useFieldLock(clientId, entityType, entityId, fieldPath, options = {}) {
  const { user } = useAuth();
  const isDemo = isDemoModeActive();

  const [lockState, setLockState] = useState({
    isLocked: false,
    lockedBy: null,
    hasLock: isDemo, // In demo mode, always have lock
  });
  const [isAcquiring, setIsAcquiring] = useState(false);

  const heartbeatIntervalRef = useRef(null);
  const hasLockRef = useRef(false);

  const presenceRef = clientId && entityType && entityId && !isDemo
    ? doc(db, "clients", clientId, entityType, entityId, "presence", "state")
    : null;

  // Check if a lock has expired
  const isLockExpired = useCallback((lock) => {
    if (!lock || !lock.heartbeat) return true;

    const heartbeatTime = lock.heartbeat.toDate
      ? lock.heartbeat.toDate()
      : new Date(lock.heartbeat);
    const now = new Date();
    return now - heartbeatTime > LOCK_EXPIRATION_MS;
  }, []);

  // Subscribe to presence document for real-time lock status
  useEffect(() => {
    if (!presenceRef || !fieldPath || options.enabled === false) {
      return;
    }

    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        const data = snapshot.data();
        const locks = data?.locks || {};
        const lock = locks[fieldPath];

        if (!lock || isLockExpired(lock)) {
          setLockState({
            isLocked: false,
            lockedBy: null,
            hasLock: hasLockRef.current,
          });
        } else if (lock.userId === user?.uid) {
          setLockState({
            isLocked: false,
            lockedBy: null,
            hasLock: true,
          });
          hasLockRef.current = true;
        } else {
          setLockState({
            isLocked: true,
            lockedBy: {
              userId: lock.userId,
              userName: lock.userName,
              userAvatar: lock.userAvatar,
            },
            hasLock: false,
          });
          hasLockRef.current = false;
        }
      },
      (error) => {
        console.error("[useFieldLock] Subscription error:", error);
      }
    );

    return () => unsubscribe();
  }, [presenceRef, fieldPath, user?.uid, options.enabled, isLockExpired]);

  // Cleanup heartbeat on unmount
  useEffect(() => {
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
    };
  }, []);

  // Acquire lock
  const acquireLock = useCallback(async () => {
    // Demo mode: always succeed
    if (isDemo) {
      return true;
    }

    if (!presenceRef || !user || !fieldPath) {
      return false;
    }

    // If already locked by someone else, can't acquire
    if (lockState.isLocked && !lockState.hasLock) {
      return false;
    }

    // If we already have the lock, just return true
    if (lockState.hasLock) {
      return true;
    }

    setIsAcquiring(true);

    try {
      // Use setDoc with merge to create presence doc if it doesn't exist
      await setDoc(
        presenceRef,
        {
          locks: {
            [fieldPath]: {
              userId: user.uid,
              userName: user.displayName || user.email || "Unknown User",
              userAvatar: user.photoURL || null,
              fieldPath,
              acquiredAt: serverTimestamp(),
              heartbeat: serverTimestamp(),
            },
          },
          lastActivity: serverTimestamp(),
        },
        { merge: true }
      );

      hasLockRef.current = true;

      // Start heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          await updateDoc(presenceRef, {
            [`locks.${fieldPath}.heartbeat`]: serverTimestamp(),
            lastActivity: serverTimestamp(),
          });
        } catch (error) {
          console.error("[useFieldLock] Heartbeat failed:", error);
          // If heartbeat fails, release the lock
          hasLockRef.current = false;
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
          }
        }
      }, LOCK_HEARTBEAT_INTERVAL_MS);

      return true;
    } catch (error) {
      console.error("[useFieldLock] Failed to acquire lock:", error);
      return false;
    } finally {
      setIsAcquiring(false);
    }
  }, [presenceRef, user, fieldPath, lockState.isLocked, lockState.hasLock]);

  // Release lock
  const releaseLock = useCallback(async () => {
    if (!presenceRef || !fieldPath || !hasLockRef.current) {
      return;
    }

    // Stop heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    hasLockRef.current = false;

    try {
      await updateDoc(presenceRef, {
        [`locks.${fieldPath}`]: deleteField(),
        lastActivity: serverTimestamp(),
      });
    } catch (error) {
      console.error("[useFieldLock] Failed to release lock:", error);
    }
  }, [presenceRef, fieldPath]);

  // Auto-release lock on unmount
  useEffect(() => {
    return () => {
      if (hasLockRef.current && presenceRef && fieldPath) {
        // Fire and forget - don't await in cleanup
        updateDoc(presenceRef, {
          [`locks.${fieldPath}`]: deleteField(),
        }).catch((error) => {
          console.error("[useFieldLock] Cleanup release failed:", error);
        });
      }
    };
  }, [presenceRef, fieldPath]);

  return {
    acquireLock,
    releaseLock,
    isLocked: lockState.isLocked,
    lockedBy: lockState.lockedBy,
    hasLock: lockState.hasLock,
    isAcquiring,
  };
}

/**
 * Utility function to create the presence document if it doesn't exist
 * Should be called when first opening an entity for editing
 */
export async function ensurePresenceDocument(clientId, entityType, entityId) {
  if (!clientId || !entityType || !entityId) return;

  // Demo mode: skip presence document creation
  if (isDemoModeActive()) {
    return;
  }

  try {
    const presenceRef = doc(
      db,
      "clients",
      clientId,
      entityType,
      entityId,
      "presence",
      "state"
    );

    // Use merge: true to create if not exists
    const { setDoc } = await import("firebase/firestore");
    await setDoc(
      presenceRef,
      {
        locks: {},
        lastActivity: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error("[ensurePresenceDocument] Failed:", error);
  }
}
