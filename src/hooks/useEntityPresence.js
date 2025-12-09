/**
 * Hook for subscribing to all locks on an entity
 *
 * Provides a view of who is currently editing what fields on an entity.
 * Useful for displaying "Alice is editing Name, Bob is editing Products".
 */

import { useEffect, useState, useMemo } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";
import { LOCK_EXPIRATION_MS } from "../types/versioning";

/**
 * Hook for subscribing to all presence/locks on an entity
 *
 * @param {string} clientId - Client ID
 * @param {string} entityType - Entity type (shots, productFamilies, talent, locations)
 * @param {string} entityId - Entity document ID
 * @param {object} options - Hook options
 * @param {boolean} options.enabled - Whether to enable the hook (default: true)
 * @param {boolean} options.excludeSelf - Exclude current user's locks (default: true)
 * @returns {object} { locks, activeEditors, isLoading }
 *
 * @example
 * const { activeEditors, locks } = useEntityPresence(clientId, 'shots', shotId);
 *
 * // Display active editors
 * activeEditors.forEach(editor => {
 *   console.log(`${editor.userName} is editing: ${editor.fields.join(', ')}`);
 * });
 *
 * // Check if a specific field is locked
 * if (locks['name']) {
 *   console.log(`Name field is locked by ${locks['name'].userName}`);
 * }
 */
export function useEntityPresence(clientId, entityType, entityId, options = {}) {
  const { user } = useAuth();
  const [presenceData, setPresenceData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const excludeSelf = options.excludeSelf !== false;

  const presenceRef =
    clientId && entityType && entityId
      ? doc(db, "clients", clientId, entityType, entityId, "presence")
      : null;

  // Check if a lock has expired
  const isLockExpired = (lock) => {
    if (!lock || !lock.heartbeat) return true;

    const heartbeatTime = lock.heartbeat.toDate
      ? lock.heartbeat.toDate()
      : new Date(lock.heartbeat);
    const now = new Date();
    return now - heartbeatTime > LOCK_EXPIRATION_MS;
  };

  // Subscribe to presence document
  useEffect(() => {
    if (!presenceRef || options.enabled === false) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    const unsubscribe = onSnapshot(
      presenceRef,
      (snapshot) => {
        setPresenceData(snapshot.exists() ? snapshot.data() : null);
        setIsLoading(false);
      },
      (error) => {
        console.error("[useEntityPresence] Subscription error:", error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [presenceRef, options.enabled]);

  // Filter and process locks
  const { locks, activeEditors } = useMemo(() => {
    if (!presenceData?.locks) {
      return { locks: {}, activeEditors: [] };
    }

    // Filter out expired locks and optionally current user's locks
    const validLocks = {};
    for (const [fieldPath, lock] of Object.entries(presenceData.locks)) {
      if (isLockExpired(lock)) continue;
      if (excludeSelf && lock.userId === user?.uid) continue;
      validLocks[fieldPath] = lock;
    }

    // Group locks by user for the activeEditors view
    const editorMap = new Map();
    for (const [fieldPath, lock] of Object.entries(validLocks)) {
      if (!editorMap.has(lock.userId)) {
        editorMap.set(lock.userId, {
          userId: lock.userId,
          userName: lock.userName,
          userAvatar: lock.userAvatar,
          fields: [],
          lastActivity: lock.heartbeat,
        });
      }
      editorMap.get(lock.userId).fields.push(fieldPath);

      // Track latest activity
      const existing = editorMap.get(lock.userId);
      const lockTime = lock.heartbeat?.toDate?.() || new Date(0);
      const existingTime = existing.lastActivity?.toDate?.() || new Date(0);
      if (lockTime > existingTime) {
        existing.lastActivity = lock.heartbeat;
      }
    }

    const activeEditors = Array.from(editorMap.values()).sort((a, b) => {
      // Sort by most recent activity
      const aTime = a.lastActivity?.toDate?.() || new Date(0);
      const bTime = b.lastActivity?.toDate?.() || new Date(0);
      return bTime - aTime;
    });

    return { locks: validLocks, activeEditors };
  }, [presenceData, user?.uid, excludeSelf]);

  return {
    locks,
    activeEditors,
    isLoading,
    hasActiveEditors: activeEditors.length > 0,
  };
}

/**
 * Format field names for display
 *
 * @param {string[]} fields - Array of field paths
 * @returns {string} Human-readable field list
 */
export function formatFieldNames(fields) {
  if (!fields || fields.length === 0) return "";

  const fieldLabels = {
    name: "Name",
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
    email: "Email",
    phone: "Phone",
    agency: "Agency",
    street: "Address",
    city: "City",
  };

  const formatted = fields.map((f) => fieldLabels[f] || f);

  if (formatted.length === 1) {
    return formatted[0];
  }

  if (formatted.length === 2) {
    return `${formatted[0]} and ${formatted[1]}`;
  }

  return `${formatted.slice(0, -1).join(", ")}, and ${formatted[formatted.length - 1]}`;
}

/**
 * Get a summary of active editors for display
 *
 * @param {Array} activeEditors - Array of active editors
 * @returns {string} Human-readable summary
 */
export function formatActiveEditorsSummary(activeEditors) {
  if (!activeEditors || activeEditors.length === 0) {
    return "";
  }

  if (activeEditors.length === 1) {
    const editor = activeEditors[0];
    return `${editor.userName} is editing ${formatFieldNames(editor.fields)}`;
  }

  if (activeEditors.length === 2) {
    return `${activeEditors[0].userName} and ${activeEditors[1].userName} are editing`;
  }

  return `${activeEditors[0].userName} and ${activeEditors.length - 1} others are editing`;
}
