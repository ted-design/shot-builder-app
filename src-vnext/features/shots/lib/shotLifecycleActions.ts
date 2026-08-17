import { addDoc, collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath, shotsPath } from "@/shared/lib/paths"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"
import type { AuthUser, Shot } from "@/shared/types"

function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null

  if (Array.isArray(value)) {
    return value
      .map((entry) => stripUndefinedDeep(entry))
      .filter((entry) => entry !== undefined)
  }

  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { toMillis?: unknown }).toMillis === "function" &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    // Firestore Timestamp-like objects must be preserved as-is.
    return value
  }

  if (typeof value === "object" && value !== null) {
    const next: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      const normalized = stripUndefinedDeep(entry)
      if (normalized !== undefined) next[key] = normalized
    }
    return next
  }

  return value
}

function normalizeTitle(input: string | null | undefined): string {
  const trimmed = typeof input === "string" ? input.trim() : ""
  return trimmed.length > 0 ? trimmed : "Untitled Shot"
}

export function buildDuplicateShotTitle(
  sourceTitle: string | null | undefined,
  existingTitles: ReadonlySet<string>,
): string {
  const base = normalizeTitle(sourceTitle)
  const existing = new Set(Array.from(existingTitles).map((entry) => entry.trim().toLowerCase()))

  const first = `${base} (Copy)`
  if (!existing.has(first.toLowerCase())) return first

  let index = 2
  while (index < 2000) {
    const candidate = `${base} (Copy ${index})`
    if (!existing.has(candidate.toLowerCase())) return candidate
    index += 1
  }

  return `${base} (Copy ${Date.now()})`
}

/**
 * Extra clone controls beyond the original preserveLane/title-reset shape.
 * All fields are optional and unset-by-default, so callers that omit
 * `options` entirely reproduce today's behavior byte-for-byte (mutation-
 * tested — see shotLifecycleActions.test.ts).
 */
interface BuildShotClonePayloadOptions {
  /**
   * Explicit laneId for the clone (e.g. remapped via an old->new lane map
   * for project duplication). When present — including `null` — this WINS
   * over `preserveLane`. Existing call sites never set this, so
   * `preserveLane` alone still governs their laneId.
   */
  readonly laneIdOverride?: string | null
  /** Keep the source shot's shotNumber instead of resetting it to null. */
  readonly preserveShotNumber?: boolean
  /** Explicit sortOrder for the clone. Defaults to Date.now() (today's behavior) when absent. */
  readonly sortOrderOverride?: number
}

interface BuildShotClonePayloadArgs {
  readonly shot: Shot
  readonly clientId: string
  readonly targetProjectId: string
  readonly title: string
  readonly createdByUid: string | null
  readonly preserveLane: boolean
  readonly options?: BuildShotClonePayloadOptions
}

export function buildShotClonePayload(args: BuildShotClonePayloadArgs): Record<string, unknown> {
  const { shot, clientId, targetProjectId, title, createdByUid, preserveLane, options = {} } = args

  const laneId =
    options.laneIdOverride !== undefined
      ? options.laneIdOverride
      : preserveLane
        ? shot.laneId ?? null
        : null

  const shotNumber = options.preserveShotNumber ? shot.shotNumber ?? null : null

  const sortOrder = options.sortOrderOverride !== undefined ? options.sortOrderOverride : Date.now()

  const payload = {
    title: normalizeTitle(title),
    description: shot.description ?? null,
    projectId: targetProjectId,
    clientId,
    status: shot.status ?? "todo",
    talent: Array.isArray(shot.talent) ? shot.talent : [],
    talentIds:
      Array.isArray(shot.talentIds) && shot.talentIds.length > 0
        ? shot.talentIds
        : Array.isArray(shot.talent)
          ? shot.talent
          : [],
    products: shot.products ?? [],
    locationId: shot.locationId ?? null,
    locationName: shot.locationName ?? null,
    laneId,
    // Sets initiative field — previously dropped by every clone path
    // (duplicate-in-project, copy-to-project). Included unconditionally now;
    // no existing test asserts its absence.
    mediaType: shot.mediaType ?? null,
    sortOrder,
    shotNumber,
    notes: shot.notes ?? null,
    notesAddendum: shot.notesAddendum ?? null,
    date: shot.date ?? null,
    heroImage: shot.heroImage ?? null,
    looks: shot.looks ?? [],
    activeLookId: shot.activeLookId ?? null,
    tags: shot.tags ?? [],
    referenceLinks: shot.referenceLinks ?? [],
    deleted: false,
    createdBy: createdByUid ?? shot.createdBy ?? "",
  }

  return stripUndefinedDeep(payload) as Record<string, unknown>
}

interface DuplicateShotArgs {
  readonly clientId: string
  readonly shot: Shot
  readonly user: AuthUser | null
  readonly existingTitles: ReadonlySet<string>
}

export async function duplicateShotInProject(args: DuplicateShotArgs): Promise<{
  readonly shotId: string
  readonly title: string
}> {
  const { clientId, shot, user, existingTitles } = args
  const title = buildDuplicateShotTitle(shot.title, existingTitles)

  const payload = buildShotClonePayload({
    shot,
    clientId,
    targetProjectId: shot.projectId,
    title,
    createdByUid: user?.uid ?? null,
    preserveLane: true,
  })

  const path = shotsPath(clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  if (user?.uid) {
    void createShotVersionSnapshot({
      clientId,
      shotId: ref.id,
      previousShot: null,
      patch: payload,
      user,
      changeType: "create",
    }).catch((err) => {
      console.error("[duplicateShotInProject] Failed to write initial version:", err)
    })
  }

  return { shotId: ref.id, title }
}

interface CopyShotToProjectArgs {
  readonly clientId: string
  readonly shot: Shot
  readonly targetProjectId: string
  readonly user: AuthUser | null
}

export async function copyShotToProject(args: CopyShotToProjectArgs): Promise<{
  readonly shotId: string
  readonly title: string
}> {
  const { clientId, shot, targetProjectId, user } = args
  const title = normalizeTitle(shot.title)

  const payload = buildShotClonePayload({
    shot,
    clientId,
    targetProjectId,
    title,
    createdByUid: user?.uid ?? null,
    preserveLane: false,
  })

  const path = shotsPath(clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    ...payload,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  if (user?.uid) {
    void createShotVersionSnapshot({
      clientId,
      shotId: ref.id,
      previousShot: null,
      patch: payload,
      user,
      changeType: "create",
    }).catch((err) => {
      console.error("[copyShotToProject] Failed to write initial version:", err)
    })
  }

  return { shotId: ref.id, title }
}

interface MoveShotToProjectArgs {
  readonly clientId: string
  readonly shotId: string
  readonly targetProjectId: string
  readonly user: AuthUser | null
}

export async function moveShotToProject(args: MoveShotToProjectArgs): Promise<void> {
  const { clientId, shotId, targetProjectId, user } = args
  const path = shotPath(shotId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))

  await updateDoc(ref, {
    projectId: targetProjectId,
    laneId: null,
    updatedAt: serverTimestamp(),
    ...(user?.uid ? { updatedBy: user.uid } : {}),
  })
}

interface SoftDeleteShotArgs {
  readonly clientId: string
  readonly shotId: string
  readonly user: AuthUser | null
}

export async function softDeleteShot(args: SoftDeleteShotArgs): Promise<void> {
  const { clientId, shotId, user } = args
  const path = shotPath(shotId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))

  await updateDoc(ref, {
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(user?.uid ? { updatedBy: user.uid } : {}),
  })
}

/** Maximum documents per Firestore WriteBatch (limit is 500; 250 for safety). */
const BULK_CHUNK_SIZE = 250
const MAX_BULK_DELETE = 500

interface BulkSoftDeleteShotsArgs {
  readonly clientId: string
  readonly shotIds: readonly string[]
  readonly user: AuthUser | null
}

export async function bulkSoftDeleteShots(args: BulkSoftDeleteShotsArgs): Promise<void> {
  const { clientId, shotIds, user } = args

  if (shotIds.length === 0) return
  if (shotIds.length > MAX_BULK_DELETE) {
    throw new Error(`Cannot delete more than ${MAX_BULK_DELETE} shots at once.`)
  }

  const chunks: string[][] = []
  for (let i = 0; i < shotIds.length; i += BULK_CHUNK_SIZE) {
    chunks.push(shotIds.slice(i, i + BULK_CHUNK_SIZE))
  }

  for (const chunk of chunks) {
    const batch = writeBatch(db)

    for (const shotId of chunk) {
      const path = shotPath(shotId, clientId)
      const ref = doc(db, path[0]!, ...path.slice(1))
      batch.update(ref, {
        deleted: true,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        ...(user?.uid ? { updatedBy: user.uid } : {}),
      })
    }

    await batch.commit()
  }
}

/** Sort shots by canonical `sortOrder` ascending — never selection/Set-insertion order. */
function byCanonicalSortOrder(shots: ReadonlyArray<Shot>): readonly Shot[] {
  return [...shots].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

function chunkShots(shots: ReadonlyArray<Shot>): readonly (readonly Shot[])[] {
  const chunks: Shot[][] = []
  for (let i = 0; i < shots.length; i += BULK_CHUNK_SIZE) {
    chunks.push([...shots.slice(i, i + BULK_CHUNK_SIZE)])
  }
  return chunks
}

interface BulkCopyShotsToProjectArgs {
  readonly clientId: string
  readonly shots: ReadonlyArray<Shot>
  readonly targetProjectId: string
  /** Existing shot titles in the TARGET project, for dedup via buildDuplicateShotTitle. */
  readonly targetTitles: ReadonlySet<string>
  readonly createdByUid: string | null
}

/**
 * Bulk "Copy to project…" — clones the given shots into `targetProjectId`.
 * Order: canonical `sortOrder` ascending (NOT selection/Set order), appended
 * at the end of the target's custom order (`sortOrder: base + i`). Each
 * clone's laneId is cleared and shotNumber reset, matching the single-shot
 * copyShotToProject precedent ("reset to avoid collisions"). Titles are
 * deduped against `targetTitles`, accumulating newly-minted titles so N
 * copies of the same source title don't collide with each other.
 */
export async function bulkCopyShotsToProject(
  args: BulkCopyShotsToProjectArgs,
): Promise<{ readonly copiedCount: number }> {
  const { clientId, shots, targetProjectId, targetTitles, createdByUid } = args
  if (shots.length === 0) return { copiedCount: 0 }

  const ordered = byCanonicalSortOrder(shots)
  const base = Date.now()
  const accumulatedTitles = new Set(targetTitles)

  const path = shotsPath(clientId)
  const collectionRef = collection(db, path[0]!, ...path.slice(1))

  let copiedCount = 0
  const chunks = chunkShots(ordered)
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex]!
    const batch = writeBatch(db)

    chunk.forEach((shot, i) => {
      const globalIndex = chunkIndex * BULK_CHUNK_SIZE + i
      const title = buildDuplicateShotTitle(shot.title, accumulatedTitles)
      accumulatedTitles.add(title)

      const payload = buildShotClonePayload({
        shot,
        clientId,
        targetProjectId,
        title,
        createdByUid,
        preserveLane: false,
        options: { sortOrderOverride: base + globalIndex },
      })

      const ref = doc(collectionRef)
      batch.set(ref, {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
    })

    await batch.commit()
    copiedCount += chunk.length
  }

  return { copiedCount }
}

interface BulkMoveShotsToProjectArgs {
  readonly clientId: string
  readonly shots: ReadonlyArray<Shot>
  readonly targetProjectId: string
  readonly user: AuthUser | null
}

/**
 * Bulk "Move to project…" — reassigns the given shots' `projectId` in place.
 * Order: canonical `sortOrder` ascending, appended at the end of the
 * target's custom order (`sortOrder: base + i` — deliberate deviation from
 * the single-shot moveShotToProject, which leaves sortOrder untouched; a
 * bulk move needs an explicit landing order in the target). `shotNumber` is
 * KEPT (Ted decision 4 — Renumber tool in target resolves collisions);
 * `laneId` is cleared, matching the single-shot move.
 */
export async function bulkMoveShotsToProject(
  args: BulkMoveShotsToProjectArgs,
): Promise<{ readonly movedCount: number }> {
  const { clientId, shots, targetProjectId, user } = args
  if (shots.length === 0) return { movedCount: 0 }

  const ordered = byCanonicalSortOrder(shots)
  const base = Date.now()

  let movedCount = 0
  const chunks = chunkShots(ordered)
  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
    const chunk = chunks[chunkIndex]!
    const batch = writeBatch(db)

    chunk.forEach((shot, i) => {
      const globalIndex = chunkIndex * BULK_CHUNK_SIZE + i
      const path = shotPath(shot.id, clientId)
      const ref = doc(db, path[0]!, ...path.slice(1))
      batch.update(ref, {
        projectId: targetProjectId,
        laneId: null,
        sortOrder: base + globalIndex,
        updatedAt: serverTimestamp(),
        ...(user?.uid ? { updatedBy: user.uid } : {}),
      })
    })

    await batch.commit()
    movedCount += chunk.length
  }

  return { movedCount }
}

