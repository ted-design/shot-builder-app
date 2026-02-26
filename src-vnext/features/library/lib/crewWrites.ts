import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { crewPath, crewDocPath } from "@/shared/lib/paths"

export async function createCrewMember(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly firstName: string
  readonly lastName: string
  readonly departmentId?: string | null
  readonly positionId?: string | null
  readonly department?: string | null
  readonly position?: string | null
  readonly email?: string | null
  readonly phone?: string | null
  readonly company?: string | null
  readonly notes?: string | null
}): Promise<string> {
  const firstName = args.firstName.trim()
  const lastName = args.lastName.trim()
  if (!firstName && !lastName) throw new Error("At least one name is required")

  const name = [firstName, lastName].filter(Boolean).join(" ")
  const path = crewPath(args.clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    clientId: args.clientId,
    name,
    firstName: firstName || null,
    lastName: lastName || null,
    departmentId: args.departmentId?.trim() || null,
    positionId: args.positionId?.trim() || null,
    department: args.department?.trim() || null,
    position: args.position?.trim() || null,
    email: args.email?.trim() || null,
    phone: args.phone?.trim() || null,
    company: args.company?.trim() || null,
    notes: args.notes?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: args.userId ?? null,
  })

  return ref.id
}

export async function updateCrewMember(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly crewId: string
  readonly patch: Record<string, unknown>
}) {
  const crewId = args.crewId.trim()
  if (!crewId) throw new Error("Missing crew member id")

  const path = crewDocPath(crewId, args.clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1)), {
    ...args.patch,
    updatedAt: serverTimestamp(),
    updatedBy: args.userId ?? null,
  })
}

export async function deleteCrewMember(args: {
  readonly clientId: string
  readonly crewId: string
}) {
  const crewId = args.crewId.trim()
  if (!crewId) throw new Error("Missing crew member id")

  const path = crewDocPath(crewId, args.clientId)
  await deleteDoc(doc(db, path[0]!, ...path.slice(1)))
}
