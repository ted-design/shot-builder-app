import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore"
import { deleteObject, ref as storageRef, uploadBytes } from "firebase/storage"
import { db, storage } from "@/shared/lib/firebase"
import {
  productFamilyCommentsPath,
  productFamilyDocumentsPath,
  productFamilySamplesPath,
} from "@/shared/lib/paths"
import { compressImageToWebp } from "@/shared/lib/uploadImage"
import type { ProductSampleStatus, ProductSampleType } from "@/shared/types"

function cleanFileName(name: string): string {
  const normalized = name.split("/").join("-").split("\\").join("-")
  return normalized.split("..").join(".").trim().slice(0, 120)
}

function parseSizeRunCsv(csv: string): string[] {
  return Array.from(
    new Set(
      csv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  )
}

export async function createProductComment(args: {
  readonly clientId: string
  readonly familyId: string
  readonly body: string
  readonly userId: string
  readonly userName?: string | null
  readonly userAvatar?: string | null
}): Promise<string> {
  const { clientId, familyId, body, userId, userName, userAvatar } = args
  const trimmed = body.trim()
  if (!trimmed) throw new Error("Comment is empty.")

  const path = productFamilyCommentsPath(familyId, clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    body: trimmed,
    createdAt: new Date(),
    createdBy: userId,
    createdByName: userName ?? null,
    createdByAvatar: userAvatar ?? null,
    deleted: false,
  })
  return ref.id
}

export async function setProductCommentDeleted(args: {
  readonly clientId: string
  readonly familyId: string
  readonly commentId: string
  readonly deleted: boolean
}): Promise<void> {
  const { clientId, familyId, commentId, deleted } = args
  const base = productFamilyCommentsPath(familyId, clientId)
  await updateDoc(doc(db, base[0]!, ...base.slice(1), commentId), {
    deleted,
  })
}

export async function createProductSample(args: {
  readonly clientId: string
  readonly familyId: string
  readonly userId: string | null
  readonly type: ProductSampleType
  readonly status: ProductSampleStatus
  readonly sizeRunCsv: string
  readonly carrier?: string | null
  readonly tracking?: string | null
  readonly eta?: Date | null
  readonly notes?: string | null
  readonly scopeSkuId?: string | null
}): Promise<string> {
  const {
    clientId,
    familyId,
    userId,
    type,
    status,
    sizeRunCsv,
    carrier,
    tracking,
    eta,
    notes,
    scopeSkuId,
  } = args

  const cleanedSizes = parseSizeRunCsv(sizeRunCsv)

  const path = productFamilySamplesPath(familyId, clientId)
  const ref = await addDoc(collection(db, path[0]!, ...path.slice(1)), {
    type,
    status,
    sizeRun: cleanedSizes,
    carrier: carrier?.trim() || null,
    tracking: tracking?.trim() || null,
    eta: eta ?? null,
    arrivedAt: status === "arrived" ? new Date() : null,
    notes: notes?.trim() || null,
    scopeSkuId: scopeSkuId?.trim() || null,
    deleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: userId,
    updatedBy: userId,
  })

  return ref.id
}

export async function updateProductSample(args: {
  readonly clientId: string
  readonly familyId: string
  readonly sampleId: string
  readonly userId: string | null
  readonly patch: Partial<{
    readonly type: ProductSampleType
    readonly status: ProductSampleStatus
    readonly sizeRun: ReadonlyArray<string>
    readonly carrier: string | null
    readonly tracking: string | null
    readonly eta: Date | null
    readonly arrivedAt: Date | null
    readonly notes: string | null
    readonly scopeSkuId: string | null
    readonly deleted: boolean
  }>
}): Promise<void> {
  const { clientId, familyId, sampleId, userId, patch } = args
  const base = productFamilySamplesPath(familyId, clientId)

  const update: Record<string, unknown> = {
    updatedAt: new Date(),
    updatedBy: userId,
  }

  if (patch.type) update.type = patch.type
  if (patch.status) update.status = patch.status
  if (patch.sizeRun) update.sizeRun = Array.from(new Set(patch.sizeRun.map((s) => s.trim()).filter(Boolean)))
  if (patch.carrier !== undefined) update.carrier = patch.carrier?.trim() || null
  if (patch.tracking !== undefined) update.tracking = patch.tracking?.trim() || null
  if (patch.eta !== undefined) update.eta = patch.eta
  if (patch.arrivedAt !== undefined) update.arrivedAt = patch.arrivedAt
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null
  if (patch.scopeSkuId !== undefined) update.scopeSkuId = patch.scopeSkuId?.trim() || null
  if (patch.deleted !== undefined) update.deleted = patch.deleted

  await updateDoc(doc(db, base[0]!, ...base.slice(1), sampleId), update)
}

export async function createProductDocument(args: {
  readonly clientId: string
  readonly familyId: string
  readonly userId: string
  readonly userName?: string | null
  readonly userAvatar?: string | null
  readonly file: File
}): Promise<string> {
  const { clientId, familyId, userId, userName, userAvatar, file } = args
  if (!file) throw new Error("Missing file.")

  const documentsPath = productFamilyDocumentsPath(familyId, clientId)
  const docRef = doc(collection(db, documentsPath[0]!, ...documentsPath.slice(1)))

  const isImage = typeof file.type === "string" && file.type.startsWith("image/")
  const baseName = cleanFileName(file.name || "document")
  const safeName = isImage
    ? `${baseName.replace(/\.[^/.]+$/, "") || "image"}.webp`
    : baseName
  const storagePath = `docs/productFamilies/${familyId}/${docRef.id}/${safeName}`

  try {
    const contentType = isImage ? "image/webp" : file.type || null
    let sizeBytes: number | null = typeof file.size === "number" ? file.size : null

    if (isImage) {
      const blob = await compressImageToWebp(file)
      sizeBytes = typeof blob.size === "number" ? blob.size : sizeBytes
      await uploadBytes(storageRef(storage, storagePath), blob, { contentType: "image/webp" })
    } else {
      await uploadBytes(storageRef(storage, storagePath), file, {
        contentType: file.type || undefined,
      })
    }

    await setDoc(docRef, {
      name: safeName,
      storagePath,
      contentType,
      sizeBytes,
      createdAt: new Date(),
      createdBy: userId,
      createdByName: userName ?? null,
      createdByAvatar: userAvatar ?? null,
      deleted: false,
    })
  } catch (err) {
    try {
      await deleteObject(storageRef(storage, storagePath))
    } catch {
      // Best-effort.
    }
    throw err
  }

  return docRef.id
}

export async function deleteProductDocument(args: {
  readonly clientId: string
  readonly familyId: string
  readonly documentId: string
  readonly storagePath: string
}): Promise<void> {
  const { clientId, familyId, documentId, storagePath } = args
  const base = productFamilyDocumentsPath(familyId, clientId)
  await deleteDoc(doc(db, base[0]!, ...base.slice(1), documentId))

  try {
    await deleteObject(storageRef(storage, storagePath))
  } catch {
    // Best-effort.
  }
}
