/**
 * Firestore write operations for share link management.
 *
 * Handles three share link sources:
 *   - shotShares/{token} (root collection)
 *   - castingShares/{token} (root collection)
 *   - pulls/{pullId} (project-scoped subcollection)
 */

import {
  doc,
  updateDoc,
  deleteDoc,
  Timestamp,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { pullPath } from "@/shared/lib/paths"
import type { ShareLink } from "./shareLinkTypes"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shotShareRef(token: string) {
  return doc(db, "shotShares", token)
}

function castingShareRef(token: string) {
  return doc(db, "castingShares", token)
}

function pullDocRef(link: ShareLink) {
  const path = pullPath(link.sourceDocId, link.projectId, link.clientId)
  return doc(db, path[0]!, ...path.slice(1))
}

// ---------------------------------------------------------------------------
// Toggle enable/disable
// ---------------------------------------------------------------------------

export async function toggleShareLink(link: ShareLink): Promise<void> {
  const newEnabled = !link.enabled

  if (link.type === "shots") {
    await updateDoc(shotShareRef(link.id), { enabled: newEnabled })
  } else if (link.type === "casting") {
    await updateDoc(castingShareRef(link.id), { enabled: newEnabled })
  } else {
    await updateDoc(pullDocRef(link), {
      shareEnabled: newEnabled,
      updatedAt: serverTimestamp(),
    })
  }
}

// ---------------------------------------------------------------------------
// Set or clear expiry
// ---------------------------------------------------------------------------

export async function setShareLinkExpiry(
  link: ShareLink,
  expiresAt: Date | null,
): Promise<void> {
  const tsValue = expiresAt ? Timestamp.fromDate(expiresAt) : null

  if (link.type === "shots") {
    await updateDoc(shotShareRef(link.id), { expiresAt: tsValue })
  } else if (link.type === "casting") {
    await updateDoc(castingShareRef(link.id), { expiresAt: tsValue })
  } else {
    await updateDoc(pullDocRef(link), {
      shareExpireAt: tsValue,
      updatedAt: serverTimestamp(),
    })
  }
}

// ---------------------------------------------------------------------------
// Delete / revoke share link
// ---------------------------------------------------------------------------

export async function deleteShareLink(link: ShareLink): Promise<void> {
  if (link.type === "shots") {
    await deleteDoc(shotShareRef(link.id))
  } else if (link.type === "casting") {
    await deleteDoc(castingShareRef(link.id))
  } else {
    await updateDoc(pullDocRef(link), {
      shareEnabled: false,
      shareToken: null,
      shareExpireAt: null,
      updatedAt: serverTimestamp(),
    })
  }
}
