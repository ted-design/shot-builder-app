/**
 * Demo-Safe Firestore Wrappers
 *
 * These functions wrap Firestore write operations to block them in demo mode.
 * When demo mode is active, writes return fake success values without touching Firebase.
 * This allows optimistic UI updates to work while preventing data persistence.
 *
 * Usage: Import these instead of the raw firebase/firestore functions in files
 * that perform direct Firestore writes.
 */
import {
  addDoc as fbAddDoc,
  setDoc as fbSetDoc,
  updateDoc as fbUpdateDoc,
  deleteDoc as fbDeleteDoc,
  writeBatch as fbWriteBatch,
} from "firebase/firestore";
import { isDemoModeActive } from "./flags";

// Generate unique demo IDs for fake documents
let demoIdCounter = 0;
function generateDemoId() {
  demoIdCounter += 1;
  return `demo-${Date.now()}-${demoIdCounter}`;
}

/**
 * Demo-safe addDoc - returns fake document reference in demo mode
 * @param {CollectionReference} ref - Firestore collection reference
 * @param {object} data - Document data to add
 * @returns {Promise<{id: string}>} - Document reference (or fake one in demo mode)
 */
export async function addDoc(ref, data) {
  if (isDemoModeActive()) {
    const fakeId = generateDemoId();
    console.info("[Demo Mode] addDoc blocked, returning fake ID:", fakeId);
    // Return a minimal object that looks like a DocumentReference
    return { id: fakeId };
  }
  return fbAddDoc(ref, data);
}

/**
 * Demo-safe setDoc - no-op in demo mode
 * @param {DocumentReference} ref - Firestore document reference
 * @param {object} data - Document data to set
 * @param {object} options - Optional setDoc options (e.g., { merge: true })
 */
export async function setDoc(ref, data, options) {
  if (isDemoModeActive()) {
    console.info("[Demo Mode] setDoc blocked for:", ref?.path || "unknown");
    return;
  }
  return fbSetDoc(ref, data, options);
}

/**
 * Demo-safe updateDoc - no-op in demo mode
 * @param {DocumentReference} ref - Firestore document reference
 * @param {object} data - Fields to update
 */
export async function updateDoc(ref, data) {
  if (isDemoModeActive()) {
    console.info("[Demo Mode] updateDoc blocked for:", ref?.path || "unknown");
    return;
  }
  return fbUpdateDoc(ref, data);
}

/**
 * Demo-safe deleteDoc - no-op in demo mode
 * @param {DocumentReference} ref - Firestore document reference
 */
export async function deleteDoc(ref) {
  if (isDemoModeActive()) {
    console.info("[Demo Mode] deleteDoc blocked for:", ref?.path || "unknown");
    return;
  }
  return fbDeleteDoc(ref);
}

/**
 * Demo-safe writeBatch - returns mock batch in demo mode
 * The mock batch has the same API but commit() is a no-op.
 * @param {Firestore} db - Firestore database instance
 * @returns {WriteBatch} - Real or mock batch
 */
export function writeBatch(db) {
  if (isDemoModeActive()) {
    console.info("[Demo Mode] writeBatch created (commit will be no-op)");
    return {
      set: () => {
        console.info("[Demo Mode] Batch set queued (will not persist)");
      },
      update: () => {
        console.info("[Demo Mode] Batch update queued (will not persist)");
      },
      delete: () => {
        console.info("[Demo Mode] Batch delete queued (will not persist)");
      },
      commit: async () => {
        console.info("[Demo Mode] Batch commit blocked");
      },
    };
  }
  return fbWriteBatch(db);
}

// Re-export read operations unchanged (demo mode allows reads)
export {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  arrayRemove,
  increment,
  deleteField,
} from "firebase/firestore";
