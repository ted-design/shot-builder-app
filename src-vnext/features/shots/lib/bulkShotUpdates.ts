/**
 * Batch update operations for shots.
 *
 * All functions follow the established pattern from `bulkSoftDeleteShots`:
 * - writeBatch chunked at 250
 * - Max 500 shots per call
 * - Version snapshots skipped on bulk operations
 * - Fire-and-forget: caller handles toast feedback
 */

import { doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import type { AuthUser, Shot, ShotFirestoreStatus, ShotTag } from "@/shared/types"

const BULK_CHUNK_SIZE = 250
const MAX_BULK_OPS = 500

function userMeta(user: AuthUser | null): Record<string, unknown> {
  return user?.uid ? { updatedBy: user.uid } : {}
}

function buildDocRef(shotId: string, clientId: string) {
  const path = shotPath(shotId, clientId)
  return doc(db, path[0]!, ...path.slice(1))
}

// ---------------------------------------------------------------------------
// Uniform payload operations (same payload for every shot)
// ---------------------------------------------------------------------------

export async function bulkUpdateShotStatus(
  clientId: string,
  shotIds: readonly string[],
  newStatus: ShotFirestoreStatus,
  user: AuthUser | null,
): Promise<number> {
  if (shotIds.length === 0) return 0
  if (shotIds.length > MAX_BULK_OPS) {
    throw new Error(`Cannot update more than ${MAX_BULK_OPS} shots at once.`)
  }

  let updated = 0
  for (let i = 0; i < shotIds.length; i += BULK_CHUNK_SIZE) {
    const chunk = shotIds.slice(i, i + BULK_CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const shotId of chunk) {
      batch.update(buildDocRef(shotId, clientId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        ...userMeta(user),
      })
    }
    await batch.commit()
    updated += chunk.length
  }
  return updated
}

export async function bulkUpdateLocation(
  clientId: string,
  shotIds: readonly string[],
  locationId: string | null,
  locationName: string | null,
  user: AuthUser | null,
): Promise<number> {
  if (shotIds.length === 0) return 0
  if (shotIds.length > MAX_BULK_OPS) {
    throw new Error(`Cannot update more than ${MAX_BULK_OPS} shots at once.`)
  }

  let updated = 0
  for (let i = 0; i < shotIds.length; i += BULK_CHUNK_SIZE) {
    const chunk = shotIds.slice(i, i + BULK_CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const shotId of chunk) {
      batch.update(buildDocRef(shotId, clientId), {
        locationId: locationId ?? null,
        locationName: locationName ?? null,
        updatedAt: serverTimestamp(),
        ...userMeta(user),
      })
    }
    await batch.commit()
    updated += chunk.length
  }
  return updated
}

// ---------------------------------------------------------------------------
// Per-shot merge operations (payload varies per shot)
// ---------------------------------------------------------------------------

export async function bulkApplyTags(
  clientId: string,
  shots: ReadonlyArray<Shot>,
  tagsToAdd: readonly ShotTag[],
  user: AuthUser | null,
): Promise<number> {
  if (shots.length === 0 || tagsToAdd.length === 0) return 0
  if (shots.length > MAX_BULK_OPS) {
    throw new Error(`Cannot update more than ${MAX_BULK_OPS} shots at once.`)
  }

  const addIds = new Set(tagsToAdd.map((t) => t.id))
  let updated = 0

  for (let i = 0; i < shots.length; i += BULK_CHUNK_SIZE) {
    const chunk = shots.slice(i, i + BULK_CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const shot of chunk) {
      const existing = shot.tags ?? []
      const merged = [...existing.filter((t) => !addIds.has(t.id)), ...tagsToAdd]
      batch.update(buildDocRef(shot.id, clientId), {
        tags: merged,
        updatedAt: serverTimestamp(),
        ...userMeta(user),
      })
    }
    await batch.commit()
    updated += chunk.length
  }
  return updated
}

export async function bulkRemoveTags(
  clientId: string,
  shots: ReadonlyArray<Shot>,
  tagIdsToRemove: ReadonlySet<string>,
  user: AuthUser | null,
): Promise<number> {
  if (shots.length === 0 || tagIdsToRemove.size === 0) return 0
  if (shots.length > MAX_BULK_OPS) {
    throw new Error(`Cannot update more than ${MAX_BULK_OPS} shots at once.`)
  }

  let updated = 0
  for (let i = 0; i < shots.length; i += BULK_CHUNK_SIZE) {
    const chunk = shots.slice(i, i + BULK_CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const shot of chunk) {
      const existing = shot.tags ?? []
      const filtered = existing.filter((t) => !tagIdsToRemove.has(t.id))
      batch.update(buildDocRef(shot.id, clientId), {
        tags: filtered,
        updatedAt: serverTimestamp(),
        ...userMeta(user),
      })
    }
    await batch.commit()
    updated += chunk.length
  }
  return updated
}

export async function bulkAddTalent(
  clientId: string,
  shots: ReadonlyArray<Shot>,
  talentIdsToAdd: readonly string[],
  user: AuthUser | null,
): Promise<number> {
  if (shots.length === 0 || talentIdsToAdd.length === 0) return 0
  if (shots.length > MAX_BULK_OPS) {
    throw new Error(`Cannot update more than ${MAX_BULK_OPS} shots at once.`)
  }

  let updated = 0
  for (let i = 0; i < shots.length; i += BULK_CHUNK_SIZE) {
    const chunk = shots.slice(i, i + BULK_CHUNK_SIZE)
    const batch = writeBatch(db)
    for (const shot of chunk) {
      const existing = shot.talentIds ?? shot.talent ?? []
      const merged = Array.from(new Set([...existing, ...talentIdsToAdd]))
      batch.update(buildDocRef(shot.id, clientId), {
        talentIds: merged,
        talent: merged,
        updatedAt: serverTimestamp(),
        ...userMeta(user),
      })
    }
    await batch.commit()
    updated += chunk.length
  }
  return updated
}
