import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { auth, db } from "@/shared/lib/firebase"
import { crewPath, locationsPath, talentPath } from "@/shared/lib/paths"
import { canManageProjects, normalizeRole } from "@/shared/lib/rbac"

type AssetKind = "talent" | "locations" | "crew"

function kindPath(kind: AssetKind, clientId: string): string[] {
  switch (kind) {
    case "talent":
      return talentPath(clientId)
    case "locations":
      return locationsPath(clientId)
    case "crew":
      return crewPath(clientId)
  }
}

async function addManyToProject({
  clientId,
  projectId,
  kind,
  ids,
}: {
  readonly clientId: string
  readonly projectId: string
  readonly kind: AssetKind
  readonly ids: readonly string[]
}) {
  const uniqueIds = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (uniqueIds.length === 0) return

  const batch = writeBatch(db)
  const path = kindPath(kind, clientId)
  for (const id of uniqueIds) {
    const ref = doc(db, path[0]!, ...path.slice(1), id)
    batch.update(ref, {
      projectIds: arrayUnion(projectId),
      updatedAt: serverTimestamp(),
    })
  }
  await batch.commit()
}

async function removeFromProject({
  clientId,
  projectId,
  kind,
  id,
}: {
  readonly clientId: string
  readonly projectId: string
  readonly kind: AssetKind
  readonly id: string
}) {
  const trimmed = id.trim()
  if (!trimmed) return
  const path = kindPath(kind, clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), trimmed), {
    projectIds: arrayRemove(projectId),
    updatedAt: serverTimestamp(),
  })
}

/**
 * Org-scoped talent docs are writable only by the GLOBAL admin/producer
 * claim (firestore.rules /clients/{clientId}/talent:363-365 — isAdmin() ||
 * isProducer(); project-scoped roles do NOT apply). TalentPicker's
 * auto-repair effect calls addTalentToProject for ANY signed-in user viewing
 * a shot with an orphaned talent link, so without this gate a crew/viewer
 * editor fires repeating permission-denied writes. Reads the SDK-cached ID
 * token (no network refresh) and runs it through normalizeRole — the same
 * trim+lowercase pipeline AuthProvider uses for useAuth().role — so the
 * case variants the rules accept ('Admin'/'ADMIN'/'Producer'/'PRODUCER',
 * firestore.rules:21-35) pass the gate too.
 *
 * Deliberately STRICTER than the backend rule: rules isProducer() also
 * grants warehouse/wardrobe (firestore.rules:28-35), but this gate uses
 * canManageProjects (admin||producer only) to match ProjectAssetsPage's
 * canEdit — "UI excluding warehouse stays stricter-than-rule (pre-existing,
 * fail-toward-fewer)". normalizeRole maps legacy 'wardrobe' → warehouse, so
 * every case variant of both lands outside the gate.
 */
async function hasGlobalTalentWriteClaim(): Promise<boolean> {
  const user = auth.currentUser
  if (!user) return false
  try {
    const tokenResult = await user.getIdTokenResult()
    const role = normalizeRole(tokenResult.claims["role"])
    return canManageProjects(role)
  } catch {
    // Unreadable token — fail toward not writing (rules would deny anyway).
    return false
  }
}

/**
 * Belt-and-suspenders for claim/rules drift: if a talent link write IS
 * rules-denied despite the claim gate, memo the client/project pair so the
 * auto-repair effect (which re-fires whenever its deps change) never loops
 * the denied write. Module-level session cache — same lifetime pattern as
 * useEffectiveRole's role cache.
 */
const deniedTalentLinkKeys = new Set<string>()

/** Test-only: clears the permission-denied memo between specs. */
export function resetDeniedTalentLinkMemoForTests(): void {
  deniedTalentLinkKeys.clear()
}

export async function addTalentToProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly ids: readonly string[]
}) {
  const memoKey = `${opts.clientId}/${opts.projectId}`
  if (deniedTalentLinkKeys.has(memoKey)) return
  if (!(await hasGlobalTalentWriteClaim())) return
  try {
    return await addManyToProject({ ...opts, kind: "talent" })
  } catch (err) {
    if ((err as { code?: string }).code === "permission-denied") {
      deniedTalentLinkKeys.add(memoKey)
    }
    throw err
  }
}

export async function removeTalentFromProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly id: string
}) {
  return removeFromProject({ ...opts, kind: "talent" })
}

export async function addLocationsToProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly ids: readonly string[]
}) {
  return addManyToProject({ ...opts, kind: "locations" })
}

export async function removeLocationFromProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly id: string
}) {
  return removeFromProject({ ...opts, kind: "locations" })
}

export async function addCrewToProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly ids: readonly string[]
}) {
  return addManyToProject({ ...opts, kind: "crew" })
}

export async function removeCrewFromProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly id: string
}) {
  return removeFromProject({ ...opts, kind: "crew" })
}

export async function createTalentAndAddToProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly name: string
  readonly agency?: string
  readonly notes?: string
}) {
  const name = opts.name.trim() || "Unnamed talent"
  const path = talentPath(opts.clientId)
  await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    clientId: opts.clientId,
    name,
    agency: opts.agency?.trim() || null,
    notes: opts.notes?.trim() || null,
    projectIds: [opts.projectId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function createLocationAndAddToProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly name: string
  readonly address?: string
  readonly notes?: string
}) {
  const name = opts.name.trim() || "Unnamed location"
  const path = locationsPath(opts.clientId)
  await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    clientId: opts.clientId,
    name,
    address: opts.address?.trim() || null,
    notes: opts.notes?.trim() || null,
    projectIds: [opts.projectId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function createCrewAndAddToProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly name: string
  readonly department?: string
  readonly position?: string
  readonly email?: string
  readonly phone?: string
  readonly notes?: string
}) {
  const name = opts.name.trim() || "Unnamed crew member"
  const path = crewPath(opts.clientId)
  await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    clientId: opts.clientId,
    name,
    department: opts.department?.trim() || null,
    position: opts.position?.trim() || null,
    email: opts.email?.trim() || null,
    phone: opts.phone?.trim() || null,
    notes: opts.notes?.trim() || null,
    projectIds: [opts.projectId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}
