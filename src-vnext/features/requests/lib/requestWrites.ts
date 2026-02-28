import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotRequestDocPath, shotRequestsPath, shotsPath } from "@/shared/lib/paths"
import type { ShotRequestPriority } from "@/shared/types"

// --- Submit ---

interface SubmitShotRequestParams {
  readonly clientId: string
  readonly title: string
  readonly priority: ShotRequestPriority
  readonly description?: string | null
  readonly referenceUrls?: readonly string[] | null
  readonly deadline?: string | null
  readonly notes?: string | null
  readonly submittedBy: string
  readonly submittedByName?: string | null
}

export async function submitShotRequest(
  params: SubmitShotRequestParams,
): Promise<string> {
  const collRef = collection(db, ...shotRequestsPath(params.clientId))
  const docRef = await addDoc(collRef, {
    clientId: params.clientId,
    status: "submitted",
    priority: params.priority,
    title: params.title.trim(),
    description: params.description ?? null,
    referenceUrls: params.referenceUrls ?? null,
    deadline: params.deadline ?? null,
    notes: params.notes ?? null,
    submittedBy: params.submittedBy,
    submittedByName: params.submittedByName ?? null,
    submittedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return docRef.id
}

// --- Absorb (Transaction) ---

interface AbsorbRequestParams {
  readonly requestId: string
  readonly clientId: string
  readonly projectId: string
  readonly triagedBy: string
}

export async function triageAbsorbRequest(
  params: AbsorbRequestParams,
): Promise<string> {
  const requestRef = doc(db, ...shotRequestDocPath(params.requestId, params.clientId))
  const shotsCollRef = collection(db, ...shotsPath(params.clientId))

  const shotId = await runTransaction(db, async (tx) => {
    const requestSnap = await tx.get(requestRef)
    if (!requestSnap.exists()) throw new Error("Request not found")

    const requestData = requestSnap.data()
    if (requestData.status !== "submitted" && requestData.status !== "triaged") {
      throw new Error(`Cannot absorb request with status "${requestData.status as string}"`)
    }

    const newShotRef = doc(shotsCollRef)
    tx.set(newShotRef, {
      title: requestData.title as string,
      description: (requestData.description as string) ?? "",
      projectId: params.projectId,
      clientId: params.clientId,
      status: "todo",
      deleted: false,
      talent: [],
      products: [],
      sortOrder: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: params.triagedBy,
    })

    tx.update(requestRef, {
      status: "absorbed",
      triagedBy: params.triagedBy,
      triagedAt: serverTimestamp(),
      absorbedIntoProjectId: params.projectId,
      absorbedAsShotId: newShotRef.id,
      updatedAt: serverTimestamp(),
    })

    return newShotRef.id
  })

  return shotId
}

// --- Reject ---

interface RejectRequestParams {
  readonly requestId: string
  readonly clientId: string
  readonly triagedBy: string
  readonly rejectionReason?: string | null
}

export async function triageRejectRequest(
  params: RejectRequestParams,
): Promise<void> {
  const requestRef = doc(db, ...shotRequestDocPath(params.requestId, params.clientId))

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(requestRef)
    if (!snap.exists()) throw new Error("Request not found")

    const data = snap.data()
    if (data.status !== "submitted" && data.status !== "triaged") {
      throw new Error(`Cannot reject request with status "${data.status as string}"`)
    }

    tx.update(requestRef, {
      status: "rejected",
      triagedBy: params.triagedBy,
      triagedAt: serverTimestamp(),
      rejectionReason: params.rejectionReason ?? null,
      updatedAt: serverTimestamp(),
    })
  })
}
