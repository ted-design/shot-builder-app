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
import { db } from "@/shared/lib/firebase"
import { crewPath, locationsPath, talentPath } from "@/shared/lib/paths"

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

export async function addTalentToProject(opts: {
  readonly clientId: string
  readonly projectId: string
  readonly ids: readonly string[]
}) {
  return addManyToProject({ ...opts, kind: "talent" })
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
