import { doc, serverTimestamp, writeBatch } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath } from "@/shared/lib/paths"
import type { Shot, ShotTag } from "@/shared/types"

function chunk<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

function hasTag(shot: Shot, tagId: string): boolean {
  return Array.isArray(shot.tags) && shot.tags.some((t) => t.id === tagId)
}

function replaceTag(shot: Shot, tagId: string, patch: Partial<ShotTag>): ShotTag[] {
  const next = (shot.tags ?? []).map((t) => (t.id === tagId ? { ...t, ...patch } : t))
  return next
}

export async function renameTagAcrossShots(args: {
  readonly clientId: string
  readonly shots: readonly Shot[]
  readonly tagId: string
  readonly nextLabel: string
}) {
  const { clientId, shots, tagId, nextLabel } = args
  const label = nextLabel.trim()
  if (!label) throw new Error("Tag label cannot be empty.")

  const shotsToUpdate = shots.filter((s) => hasTag(s, tagId))
  if (shotsToUpdate.length === 0) return 0

  let updated = 0
  for (const group of chunk(shotsToUpdate, 450)) {
    const batch = writeBatch(db)
    for (const shot of group) {
      const nextTags = replaceTag(shot, tagId, { label })
      batch.update(doc(db, ...shotPath(shot.id, clientId)), {
        tags: nextTags,
        updatedAt: serverTimestamp(),
      })
      updated += 1
    }
    await batch.commit()
  }
  return updated
}

export async function recolorTagAcrossShots(args: {
  readonly clientId: string
  readonly shots: readonly Shot[]
  readonly tagId: string
  readonly nextColor: string
}) {
  const { clientId, shots, tagId, nextColor } = args
  const color = nextColor.trim() || "gray"

  const shotsToUpdate = shots.filter((s) => hasTag(s, tagId))
  if (shotsToUpdate.length === 0) return 0

  let updated = 0
  for (const group of chunk(shotsToUpdate, 450)) {
    const batch = writeBatch(db)
    for (const shot of group) {
      const nextTags = replaceTag(shot, tagId, { color })
      batch.update(doc(db, ...shotPath(shot.id, clientId)), {
        tags: nextTags,
        updatedAt: serverTimestamp(),
      })
      updated += 1
    }
    await batch.commit()
  }
  return updated
}

export async function deleteTagAcrossShots(args: {
  readonly clientId: string
  readonly shots: readonly Shot[]
  readonly tagId: string
}) {
  const { clientId, shots, tagId } = args
  const shotsToUpdate = shots.filter((s) => hasTag(s, tagId))
  if (shotsToUpdate.length === 0) return 0

  let updated = 0
  for (const group of chunk(shotsToUpdate, 450)) {
    const batch = writeBatch(db)
    for (const shot of group) {
      const nextTags = (shot.tags ?? []).filter((t) => t.id !== tagId)
      batch.update(doc(db, ...shotPath(shot.id, clientId)), {
        tags: nextTags,
        updatedAt: serverTimestamp(),
      })
      updated += 1
    }
    await batch.commit()
  }
  return updated
}

export async function mergeTagsAcrossShots(args: {
  readonly clientId: string
  readonly shots: readonly Shot[]
  readonly target: ShotTag
  readonly mergeIds: readonly string[]
}) {
  const { clientId, shots, target, mergeIds } = args
  const mergeIdSet = new Set(mergeIds.filter(Boolean))
  if (mergeIdSet.size === 0) return 0

  const shotsToUpdate = shots.filter((s) =>
    Array.isArray(s.tags) && s.tags.some((t) => mergeIdSet.has(t.id)),
  )
  if (shotsToUpdate.length === 0) return 0

  let updated = 0
  for (const group of chunk(shotsToUpdate, 450)) {
    const batch = writeBatch(db)
    for (const shot of group) {
      const filtered = (shot.tags ?? []).filter((t) => !mergeIdSet.has(t.id))
      const hasTarget = filtered.some((t) => t.id === target.id)
      const nextTags = hasTarget ? filtered : [...filtered, target]
      batch.update(doc(db, ...shotPath(shot.id, clientId)), {
        tags: nextTags,
        updatedAt: serverTimestamp(),
      })
      updated += 1
    }
    await batch.commit()
  }
  return updated
}

