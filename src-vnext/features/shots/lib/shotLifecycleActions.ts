import { addDoc, collection, doc, serverTimestamp, updateDoc } from "firebase/firestore"
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

interface BuildShotClonePayloadArgs {
  readonly shot: Shot
  readonly clientId: string
  readonly targetProjectId: string
  readonly title: string
  readonly createdByUid: string | null
  readonly preserveLane: boolean
}

export function buildShotClonePayload(args: BuildShotClonePayloadArgs): Record<string, unknown> {
  const { shot, clientId, targetProjectId, title, createdByUid, preserveLane } = args

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
    laneId: preserveLane ? shot.laneId ?? null : null,
    sortOrder: Date.now(),
    shotNumber: null,
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

