import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import { db, storage } from "@/shared/lib/firebase"
import { talentPath } from "@/shared/lib/paths"
import { compressImageToWebp, validateImageFileForUpload } from "@/shared/lib/uploadImage"

export interface TalentImageRecord {
  readonly id: string
  readonly path: string
  readonly downloadURL: string
  readonly description?: string | null
  readonly order?: number
  readonly cropData?: unknown
}

async function uploadWebpImage(file: File, storagePath: string): Promise<{ path: string; url: string }> {
  validateImageFileForUpload(file)
  const blob = await compressImageToWebp(file)
  const ref = storageRef(storage, storagePath)
  await uploadBytes(ref, blob, { contentType: "image/webp" })
  const url = await getDownloadURL(ref)
  return { path: storagePath, url }
}

async function deleteStoragePath(path: string | null | undefined): Promise<void> {
  if (!path) return
  try {
    await deleteObject(storageRef(storage, path))
  } catch {
    // Best-effort cleanup only.
  }
}

export async function uploadTalentPortfolioImages(args: {
  readonly talentId: string
  readonly files: readonly File[]
}): Promise<readonly TalentImageRecord[]> {
  const talentId = args.talentId.trim()
  if (!talentId) throw new Error("Missing talent id")
  const files = [...args.files].filter(Boolean)
  if (files.length === 0) return []

  const results = await Promise.all(
    files.map(async (file) => {
      const id = crypto.randomUUID()
      const storagePath = `images/talent/${talentId}/gallery/${id}.webp`
      const uploaded = await uploadWebpImage(file, storagePath)
      return { id, path: uploaded.path, downloadURL: uploaded.url }
    }),
  )

  return results
}

export async function uploadTalentCastingImages(args: {
  readonly talentId: string
  readonly sessionId: string
  readonly files: readonly File[]
}): Promise<readonly TalentImageRecord[]> {
  const talentId = args.talentId.trim()
  if (!talentId) throw new Error("Missing talent id")
  const sessionId = args.sessionId.trim()
  if (!sessionId) throw new Error("Missing session id")
  const files = [...args.files].filter(Boolean)
  if (files.length === 0) return []

  const results = await Promise.all(
    files.map(async (file) => {
      const id = crypto.randomUUID()
      const storagePath = `images/talent/${talentId}/casting/${sessionId}/${id}.webp`
      const uploaded = await uploadWebpImage(file, storagePath)
      return { id, path: uploaded.path, downloadURL: uploaded.url }
    }),
  )

  return results
}

export async function deleteTalentImagePaths(paths: readonly (string | null | undefined)[]): Promise<void> {
  const unique = Array.from(
    new Set(paths.map((p) => (typeof p === "string" ? p.trim() : "")).filter(Boolean)),
  )
  await Promise.all(unique.map((p) => deleteStoragePath(p)))
}

export async function createTalent(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly name: string
  readonly agency?: string | null
  readonly email?: string | null
  readonly phone?: string | null
  readonly url?: string | null
  readonly gender?: string | null
  readonly notes?: string | null
  readonly measurements?: Record<string, number | string | null | undefined> | null
  readonly headshotFile?: File | null
}): Promise<string> {
  const name = args.name.trim()
  if (!name) throw new Error("Name is required")

  const path = talentPath(args.clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    clientId: args.clientId,
    name,
    agency: args.agency?.trim() || null,
    email: args.email?.trim() || null,
    phone: args.phone?.trim() || null,
    url: args.url?.trim() || null,
    gender: args.gender?.trim() || null,
    notes: args.notes?.trim() || null,
    measurements: args.measurements ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: args.userId ?? null,
    updatedBy: args.userId ?? null,
  })

  if (args.headshotFile) {
    const storagePath = `images/talent/${ref.id}/headshot.webp`
    const uploaded = await uploadWebpImage(args.headshotFile, storagePath)
    await updateDoc(ref, {
      headshotPath: uploaded.path,
      headshotUrl: uploaded.url,
      imageUrl: uploaded.path,
      updatedAt: serverTimestamp(),
      updatedBy: args.userId ?? null,
    })
  }

  return ref.id
}

export async function updateTalent(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly talentId: string
  readonly patch: Record<string, unknown>
}) {
  const talentId = args.talentId.trim()
  if (!talentId) throw new Error("Missing talent id")

  const path = talentPath(args.clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), talentId), {
    ...args.patch,
    updatedAt: serverTimestamp(),
    updatedBy: args.userId ?? null,
  })
}

export async function setTalentHeadshot(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly talentId: string
  readonly file: File
  readonly previousPath?: string | null
}) {
  const talentId = args.talentId.trim()
  if (!talentId) throw new Error("Missing talent id")

  const storagePath = `images/talent/${talentId}/headshot.webp`
  const uploaded = await uploadWebpImage(args.file, storagePath)

  const path = talentPath(args.clientId)
  const ref = doc(db, path[0]!, ...path.slice(1), talentId)
  await updateDoc(ref, {
    headshotPath: uploaded.path,
    headshotUrl: uploaded.url,
    imageUrl: uploaded.path,
    updatedAt: serverTimestamp(),
    updatedBy: args.userId ?? null,
  })

  if (args.previousPath && args.previousPath !== uploaded.path) {
    await deleteStoragePath(args.previousPath)
  }

  return uploaded
}

export async function removeTalentHeadshot(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly talentId: string
  readonly previousPath?: string | null
}) {
  const talentId = args.talentId.trim()
  if (!talentId) throw new Error("Missing talent id")

  const path = talentPath(args.clientId)
  const ref = doc(db, path[0]!, ...path.slice(1), talentId)
  await updateDoc(ref, {
    headshotPath: null,
    headshotUrl: null,
    imageUrl: null,
    updatedAt: serverTimestamp(),
    updatedBy: args.userId ?? null,
  })

  await deleteStoragePath(args.previousPath ?? null)
}

export async function addTalentToProject(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly talentId: string
  readonly projectId: string
}) {
  const path = talentPath(args.clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), args.talentId), {
    projectIds: arrayUnion(args.projectId),
    updatedAt: serverTimestamp(),
    updatedBy: args.userId ?? null,
  })
}

export async function removeTalentFromProject(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly talentId: string
  readonly projectId: string
}) {
  const path = talentPath(args.clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), args.talentId), {
    projectIds: arrayRemove(args.projectId),
    updatedAt: serverTimestamp(),
    updatedBy: args.userId ?? null,
  })
}
