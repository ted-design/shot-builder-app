import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { deleteObject, ref as storageRef, uploadBytes } from "firebase/storage"
import { db, storage } from "@/shared/lib/firebase"
import {
  productFamiliesPath,
  productFamilyCommentsPath,
  productFamilyDocumentsPath,
  productFamilySamplesPath,
  productFamilySkusPath,
} from "@/shared/lib/paths"
import { compressImageToWebp } from "@/shared/lib/uploadImage"
import { resolveEarliestLaunchDate } from "@/features/products/lib/assetRequirements"
import { createProductVersionSnapshot } from "@/features/products/lib/productVersioning"
import type {
  AuthUser,
  ProductAssetRequirements,
  ProductFamily,
  ProductSampleStatus,
  ProductSampleType,
  ProductSku,
} from "@/shared/types"

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
  readonly returnDueDate?: Date | null
  readonly condition?: string | null
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
    returnDueDate,
    condition,
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
    returnDueDate: returnDueDate ?? null,
    condition: condition?.trim() || null,
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
    readonly returnDueDate: Date | null
    readonly condition: string | null
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
  if (patch.returnDueDate !== undefined) update.returnDueDate = patch.returnDueDate
  if (patch.condition !== undefined) update.condition = patch.condition?.trim() || null
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

export async function updateProductFamilyLaunchDate(args: {
  readonly clientId: string
  readonly familyId: string
  readonly userId: string | null
  readonly launchDate: Date | null
  readonly allSkus?: ReadonlyArray<ProductSku>
  readonly previousFamily?: ProductFamily
  readonly user?: AuthUser
}): Promise<void> {
  const { clientId, familyId, userId, launchDate, allSkus, previousFamily, user } = args
  const path = productFamiliesPath(clientId)

  const launchTimestamp = launchDate ? Timestamp.fromDate(launchDate) : null
  const earliest = allSkus
    ? resolveEarliestLaunchDate(launchTimestamp, allSkus)
    : launchTimestamp

  await updateDoc(doc(db, path[0]!, ...path.slice(1), familyId), {
    launchDate: launchDate ?? null,
    earliestLaunchDate: earliest,
    updatedAt: new Date(),
    updatedBy: userId,
  })

  if (previousFamily && user) {
    void createProductVersionSnapshot({
      clientId,
      familyId,
      previousFamily,
      familyPatch: { launchDate: launchDate ?? null },
      user,
      changeType: "update",
    }).catch((err) => {
      console.error("[updateProductFamilyLaunchDate] Version snapshot failed:", err)
    })
  }
}

export async function updateProductSkuAssetRequirements(args: {
  readonly clientId: string
  readonly familyId: string
  readonly skuId: string
  readonly userId: string | null
  readonly assetRequirements: ProductAssetRequirements
  readonly previousSku?: ProductSku
  readonly previousFamily?: ProductFamily
  readonly user?: AuthUser
}): Promise<void> {
  const { clientId, familyId, skuId, userId, assetRequirements, previousSku, previousFamily, user } = args
  const path = productFamilySkusPath(familyId, clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), skuId), {
    assetRequirements,
    updatedAt: new Date(),
    updatedBy: userId,
  })

  if (previousSku && previousFamily && user) {
    void createProductVersionSnapshot({
      clientId,
      familyId,
      previousFamily,
      familyPatch: {},
      user,
      changeType: "update",
      skuChanges: [{
        skuId,
        skuLabel: previousSku.colorName ?? previousSku.name,
        previousSku,
        skuPatch: { assetRequirements },
      }],
    }).catch((err) => {
      console.error("[updateProductSkuAssetRequirements] Version snapshot failed:", err)
    })
  }
}

export async function updateProductSkuLaunchDate(args: {
  readonly clientId: string
  readonly familyId: string
  readonly skuId: string
  readonly userId: string | null
  readonly launchDate: Date | null
}): Promise<void> {
  const { clientId, familyId, skuId, userId, launchDate } = args
  const path = productFamilySkusPath(familyId, clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), skuId), {
    launchDate: launchDate ?? null,
    updatedAt: new Date(),
    updatedBy: userId,
  })
}

export async function updateProductSkuLaunchDateWithSync(args: {
  readonly clientId: string
  readonly familyId: string
  readonly skuId: string
  readonly userId: string | null
  readonly launchDate: Date | null
  readonly familyLaunchDate: Timestamp | null | undefined
  readonly allSkus: ReadonlyArray<ProductSku>
  readonly previousSku?: ProductSku
  readonly previousFamily?: ProductFamily
  readonly user?: AuthUser
}): Promise<void> {
  const {
    clientId, familyId, skuId, userId, launchDate,
    familyLaunchDate, allSkus, previousSku, previousFamily, user,
  } = args

  const batch = writeBatch(db)
  const now = new Date()

  // 1. Update SKU document
  const skuPath = productFamilySkusPath(familyId, clientId)
  const skuRef = doc(db, skuPath[0]!, ...skuPath.slice(1), skuId)
  batch.update(skuRef, {
    launchDate: launchDate ?? null,
    updatedAt: now,
    updatedBy: userId,
  })

  // 2. Recompute earliestLaunchDate with the patched SKU
  const launchTimestamp = launchDate ? Timestamp.fromDate(launchDate) : null
  const patchedSkus = allSkus.map((s) =>
    s.id === skuId ? { ...s, launchDate: launchTimestamp } : s,
  )
  const earliest = resolveEarliestLaunchDate(familyLaunchDate, patchedSkus)

  const familyPath = productFamiliesPath(clientId)
  const familyRef = doc(db, familyPath[0]!, ...familyPath.slice(1), familyId)
  batch.update(familyRef, {
    earliestLaunchDate: earliest,
    updatedAt: now,
    updatedBy: userId,
  })

  await batch.commit()

  // 3. Best-effort version snapshot
  if (previousSku && previousFamily && user) {
    void createProductVersionSnapshot({
      clientId,
      familyId,
      previousFamily,
      familyPatch: {},
      user,
      changeType: "update",
      skuChanges: [{
        skuId,
        skuLabel: previousSku.colorName ?? previousSku.name,
        previousSku,
        skuPatch: { launchDate: launchDate ?? null },
      }],
    }).catch((err) => {
      console.error("[updateProductSkuLaunchDateWithSync] Version snapshot failed:", err)
    })
  }
}

export async function applyLaunchDateToAllSkus(args: {
  readonly clientId: string
  readonly familyId: string
  readonly skuIds: ReadonlyArray<string>
  readonly userId: string | null
  readonly launchDate: Date | null
  readonly previousFamily?: ProductFamily
  readonly previousSkus?: ReadonlyArray<ProductSku>
  readonly user?: AuthUser
}): Promise<void> {
  const {
    clientId, familyId, skuIds, userId, launchDate,
    previousFamily, previousSkus, user,
  } = args

  if (skuIds.length > 498) {
    throw new Error(`Too many colorways (${skuIds.length}). Maximum 498 per batch.`)
  }

  const batch = writeBatch(db)
  const now = new Date()

  // 1. Update family document
  const familyPath = productFamiliesPath(clientId)
  const familyRef = doc(db, familyPath[0]!, ...familyPath.slice(1), familyId)
  batch.update(familyRef, {
    launchDate: launchDate ?? null,
    earliestLaunchDate: launchDate ?? null,
    updatedAt: now,
    updatedBy: userId,
  })

  // 2. Update all SKU documents
  const skuBasePath = productFamilySkusPath(familyId, clientId)
  for (const skuId of skuIds) {
    const skuRef = doc(db, skuBasePath[0]!, ...skuBasePath.slice(1), skuId)
    batch.update(skuRef, {
      launchDate: launchDate ?? null,
      updatedAt: now,
      updatedBy: userId,
    })
  }

  await batch.commit()

  // 3. Best-effort version snapshot
  if (previousFamily && previousSkus && user) {
    const skuChanges = previousSkus
      .filter((s) => skuIds.includes(s.id))
      .map((s) => ({
        skuId: s.id,
        skuLabel: s.colorName ?? s.name,
        previousSku: s,
        skuPatch: { launchDate: launchDate ?? null } as Record<string, unknown>,
      }))

    void createProductVersionSnapshot({
      clientId,
      familyId,
      previousFamily,
      familyPatch: { launchDate: launchDate ?? null },
      user,
      changeType: "update",
      skuChanges,
    }).catch((err) => {
      console.error("[applyLaunchDateToAllSkus] Version snapshot failed:", err)
    })
  }
}

export async function replaceProductSkuImage(args: {
  readonly clientId: string
  readonly familyId: string
  readonly skuId: string
  readonly userId: string | null
  readonly file: File
  readonly previousImagePath?: string | null
}): Promise<string> {
  const { clientId, familyId, skuId, userId, file, previousImagePath } = args

  const blob = await compressImageToWebp(file)
  const storagePath = `products/${familyId}/skus/${skuId}/image.webp`
  await uploadBytes(storageRef(storage, storagePath), blob, { contentType: "image/webp" })

  const path = productFamilySkusPath(familyId, clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), skuId), {
    imagePath: storagePath,
    updatedAt: new Date(),
    updatedBy: userId,
  })

  if (previousImagePath && previousImagePath !== storagePath) {
    try {
      await deleteObject(storageRef(storage, previousImagePath))
    } catch {
      // Best-effort cleanup of previous image.
    }
  }

  return storagePath
}

export async function removeProductSkuImage(args: {
  readonly clientId: string
  readonly familyId: string
  readonly skuId: string
  readonly userId: string | null
  readonly previousImagePath: string
}): Promise<void> {
  const { clientId, familyId, skuId, userId, previousImagePath } = args

  const path = productFamilySkusPath(familyId, clientId)
  await updateDoc(doc(db, path[0]!, ...path.slice(1), skuId), {
    imagePath: null,
    updatedAt: new Date(),
    updatedBy: userId,
  })

  try {
    await deleteObject(storageRef(storage, previousImagePath))
  } catch {
    // Best-effort cleanup.
  }
}

export async function replaceProductFamilyImage(args: {
  readonly clientId: string
  readonly familyId: string
  readonly userId: string | null
  readonly imageType: "thumbnail" | "header"
  readonly file: File
  readonly previousImagePath?: string | null
}): Promise<string> {
  const { clientId, familyId, userId, imageType, file, previousImagePath } = args

  const blob = await compressImageToWebp(file)
  const storagePath = `products/${familyId}/${imageType}.webp`
  await uploadBytes(storageRef(storage, storagePath), blob, { contentType: "image/webp" })

  const fieldName = imageType === "thumbnail" ? "thumbnailImagePath" : "headerImagePath"
  const familyPath = productFamiliesPath(clientId)
  await updateDoc(doc(db, familyPath[0]!, ...familyPath.slice(1), familyId), {
    [fieldName]: storagePath,
    updatedAt: new Date(),
    updatedBy: userId,
  })

  if (previousImagePath && previousImagePath !== storagePath) {
    try {
      await deleteObject(storageRef(storage, previousImagePath))
    } catch {
      // Best-effort cleanup of previous image.
    }
  }

  return storagePath
}
