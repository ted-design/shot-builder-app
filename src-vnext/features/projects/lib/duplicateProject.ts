import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type CollectionReference,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { isAdmin } from "@/shared/lib/rbac"
import {
  lanesPath,
  projectMembersPath,
  projectPath,
  projectsPath,
  shotsPath,
} from "@/shared/lib/paths"
import { mapLane } from "@/features/shots/lib/mapLane"
import { mapShot } from "@/features/shots/lib/mapShot"
import { buildShotClonePayload } from "@/features/shots/lib/shotLifecycleActions"
import type { AuthUser, Lane, Role, Shot } from "@/shared/types"

/** Maximum documents per Firestore WriteBatch (limit is 500; 250 for safety, house convention). */
const BATCH_CHUNK_SIZE = 250

/**
 * Thrown when a chunk of the (deliberately non-atomic) multi-batch write
 * sequence fails partway through. Carries the new project id + how much
 * landed, so the caller can surface a precise error and let the user
 * soft-delete the partial project — this module never auto-retries.
 */
export class DuplicateProjectPartialFailureError extends Error {
  readonly newProjectId: string
  readonly lanesWritten: number
  readonly shotsWritten: number

  constructor(
    message: string,
    info: { readonly newProjectId: string; readonly lanesWritten: number; readonly shotsWritten: number },
  ) {
    super(message)
    this.name = "DuplicateProjectPartialFailureError"
    this.newProjectId = info.newProjectId
    this.lanesWritten = info.lanesWritten
    this.shotsWritten = info.shotsWritten
  }
}

export interface DuplicateProjectResult {
  readonly newProjectId: string
  readonly laneCount: number
  readonly shotCount: number
}

/** Internal — carries how many docs landed before a chunked-write step failed. */
class ChunkedWriteError extends Error {
  constructor(
    readonly sourceErr: unknown,
    readonly written: number,
  ) {
    super("Chunked write failed partway through.")
  }
}

interface DuplicateProjectArgs {
  readonly clientId: string
  readonly sourceProjectId: string
  readonly newName: string
  /** Global role — governs whether an auto-membership doc is written (mirrors CreateProjectDialog). */
  readonly role: Role
  readonly user: AuthUser | null
}

async function readSourceProject(
  sourceProjectId: string,
  clientId: string,
): Promise<Record<string, unknown>> {
  const segs = projectPath(sourceProjectId, clientId)
  const ref = doc(db, segs[0]!, ...segs.slice(1))
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    throw new Error("Source project not found.")
  }
  return snap.data() as Record<string, unknown>
}

async function readSourceLanes(sourceProjectId: string, clientId: string): Promise<Lane[]> {
  const segs = lanesPath(sourceProjectId, clientId)
  const snap = await getDocs(collection(db, segs[0]!, ...segs.slice(1)))
  return snap.docs.map((d) => mapLane(d.id, d.data()))
}

/**
 * Fetch source shots by projectId. Deliberately NOT `where("deleted","==",
 * false)` — that Firestore operator excludes docs where the field is
 * ABSENT, not just docs where it's true, which would silently drop legacy
 * shots that predate the `deleted` field. Filtered client-side instead,
 * matching the codebase's OWN documented rule (CLAUDE.md: "Always filter
 * deleted products client-side ... never use where('deleted','==',false)
 * which excludes docs missing the field") and the precedent already used
 * by talentDependencies.ts / useLinkedShots.ts.
 *
 * NOTE — spec contradiction found and resolved: the build spec said to
 * "mirror the live shots-list query semantics exactly" and cited
 * useShots.ts as ground truth; useShots.ts DOES use
 * `where("deleted","==",false)` (verified today, not a recent regression —
 * that line dates to 2026-01-31). Mirroring it literally would fail the
 * spec's OWN required test ("legacy shot lacking `deleted` field -> still
 * cloned") and would contradict CLAUDE.md's documented rule. Resolved in
 * favor of the safe client-side filter, which is what both the test matrix
 * and CLAUDE.md require. Flagged in the PR body.
 */
async function readSourceShots(sourceProjectId: string, clientId: string): Promise<Shot[]> {
  const segs = shotsPath(clientId)
  const snap = await getDocs(
    query(
      collection(db, segs[0]!, ...segs.slice(1)),
      where("projectId", "==", sourceProjectId),
    ),
  )
  return snap.docs.map((d) => mapShot(d.id, d.data())).filter((shot) => shot.deleted !== true)
}

/** New project doc (+ auto-membership for non-admin creators, mirrors CreateProjectDialog.tsx's batch pattern). */
async function createNewProjectDoc(params: {
  readonly clientId: string
  readonly newName: string
  readonly sourceProject: Record<string, unknown>
  readonly role: Role
  readonly user: AuthUser | null
}): Promise<{ readonly id: string }> {
  const { clientId, newName, sourceProject, role, user } = params
  const segs = projectsPath(clientId)
  const ref = doc(collection(db, segs[0]!, ...segs.slice(1)))

  const batch = writeBatch(db)
  batch.set(ref, {
    name: newName,
    clientId,
    // Always active — a duplicate of an archived project must be visible (Ted decision).
    status: "active",
    ...(sourceProject["visibility"] ? { visibility: sourceProject["visibility"] } : {}),
    shootDates: Array.isArray(sourceProject["shootDates"]) ? sourceProject["shootDates"] : [],
    ...(sourceProject["notes"] ? { notes: sourceProject["notes"] } : {}),
    ...(sourceProject["briefUrl"] ? { briefUrl: sourceProject["briefUrl"] } : {}),
    createdBy: user?.uid ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  if (!isAdmin(role) && user) {
    const memberSegs = projectMembersPath(ref.id, clientId)
    const memberRef = doc(db, memberSegs[0]!, ...memberSegs.slice(1), user.uid)
    batch.set(memberRef, {
      role: "producer",
      addedAt: serverTimestamp(),
      addedBy: user.uid,
    })
  }

  await batch.commit()
  return { id: ref.id }
}

/** Clone lanes into the new project, chunked. Returns the old->new id map the shots step needs. */
async function cloneLanes(params: {
  readonly clientId: string
  readonly newProjectId: string
  readonly sourceLanes: ReadonlyArray<Lane>
  readonly user: AuthUser | null
}): Promise<Map<string, string>> {
  const { clientId, newProjectId, sourceLanes, user } = params
  const segs = lanesPath(newProjectId, clientId)
  const collectionRef = collection(db, segs[0]!, ...segs.slice(1))
  const laneIdMap = new Map<string, string>()
  let written = 0

  try {
    for (let start = 0; start < sourceLanes.length; start += BATCH_CHUNK_SIZE) {
      const chunk = sourceLanes.slice(start, start + BATCH_CHUNK_SIZE)
      const batch = writeBatch(db)
      for (const lane of chunk) {
        const newLaneRef = doc(collectionRef)
        laneIdMap.set(lane.id, newLaneRef.id)
        batch.set(newLaneRef, {
          name: lane.name,
          projectId: newProjectId,
          clientId,
          sortOrder: lane.sortOrder,
          ...(lane.color ? { color: lane.color } : {}),
          ...(lane.sceneNumber != null ? { sceneNumber: lane.sceneNumber } : {}),
          ...(lane.direction ? { direction: lane.direction } : {}),
          ...(lane.notes ? { notes: lane.notes } : {}),
          ...(lane.locationId ? { locationId: lane.locationId } : {}),
          ...(lane.locationName ? { locationName: lane.locationName } : {}),
          createdBy: user?.uid ?? lane.createdBy ?? "",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      await batch.commit()
      written += chunk.length
    }
  } catch (err) {
    throw new ChunkedWriteError(err, written)
  }

  return laneIdMap
}

/**
 * Clone shots into the new project (TRUE CLONE — Ted decision 2), chunked.
 * `preserveShotNumber` + explicit `sortOrderOverride: shot.sortOrder` keep
 * status/date/number/order exactly; `laneIdOverride` remaps through
 * `laneIdMap` (null if the source lane is missing, e.g. it was itself
 * deleted). Returns how many shots landed before any failure — the caller
 * uses this to build a precise partial-failure error.
 */
async function cloneShots(params: {
  readonly clientId: string
  readonly newProjectId: string
  readonly sourceShots: ReadonlyArray<Shot>
  readonly laneIdMap: ReadonlyMap<string, string>
  readonly user: AuthUser | null
  readonly shotsCollectionRef: CollectionReference
}): Promise<number> {
  const { clientId, newProjectId, sourceShots, laneIdMap, user, shotsCollectionRef } = params
  let written = 0

  try {
    for (let start = 0; start < sourceShots.length; start += BATCH_CHUNK_SIZE) {
      const chunk = sourceShots.slice(start, start + BATCH_CHUNK_SIZE)
      const batch = writeBatch(db)
      for (const shot of chunk) {
        const newLaneId = shot.laneId ? laneIdMap.get(shot.laneId) ?? null : null
        const payload = buildShotClonePayload({
          shot,
          clientId,
          targetProjectId: newProjectId,
          title: shot.title,
          createdByUid: user?.uid ?? null,
          preserveLane: false,
          options: {
            laneIdOverride: newLaneId,
            preserveShotNumber: true,
            sortOrderOverride: shot.sortOrder,
          },
        })
        const ref = doc(shotsCollectionRef)
        batch.set(ref, {
          ...payload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }
      await batch.commit()
      written += chunk.length
    }
  } catch (err) {
    throw new ChunkedWriteError(err, written)
  }

  return written
}

/**
 * Duplicate depth = structure + shots (Ted decision 1): new project doc +
 * all Sets/lanes + all non-deleted shots. Skips pulls, schedules, export
 * reports, casting board, shotShares, shotRequests.
 *
 * Images = share existing files (Ted decision 3): heroImage/looks carry the
 * same Storage paths — no file duplication, no code needed here beyond
 * copying the field (shot-scoped paths + soft deletes make this safe).
 *
 * Write order is a SEQUENCE of independent batches (non-atomic by
 * necessity — Firestore has no cross-collection multi-document transaction
 * at this scale), chosen so a partial failure is inert: the new project doc
 * lands first, then lanes (so the shots step can remap laneId), then shots
 * last (the biggest, most failure-prone step, and the one where a partial
 * write is least harmful — a project with structure but fewer shots than
 * expected is legible and recoverable; the reverse would not be). On
 * failure, the new project is left in place (never auto-retried) so the
 * user can inspect it or soft-delete it.
 */
export async function duplicateProject(args: DuplicateProjectArgs): Promise<DuplicateProjectResult> {
  const { clientId, sourceProjectId, newName, role, user } = args

  const sourceProject = await readSourceProject(sourceProjectId, clientId)
  const sourceLanes = await readSourceLanes(sourceProjectId, clientId)
  const sourceShots = await readSourceShots(sourceProjectId, clientId)

  const newProject = await createNewProjectDoc({ clientId, newName, sourceProject, role, user })

  let laneIdMap: Map<string, string>
  try {
    laneIdMap = await cloneLanes({ clientId, newProjectId: newProject.id, sourceLanes, user })
  } catch (err) {
    const written = err instanceof ChunkedWriteError ? err.written : 0
    console.error("[duplicateProject] Lanes step failed partway through:", err)
    throw new DuplicateProjectPartialFailureError(
      `Duplicated project "${newName}" but only ${written} of ${sourceLanes.length} sets landed before a write failed. ` +
        `No shots were copied. The new project was left in place — you can delete it or retry.`,
      { newProjectId: newProject.id, lanesWritten: written, shotsWritten: 0 },
    )
  }

  const shotsSegs = shotsPath(clientId)
  const shotsCollectionRef = collection(db, shotsSegs[0]!, ...shotsSegs.slice(1))

  let shotsWritten: number
  try {
    shotsWritten = await cloneShots({
      clientId,
      newProjectId: newProject.id,
      sourceShots,
      laneIdMap,
      user,
      shotsCollectionRef,
    })
  } catch (err) {
    const written = err instanceof ChunkedWriteError ? err.written : 0
    console.error("[duplicateProject] Shots step failed partway through:", err)
    throw new DuplicateProjectPartialFailureError(
      `Duplicated project "${newName}" but only ${written} of ${sourceShots.length} shots landed before a write failed. ` +
        `The new project and its sets were created. You can delete it or retry.`,
      { newProjectId: newProject.id, lanesWritten: sourceLanes.length, shotsWritten: written },
    )
  }

  return {
    newProjectId: newProject.id,
    laneCount: sourceLanes.length,
    shotCount: shotsWritten,
  }
}
