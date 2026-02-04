import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotPath, shotVersionsPath } from "@/shared/lib/paths"
import type { AuthUser, Shot, ShotVersion, ShotVersionChangeType } from "@/shared/types"

function stripHtmlToText(html: unknown): string {
  if (html === null || html === undefined || html === "") return ""
  if (typeof html !== "string") return ""
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeText(value: unknown): string {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value !== "string") return ""
  return value.replace(/\r\n/g, "\n").replace(/\s+/g, " ").trim()
}

function notesMeaningfullyDifferent(prevNotes: unknown, nextNotes: unknown): boolean {
  const prevText = normalizeText(stripHtmlToText(prevNotes))
  const nextText = normalizeText(stripHtmlToText(nextNotes))
  return prevText !== nextText
}

const VERSIONED_SHOT_FIELDS: ReadonlyArray<keyof Shot> = [
  "title",
  "description",
  "status",
  "shotNumber",
  "date",
  "talent",
  "talentIds",
  "products",
  "locationId",
  "locationName",
  "laneId",
  "notes",
  "notesAddendum",
  "heroImage",
  "looks",
  "activeLookId",
  "tags",
]

function buildShotSnapshot(shot: Shot, patch: Record<string, unknown> = {}): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {}

  for (const key of VERSIONED_SHOT_FIELDS) {
    const nextValue =
      Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : (shot as unknown as Record<string, unknown>)[key]
    if (nextValue === undefined) {
      snapshot[key] = null
      continue
    }
    snapshot[key as string] = nextValue
  }

  return snapshot
}

function getChangedFields(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
): string[] {
  if (!previous) return []

  const changedFields: string[] = []
  for (const key of VERSIONED_SHOT_FIELDS) {
    const field = key as string
    const prevValue = previous[field]
    const currValue = current[field]

    if (field === "notes") {
      if (notesMeaningfullyDifferent(prevValue, currValue)) changedFields.push(field)
      continue
    }

    if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
      changedFields.push(field)
    }
  }
  return changedFields
}

export async function createShotVersionSnapshot(args: {
  readonly clientId: string
  readonly shotId: string
  readonly previousShot: Shot | null
  readonly patch: Record<string, unknown>
  readonly user: AuthUser
  readonly changeType: ShotVersionChangeType
}): Promise<string | null> {
  const { clientId, shotId, previousShot, patch, user, changeType } = args

  if (!clientId || !shotId) return null
  if (!user?.uid) return null

  const previousSnapshot = previousShot ? buildShotSnapshot(previousShot) : null
  const currentSnapshot = previousShot
    ? buildShotSnapshot(previousShot, patch)
    : buildShotSnapshot(patch as unknown as Shot)

  const changedFields =
    changeType === "update" ? getChangedFields(previousSnapshot, currentSnapshot) : []

  if (changeType === "update" && changedFields.length === 0) return null

  const path = shotVersionsPath(shotId, clientId)
  const versionsRef = collection(db, path[0]!, ...path.slice(1))

  const versionData: Omit<ShotVersion, "id"> = {
    snapshot: currentSnapshot,
    createdAt: undefined,
    createdBy: user.uid,
    createdByName: user.displayName ?? user.email ?? null,
    createdByAvatar: user.photoURL ?? null,
    changeType,
    changedFields,
  }

  const ref = await addDoc(versionsRef, {
    ...versionData,
    createdAt: serverTimestamp(),
  })

  return ref.id
}

function buildRestorePatch(args: {
  readonly snapshot: Record<string, unknown>
  readonly preserve: Pick<Shot, "clientId" | "projectId" | "createdAt" | "createdBy">
}): Record<string, unknown> {
  const { snapshot, preserve } = args
  const patch: Record<string, unknown> = {}

  for (const key of VERSIONED_SHOT_FIELDS) {
    const field = key as string
    if (Object.prototype.hasOwnProperty.call(snapshot, field)) {
      patch[field] = snapshot[field]
    } else {
      patch[field] = null
    }
  }

  patch.clientId = preserve.clientId
  patch.projectId = preserve.projectId
  patch.createdAt = preserve.createdAt
  patch.createdBy = preserve.createdBy

  return patch
}

export async function restoreShotVersion(args: {
  readonly clientId: string
  readonly shotId: string
  readonly version: ShotVersion
  readonly currentShot: Shot
  readonly user: AuthUser
}): Promise<void> {
  const { clientId, shotId, version, currentShot, user } = args
  if (!clientId) throw new Error("Missing clientId.")
  if (!shotId) throw new Error("Missing shotId.")
  if (!user?.uid) throw new Error("Not authenticated.")

  const patch = buildRestorePatch({
    snapshot: version.snapshot ?? {},
    preserve: {
      clientId: currentShot.clientId,
      projectId: currentShot.projectId,
      createdAt: currentShot.createdAt,
      createdBy: currentShot.createdBy,
    },
  })

  delete patch.clientId
  delete patch.projectId
  delete patch.createdAt
  delete patch.createdBy

  const shotRef = doc(db, ...shotPath(shotId, clientId))
  await updateDoc(shotRef, {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  })

  // Best-effort: write rollback version (must never block restore).
  try {
    await createShotVersionSnapshot({
      clientId,
      shotId,
      previousShot: currentShot,
      patch,
      user,
      changeType: "rollback",
    })
  } catch (err) {
    console.error("[restoreShotVersion] Failed to write rollback version:", err)
  }
}

export async function restoreShotVersionById(args: {
  readonly clientId: string
  readonly shotId: string
  readonly versionId: string
  readonly currentShot: Shot
  readonly user: AuthUser
}): Promise<void> {
  const { clientId, shotId, versionId, currentShot, user } = args
  const versionsPath = shotVersionsPath(shotId, clientId)
  const versionRef = doc(db, versionsPath[0]!, ...versionsPath.slice(1), versionId)
  const snap = await getDoc(versionRef)
  if (!snap.exists()) throw new Error("Version not found.")
  const version = { id: snap.id, ...(snap.data() as Record<string, unknown>) } as ShotVersion
  await restoreShotVersion({ clientId, shotId, version, currentShot, user })
}

