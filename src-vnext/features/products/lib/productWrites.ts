import {
  addDoc,
  collection,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore"
import { deleteObject, ref as storageRef, uploadBytes } from "firebase/storage"
import { db, storage } from "@/shared/lib/firebase"
import { productFamiliesPath, productFamilySkusPath } from "@/shared/lib/paths"
import { compressImageToWebp } from "@/shared/lib/uploadImage"
import type { ProductFamily, ProductSku } from "@/shared/types"

const ACTIVE_SKU_STATUSES = new Set(["active", "phasing_out", "coming_soon"])

function isActiveSkuStatus(status: string | undefined): boolean {
  if (!status) return false
  return ACTIVE_SKU_STATUSES.has(status.trim().toLowerCase())
}

function normalizeSizes(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

function skuSizesForWrite(sku: ProductSkuDraft, familySizes: ReadonlyArray<string>): string[] {
  const normalized = normalizeSizes(sku.sizesCsv)
  return normalized.length > 0 ? normalized : [...familySizes]
}

function unique(values: ReadonlyArray<string>): string[] {
  return Array.from(new Set(values.map((v) => v.trim()).filter(Boolean)))
}

async function uploadWebpImage(file: File, storagePath: string): Promise<string> {
  const blob = await compressImageToWebp(file)
  const ref = storageRef(storage, storagePath)
  await uploadBytes(ref, blob, { contentType: "image/webp" })
  return storagePath
}

async function deleteStoragePath(path: string | null | undefined): Promise<void> {
  if (!path) return
  try {
    await deleteObject(storageRef(storage, path))
  } catch {
    // Best-effort cleanup only.
  }
}

export interface ProductSkuDraft {
  readonly id?: string
  readonly colorName: string
  readonly skuCode: string
  readonly sizesCsv: string
  readonly status: string
  readonly archived: boolean
  readonly imagePath?: string | null
  readonly imageFile?: File | null
  readonly removeImage?: boolean
  readonly colorKey?: string
  readonly hexColor?: string
  readonly deleted?: boolean
}

export interface ProductFamilyDraft {
  readonly styleName: string
  readonly styleNumber: string
  readonly previousStyleNumber: string
  readonly gender: string
  readonly productType: string
  readonly productSubcategory: string
  readonly status: string
  readonly archived: boolean
  readonly sizesCsv: string
  readonly notes: string
  readonly headerImagePath?: string | null
  readonly thumbnailImagePath?: string | null
  readonly headerImageFile?: File | null
  readonly thumbnailImageFile?: File | null
  readonly removeHeaderImage?: boolean
  readonly removeThumbnailImage?: boolean
}

function computeFamilyAggregates(
  skus: ReadonlyArray<ProductSkuDraft>,
  familySizes: ReadonlyArray<string>,
): Pick<ProductFamily, "skuCount" | "activeSkuCount" | "skuCodes" | "colorNames" | "sizeOptions"> {
  const activeSkus = skus.filter((s) => s.deleted !== true)

  const skuCodes = unique(activeSkus.map((s) => s.skuCode).filter(Boolean))
  const colorNames = unique(activeSkus.map((s) => s.colorName).filter(Boolean))
  const sizeOptions = unique([
    ...familySizes,
    ...activeSkus.flatMap((s) => normalizeSizes(s.sizesCsv)),
  ])

  const activeSkuCount = activeSkus.reduce((acc, s) => {
    return acc + (isActiveSkuStatus(s.status) ? 1 : 0)
  }, 0)

  return {
    skuCount: activeSkus.length,
    activeSkuCount,
    skuCodes,
    colorNames,
    sizeOptions,
  }
}

export async function createProductFamilyWithSkus(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly family: ProductFamilyDraft
  readonly skus: ReadonlyArray<ProductSkuDraft>
}): Promise<string> {
  const { clientId, userId, family, skus } = args
  const trimmedName = family.styleName.trim()
  if (!trimmedName) throw new Error("Style name is required.")
  const usableSkus = skus
    .filter((s) => s.deleted !== true)
    .map((s) => ({ ...s, colorName: s.colorName.trim() }))
    .filter((s) => s.colorName.length > 0)
  if (usableSkus.length === 0) throw new Error("At least one colorway is required.")

  const familySizes = normalizeSizes(family.sizesCsv)
  const aggregates = computeFamilyAggregates(usableSkus, familySizes)

  const basePath = productFamiliesPath(clientId)
  const familyRef = await addDoc(collection(db, basePath[0]!, ...basePath.slice(1)), {
    styleName: trimmedName,
    styleNumber: family.styleNumber.trim() || null,
    previousStyleNumber: family.previousStyleNumber.trim() || null,
    gender: family.gender.trim() || "",
    productType: family.productType.trim() || null,
    productSubcategory: family.productSubcategory.trim() || null,
    status: family.status.trim() || "active",
    archived: Boolean(family.archived),
    notes: family.notes.trim() || null,
    headerImagePath: null,
    thumbnailImagePath: null,
    sizes: familySizes,
    skuCount: aggregates.skuCount,
    activeSkuCount: aggregates.activeSkuCount,
    skuCodes: aggregates.skuCodes,
    colorNames: aggregates.colorNames,
    sizeOptions: aggregates.sizeOptions,
    shotIds: [],
    deleted: false,
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
    clientId,
  })

  const familyId = familyRef.id

  let headerImagePath: string | null = null
  let thumbnailImagePath: string | null = null

  if (family.headerImageFile) {
    headerImagePath = await uploadWebpImage(
      family.headerImageFile,
      `images/productFamilies/${familyId}/${Date.now()}-header.webp`,
    )
  }

  if (family.thumbnailImageFile) {
    thumbnailImagePath = await uploadWebpImage(
      family.thumbnailImageFile,
      `images/productFamilies/${familyId}/thumbnail/${Date.now()}-thumbnail.webp`,
    )
  }

  const skuPath = productFamilySkusPath(familyId, clientId)
  const skuCollection = collection(db, skuPath[0]!, ...skuPath.slice(1))
  let firstSkuImagePath: string | null = null

  for (const sku of usableSkus) {
    const skuRef = doc(skuCollection)
    let imagePath = sku.imagePath ?? null

    if (sku.imageFile) {
      imagePath = await uploadWebpImage(
        sku.imageFile,
        `images/productFamilies/${familyId}/skus/${skuRef.id}/${Date.now()}-sku.webp`,
      )
    }

    if (!firstSkuImagePath && imagePath) {
      firstSkuImagePath = imagePath
    }

    await setDoc(skuRef, {
      colorName: sku.colorName.trim(),
      skuCode: sku.skuCode.trim() || null,
      sizes: skuSizesForWrite(sku, familySizes),
      status: sku.status.trim() || "active",
      archived: Boolean(sku.archived),
      imagePath,
      colorKey: sku.colorKey?.trim() || null,
      hexColor: sku.hexColor?.trim() || null,
      deleted: false,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
    })
  }

  const finalThumbnail = thumbnailImagePath ?? firstSkuImagePath ?? headerImagePath
  if (headerImagePath || finalThumbnail) {
    await updateDoc(familyRef, {
      ...(headerImagePath ? { headerImagePath } : {}),
      ...(finalThumbnail ? { thumbnailImagePath: finalThumbnail } : {}),
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    })
  }

  return familyId
}

export async function updateProductFamilyWithSkus(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly familyId: string
  readonly family: ProductFamilyDraft
  readonly skus: ReadonlyArray<ProductSkuDraft>
  readonly existingSkus: ReadonlyArray<ProductSku>
}): Promise<void> {
  const { clientId, userId, familyId, family, skus, existingSkus } = args
  const trimmedName = family.styleName.trim()
  if (!trimmedName) throw new Error("Style name is required.")
  const usableSkus = skus.map((s) => ({ ...s, colorName: s.colorName.trim() }))
  if (usableSkus.filter((s) => s.deleted !== true && s.colorName.length > 0).length === 0) {
    throw new Error("At least one colorway is required.")
  }

  const familySizes = normalizeSizes(family.sizesCsv)
  const aggregates = computeFamilyAggregates(usableSkus, familySizes)

  const famPath = productFamiliesPath(clientId)
  const familyRef = doc(db, famPath[0]!, ...famPath.slice(1), familyId)

  const previousHeaderPath = family.headerImagePath ?? null
  const previousThumbPath = family.thumbnailImagePath ?? null

  let headerImagePath: string | null = family.removeHeaderImage ? null : previousHeaderPath
  let thumbnailImagePath: string | null = family.removeThumbnailImage ? null : previousThumbPath

  if (family.headerImageFile) {
    await deleteStoragePath(previousHeaderPath)
    headerImagePath = await uploadWebpImage(
      family.headerImageFile,
      `images/productFamilies/${familyId}/${Date.now()}-header.webp`,
    )
  } else if (family.removeHeaderImage) {
    await deleteStoragePath(previousHeaderPath)
  }

  if (family.thumbnailImageFile) {
    await deleteStoragePath(previousThumbPath)
    thumbnailImagePath = await uploadWebpImage(
      family.thumbnailImageFile,
      `images/productFamilies/${familyId}/thumbnail/${Date.now()}-thumbnail.webp`,
    )
  } else if (family.removeThumbnailImage) {
    await deleteStoragePath(previousThumbPath)
  }

  await updateDoc(familyRef, {
    styleName: trimmedName,
    styleNumber: family.styleNumber.trim() || null,
    previousStyleNumber: family.previousStyleNumber.trim() || null,
    gender: family.gender.trim() || "",
    productType: family.productType.trim() || null,
    productSubcategory: family.productSubcategory.trim() || null,
    status: family.status.trim() || "active",
    archived: Boolean(family.archived),
    sizes: familySizes,
    notes: family.notes.trim() || null,
    headerImagePath,
    thumbnailImagePath,
    skuCount: aggregates.skuCount,
    activeSkuCount: aggregates.activeSkuCount,
    skuCodes: aggregates.skuCodes,
    colorNames: aggregates.colorNames,
    sizeOptions: aggregates.sizeOptions,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })

  const existingById = new Map(existingSkus.map((s) => [s.id, s]))
  const skuPath = productFamilySkusPath(familyId, clientId)
  const skuCollection = collection(db, skuPath[0]!, ...skuPath.slice(1))

  const batch = writeBatch(db)
  let firstActiveSkuImagePath: string | null = null

  for (const draft of usableSkus) {
    const isDeleted = draft.deleted === true
    const id = draft.id

    if (!id && isDeleted) {
      continue
    }

    const ref = id ? doc(skuCollection, id) : doc(skuCollection)

    const previous = id ? existingById.get(id) : null
    let imagePath = isDeleted ? (previous?.imagePath ?? null) : (draft.imagePath ?? previous?.imagePath ?? null)

    if (!isDeleted) {
      if (draft.imageFile) {
        if (previous?.imagePath) {
          await deleteStoragePath(previous.imagePath ?? null)
        }
        imagePath = await uploadWebpImage(
          draft.imageFile,
          `images/productFamilies/${familyId}/skus/${ref.id}/${Date.now()}-sku.webp`,
        )
      } else if (draft.removeImage) {
        if (previous?.imagePath) {
          await deleteStoragePath(previous.imagePath ?? null)
        }
        imagePath = null
      }
    }

    const payload = {
      colorName: draft.colorName.trim(),
      skuCode: draft.skuCode.trim() || null,
      sizes: skuSizesForWrite(draft, familySizes),
      status: draft.status.trim() || "active",
      archived: Boolean(draft.archived),
      imagePath,
      colorKey: draft.colorKey?.trim() || null,
      hexColor: draft.hexColor?.trim() || null,
      deleted: Boolean(isDeleted),
      deletedAt: isDeleted ? serverTimestamp() : null,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
      ...(id
        ? {}
        : {
            createdAt: serverTimestamp(),
            createdBy: userId,
          }),
    }

    batch.set(ref, payload, { merge: true })

    if (!isDeleted && !firstActiveSkuImagePath && imagePath) {
      firstActiveSkuImagePath = imagePath
    }
  }

  await batch.commit()

  if (!thumbnailImagePath) {
    const fallback = firstActiveSkuImagePath ?? headerImagePath
    if (fallback) {
      await updateDoc(familyRef, {
        thumbnailImagePath: fallback,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      })
    }
  }
}

export async function bulkCreateSkus(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly familyId: string
  readonly colorNames: ReadonlyArray<string>
  readonly existingColorNames: ReadonlyArray<string>
  readonly existingSkuCount: number
  readonly existingActiveSkuCount: number
  readonly familySizes: ReadonlyArray<string>
}): Promise<number> {
  const { clientId, userId, familyId, colorNames, existingColorNames, existingSkuCount, existingActiveSkuCount, familySizes } = args
  const existingSet = new Set(existingColorNames.map((n) => n.toLowerCase()))

  const newNames = unique(
    colorNames
      .map((n) => n.trim())
      .filter((n) => n.length > 0 && !existingSet.has(n.toLowerCase())),
  )

  if (newNames.length === 0) return 0

  const skuPath = productFamilySkusPath(familyId, clientId)
  const skuCollection = collection(db, skuPath[0]!, ...skuPath.slice(1))
  const batch = writeBatch(db)

  for (const name of newNames) {
    const ref = doc(skuCollection)
    batch.set(ref, {
      colorName: name,
      skuCode: null,
      sizes: [...familySizes],
      status: "active",
      archived: false,
      imagePath: null,
      colorKey: null,
      hexColor: null,
      deleted: false,
      deletedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: userId,
      updatedBy: userId,
    })
  }

  // Update family aggregates
  const famPath = productFamiliesPath(clientId)
  const familyRef = doc(db, famPath[0]!, ...famPath.slice(1), familyId)
  const mergedColorNames = unique([...existingColorNames, ...newNames])
  batch.update(familyRef, {
    colorNames: mergedColorNames,
    skuCount: existingSkuCount + newNames.length,
    activeSkuCount: existingActiveSkuCount + newNames.length,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })

  await batch.commit()
  return newNames.length
}

export async function setProductFamilyArchived(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly familyId: string
  readonly archived: boolean
}): Promise<void> {
  const { clientId, userId, familyId, archived } = args
  const famPath = productFamiliesPath(clientId)
  const familyRef = doc(db, famPath[0]!, ...famPath.slice(1), familyId)
  await updateDoc(familyRef, {
    archived: Boolean(archived),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}

export async function setProductFamilyDeleted(args: {
  readonly clientId: string
  readonly userId: string | null
  readonly familyId: string
  readonly deleted: boolean
}): Promise<void> {
  const { clientId, userId, familyId, deleted } = args
  const famPath = productFamiliesPath(clientId)
  const familyRef = doc(db, famPath[0]!, ...famPath.slice(1), familyId)
  await updateDoc(familyRef, {
    deleted: Boolean(deleted),
    deletedAt: deleted ? serverTimestamp() : null,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  })
}
