import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage"
import { db, storage } from "@/shared/lib/firebase"
import { locationsPath, locationDocPath } from "@/shared/lib/paths"
import { compressImageToWebp, validateImageFileForUpload } from "@/shared/lib/uploadImage"

export async function createLocation(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly name: string
  readonly street?: string | null
  readonly unit?: string | null
  readonly city?: string | null
  readonly province?: string | null
  readonly postal?: string | null
  readonly phone?: string | null
  readonly notes?: string | null
  readonly photoFile?: File | null
}): Promise<string> {
  const name = args.name.trim()
  if (!name) throw new Error("Name is required")

  const path = locationsPath(args.clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    clientId: args.clientId,
    name,
    street: args.street?.trim() || null,
    unit: args.unit?.trim() || null,
    city: args.city?.trim() || null,
    province: args.province?.trim() || null,
    postal: args.postal?.trim() || null,
    phone: args.phone?.trim() || null,
    notes: args.notes?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: args.userId ?? null,
  })

  if (args.photoFile) {
    const uploaded = await uploadLocationPhoto({
      clientId: args.clientId,
      locationId: ref.id,
      file: args.photoFile,
    })
    await updateDoc(ref, {
      photoPath: uploaded.path,
      photoUrl: uploaded.url,
      updatedAt: serverTimestamp(),
    })
  }

  return ref.id
}

export async function updateLocation(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly locationId: string
  readonly patch: Record<string, unknown>
}) {
  const locationId = args.locationId.trim()
  if (!locationId) throw new Error("Missing location id")

  const path = locationDocPath(locationId, args.clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1)), {
    ...args.patch,
    updatedAt: serverTimestamp(),
    updatedBy: args.userId ?? null,
  })
}

export async function deleteLocation(args: {
  readonly clientId: string
  readonly locationId: string
  readonly photoPath?: string | null
}) {
  const locationId = args.locationId.trim()
  if (!locationId) throw new Error("Missing location id")

  if (args.photoPath) {
    try {
      await deleteObject(storageRef(storage, args.photoPath))
    } catch {
      // Best-effort cleanup only.
    }
  }

  const path = locationDocPath(locationId, args.clientId)
  await deleteDoc(doc(db, path[0]!, ...path.slice(1)))
}

export async function removeLocationPhoto(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly locationId: string
  readonly photoPath: string | null
}): Promise<void> {
  if (args.photoPath) {
    try {
      await deleteObject(storageRef(storage, args.photoPath))
    } catch {
      // Best-effort cleanup only.
    }
  }

  await updateLocation({
    clientId: args.clientId,
    userId: args.userId,
    locationId: args.locationId,
    patch: { photoPath: null, photoUrl: null },
  })
}

export async function uploadLocationPhoto(args: {
  readonly clientId: string
  readonly locationId: string
  readonly file: File
  readonly previousPath?: string | null
}): Promise<{ path: string; url: string }> {
  validateImageFileForUpload(args.file)
  const blob = await compressImageToWebp(args.file)
  const storagePath = `clients/${args.clientId}/locations/${args.locationId}/photo.webp`
  const ref = storageRef(storage, storagePath)
  await uploadBytes(ref, blob, { contentType: "image/webp" })
  const url = await getDownloadURL(ref)

  if (args.previousPath && args.previousPath !== storagePath) {
    try {
      await deleteObject(storageRef(storage, args.previousPath))
    } catch {
      // Best-effort cleanup only.
    }
  }

  return { path: storagePath, url }
}
