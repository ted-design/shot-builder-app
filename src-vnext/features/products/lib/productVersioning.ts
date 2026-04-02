import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { productFamilyPath, productFamilyVersionsPath } from "@/shared/lib/paths"
import { normalizeWhitespace } from "@/shared/lib/textUtils"
import type {
  AuthUser,
  ProductFamily,
  ProductSku,
  ProductVersion,
  ProductVersionChangeType,
  ProductVersionFieldChange,
} from "@/shared/types"

// --- Field definitions ---

const VERSIONED_FAMILY_FIELDS: ReadonlyArray<keyof ProductFamily> = [
  "styleName",
  "styleNumber",
  "previousStyleNumber",
  "gender",
  "productType",
  "productSubcategory",
  "launchDate",
  "notes",
  "status",
  "archived",
]

const VERSIONED_SKU_FIELDS: ReadonlyArray<keyof ProductSku> = [
  "colorName",
  "skuCode",
  "sizes",
  "status",
  "archived",
  "launchDate",
  "assetRequirements",
  "imagePath",
]

// --- Field label mapping ---

const FIELD_LABELS: Record<string, string> = {
  styleName: "Style Name",
  styleNumber: "Style Number",
  previousStyleNumber: "Previous Style Number",
  gender: "Gender",
  productType: "Product Type",
  productSubcategory: "Subcategory",
  launchDate: "Launch Date",
  notes: "Notes",
  status: "Status",
  archived: "Archived",
  colorName: "Color Name",
  skuCode: "SKU Code",
  sizes: "Sizes",
  assetRequirements: "Asset Requirements",
  imagePath: "Image",
}

export function humanizeFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())
}

// --- Text normalization (mirrors shot versioning) ---

function stripHtmlToText(html: unknown): string {
  if (html === null || html === undefined || html === "") return ""
  if (typeof html !== "string") return ""
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeVersionText(value: unknown): string {
  if (value === null || value === undefined || value === "") return ""
  if (typeof value !== "string") return ""
  return normalizeWhitespace(value)
}

function notesMeaningfullyDifferent(prevNotes: unknown, nextNotes: unknown): boolean {
  const prevText = normalizeVersionText(stripHtmlToText(prevNotes))
  const nextText = normalizeVersionText(stripHtmlToText(nextNotes))
  return prevText !== nextText
}

// --- Snapshot builders ---

function buildSnapshot(
  entity: Record<string, unknown>,
  fields: ReadonlyArray<string>,
  patch: Record<string, unknown> = {},
): Record<string, unknown> {
  const snapshot: Record<string, unknown> = {}
  for (const key of fields) {
    const nextValue = Object.prototype.hasOwnProperty.call(patch, key)
      ? patch[key]
      : entity[key]
    snapshot[key] = nextValue === undefined ? null : nextValue
  }
  return snapshot
}

export function buildFamilySnapshot(
  family: ProductFamily,
  patch: Record<string, unknown> = {},
): Record<string, unknown> {
  return buildSnapshot(
    family as unknown as Record<string, unknown>,
    VERSIONED_FAMILY_FIELDS as unknown as string[],
    patch,
  )
}

export function buildSkuSnapshot(
  sku: ProductSku,
  patch: Record<string, unknown> = {},
): Record<string, unknown> {
  return buildSnapshot(
    sku as unknown as Record<string, unknown>,
    VERSIONED_SKU_FIELDS as unknown as string[],
    patch,
  )
}

// --- Change detection ---

function getChangedFields(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
  fields: ReadonlyArray<string>,
): string[] {
  if (!previous) return []
  const changed: string[] = []
  for (const field of fields) {
    const prevValue = previous[field]
    const currValue = current[field]
    if (field === "notes") {
      if (notesMeaningfullyDifferent(prevValue, currValue)) changed.push(field)
      continue
    }
    if (JSON.stringify(prevValue) !== JSON.stringify(currValue)) {
      changed.push(field)
    }
  }
  return changed
}

export function getChangedFamilyFields(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
): string[] {
  return getChangedFields(previous, current, VERSIONED_FAMILY_FIELDS as unknown as string[])
}

export function getChangedSkuFields(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
): string[] {
  return getChangedFields(previous, current, VERSIONED_SKU_FIELDS as unknown as string[])
}

// --- Before→after field change builder ---

export function buildFieldChanges(
  previous: Record<string, unknown> | null,
  current: Record<string, unknown>,
  fields: ReadonlyArray<string>,
  labelPrefix?: string,
): ProductVersionFieldChange[] {
  if (!previous) return []
  const changes: ProductVersionFieldChange[] = []
  for (const field of fields) {
    const prev = previous[field]
    const curr = current[field]
    if (field === "notes") {
      if (!notesMeaningfullyDifferent(prev, curr)) continue
    } else if (JSON.stringify(prev) === JSON.stringify(curr)) {
      continue
    }
    changes.push({
      field,
      label: labelPrefix
        ? `${labelPrefix}: ${humanizeFieldLabel(field)}`
        : humanizeFieldLabel(field),
      previousValue: prev ?? null,
      currentValue: curr ?? null,
    })
  }
  return changes
}

// --- Version snapshot creation ---

export async function createProductVersionSnapshot(args: {
  readonly clientId: string
  readonly familyId: string
  readonly previousFamily: ProductFamily | null
  readonly familyPatch: Record<string, unknown>
  readonly user: AuthUser
  readonly changeType: ProductVersionChangeType
  readonly skuChanges?: ReadonlyArray<{
    readonly skuId: string
    readonly skuLabel: string
    readonly previousSku: ProductSku | null
    readonly skuPatch: Record<string, unknown>
  }>
}): Promise<string | null> {
  const { clientId, familyId, previousFamily, familyPatch, user, changeType, skuChanges } = args

  if (!clientId || !familyId) return null
  if (!user?.uid) return null

  const previousSnapshot = previousFamily
    ? buildFamilySnapshot(previousFamily)
    : null
  const currentSnapshot = previousFamily
    ? buildFamilySnapshot(previousFamily, familyPatch)
    : buildFamilySnapshot(familyPatch as unknown as ProductFamily)

  const changedFamilyFields =
    changeType === "update"
      ? getChangedFamilyFields(previousSnapshot, currentSnapshot)
      : []

  const familyFieldChanges =
    changeType === "update"
      ? buildFieldChanges(
          previousSnapshot,
          currentSnapshot,
          VERSIONED_FAMILY_FIELDS as unknown as string[],
        )
      : []

  // Process SKU-level changes
  const skuSnapshots: Record<string, Record<string, unknown>> = {}
  const allChangedFields = [...changedFamilyFields]
  const allFieldChanges = [...familyFieldChanges]

  if (skuChanges) {
    for (const { skuId, skuLabel, previousSku, skuPatch } of skuChanges) {
      const prevSkuSnap = previousSku ? buildSkuSnapshot(previousSku) : null
      const currSkuSnap = previousSku
        ? buildSkuSnapshot(previousSku, skuPatch)
        : buildSkuSnapshot(skuPatch as unknown as ProductSku)

      const skuFieldNames = getChangedSkuFields(prevSkuSnap, currSkuSnap)
      const skuFieldChangeEntries = buildFieldChanges(
        prevSkuSnap,
        currSkuSnap,
        VERSIONED_SKU_FIELDS as unknown as string[],
        skuLabel,
      )

      if (changeType === "update" && skuFieldNames.length === 0) continue

      skuSnapshots[skuId] = currSkuSnap
      for (const f of skuFieldNames) {
        allChangedFields.push(`${skuLabel}: ${f}`)
      }
      allFieldChanges.push(...skuFieldChangeEntries)
    }
  }

  // Skip no-op updates
  if (changeType === "update" && allChangedFields.length === 0) return null

  const path = productFamilyVersionsPath(familyId, clientId)
  const versionsRef = collection(db, path[0]!, ...path.slice(1))

  const targetSkuId =
    skuChanges && skuChanges.length === 1 ? skuChanges[0]!.skuId : null
  const targetSkuLabel =
    skuChanges && skuChanges.length === 1 ? skuChanges[0]!.skuLabel : null

  const versionData: Omit<ProductVersion, "id"> = {
    snapshot: currentSnapshot,
    skuSnapshots: Object.keys(skuSnapshots).length > 0 ? skuSnapshots : undefined,
    fieldChanges: allFieldChanges.length > 0 ? allFieldChanges : undefined,
    createdAt: undefined,
    createdBy: user.uid,
    createdByName: user.displayName ?? user.email ?? null,
    createdByAvatar: user.photoURL ?? null,
    changeType,
    changedFields: allChangedFields,
    targetSkuId,
    targetSkuLabel,
  }

  const ref = await addDoc(versionsRef, {
    ...versionData,
    createdAt: serverTimestamp(),
  })

  return ref.id
}

// --- Version restore ---

function buildRestorePatch(
  snapshot: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  for (const key of VERSIONED_FAMILY_FIELDS) {
    const field = key as string
    if (Object.prototype.hasOwnProperty.call(snapshot, field)) {
      patch[field] = snapshot[field]
    } else {
      patch[field] = null
    }
  }
  return patch
}

export async function restoreProductVersion(args: {
  readonly clientId: string
  readonly familyId: string
  readonly version: ProductVersion
  readonly currentFamily: ProductFamily
  readonly user: AuthUser
}): Promise<void> {
  const { clientId, familyId, version, currentFamily, user } = args
  if (!clientId) throw new Error("Missing clientId.")
  if (!familyId) throw new Error("Missing familyId.")
  if (!user?.uid) throw new Error("Not authenticated.")

  const patch = buildRestorePatch(version.snapshot ?? {})

  const familyDocPath = productFamilyPath(familyId, clientId)
  const familyRef = doc(db, familyDocPath[0]!, ...familyDocPath.slice(1))
  await updateDoc(familyRef, {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  })

  // Best-effort: write rollback version
  try {
    await createProductVersionSnapshot({
      clientId,
      familyId,
      previousFamily: currentFamily,
      familyPatch: patch,
      user,
      changeType: "rollback",
    })
  } catch (err) {
    console.error("[restoreProductVersion] Failed to write rollback version:", err)
  }
}

export async function restoreProductVersionById(args: {
  readonly clientId: string
  readonly familyId: string
  readonly versionId: string
  readonly currentFamily: ProductFamily
  readonly user: AuthUser
}): Promise<void> {
  const { clientId, familyId, versionId, currentFamily, user } = args
  const versionsPath = productFamilyVersionsPath(familyId, clientId)
  const versionRef = doc(db, versionsPath[0]!, ...versionsPath.slice(1), versionId)
  const snap = await getDoc(versionRef)
  if (!snap.exists()) throw new Error("Version not found.")
  const version = {
    id: snap.id,
    ...(snap.data() as Record<string, unknown>),
  } as ProductVersion
  await restoreProductVersion({ clientId, familyId, version, currentFamily, user })
}
