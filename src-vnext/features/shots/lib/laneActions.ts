import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  serverTimestamp,
  getFirestore,
} from "firebase/firestore"
import { lanesPath, laneDocPath, shotsPath } from "@/shared/lib/paths"
import type { Lane, Shot } from "@/shared/types"
import type { User } from "firebase/auth"

const BATCH_CHUNK_SIZE = 250
const MAX_BULK_OPS = 500

export type LanePatch = {
  readonly name?: string
  readonly sortOrder?: number
  readonly color?: string | null
  readonly direction?: string | null
  readonly notes?: string | null
  readonly sceneNumber?: number | null
}

export async function createLane(params: {
  readonly name: string
  readonly projectId: string
  readonly clientId: string
  readonly sortOrder: number
  readonly color?: string
  readonly sceneNumber?: number
  readonly existingLanes?: ReadonlyArray<Lane>
  readonly user: User | null
}): Promise<string> {
  const { name, projectId, clientId, sortOrder, color, user, existingLanes } = params
  const trimmedName = name.trim()
  if (!trimmedName) throw new Error("Lane name cannot be empty")

  const resolvedSceneNumber =
    params.sceneNumber ??
    Math.max(0, ...(existingLanes ?? []).map((l) => l.sceneNumber ?? 0)) + 1

  const db = getFirestore()
  const ref = doc(collection(db, ...lanesPath(projectId, clientId)))
  await setDoc(ref, {
    name: trimmedName,
    projectId,
    clientId,
    sortOrder,
    color: color ?? null,
    sceneNumber: resolvedSceneNumber,
    direction: null,
    notes: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: user?.uid ?? "",
  })
  return ref.id
}

export async function updateLane(params: {
  readonly laneId: string
  readonly projectId: string
  readonly clientId: string
  readonly patch: LanePatch
}): Promise<void> {
  const { laneId, projectId, clientId, patch } = params
  const db = getFirestore()
  const ref = doc(db, ...laneDocPath(laneId, projectId, clientId))
  await updateDoc(ref, {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteLane(params: {
  readonly laneId: string
  readonly projectId: string
  readonly clientId: string
}): Promise<void> {
  const { laneId, projectId, clientId } = params
  const db = getFirestore()
  const ref = doc(db, ...laneDocPath(laneId, projectId, clientId))
  await deleteDoc(ref)
}

export async function assignShotsToLane(params: {
  readonly shotIds: readonly string[]
  readonly laneId: string | null
  readonly projectId: string
  readonly clientId: string
}): Promise<number> {
  const { shotIds, laneId, clientId } = params
  if (shotIds.length === 0) return 0
  if (shotIds.length > MAX_BULK_OPS) {
    throw new Error(`Cannot assign more than ${MAX_BULK_OPS} shots to a scene at once.`)
  }

  const db = getFirestore()
  let updated = 0

  for (let i = 0; i < shotIds.length; i += BATCH_CHUNK_SIZE) {
    const chunk = shotIds.slice(i, i + BATCH_CHUNK_SIZE)
    const batch = writeBatch(db)

    for (const shotId of chunk) {
      const ref = doc(db, ...shotsPath(clientId), shotId)
      batch.update(ref, {
        laneId: laneId,
        updatedAt: serverTimestamp(),
      })
    }

    await batch.commit()
    updated += chunk.length
  }

  return updated
}

export async function ungroupAllShotsFromLane(params: {
  readonly shots: ReadonlyArray<Shot>
  readonly laneId: string
  readonly projectId: string
  readonly clientId: string
}): Promise<number> {
  const { shots, laneId, projectId, clientId } = params
  const shotIds = shots
    .filter((s) => s.laneId === laneId)
    .map((s) => s.id)
  return assignShotsToLane({ shotIds, laneId: null, projectId, clientId })
}
