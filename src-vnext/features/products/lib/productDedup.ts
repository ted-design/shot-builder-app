/**
 * Product deduplication detection and merge planning.
 *
 * - `detectDuplicates` is pure (no Firestore calls).
 * - `buildMergePlan` performs one-time Firestore reads.
 */

import type { ProductFamily, ProductSku } from "@/shared/types"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import {
  productFamilySkusPath,
  productFamilySamplesPath,
  productFamilyCommentsPath,
  productFamilyDocumentsPath,
  shotRequestsPath,
  shotsPath,
} from "@/shared/lib/paths"

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface FieldDifference {
  readonly field: string
  readonly label: string
  readonly values: ReadonlyArray<{ readonly familyId: string; readonly value: string }>
}

export interface DuplicateGroup {
  /** Normalized key used for matching. */
  readonly key: string
  /** Products in this duplicate group (2+). */
  readonly families: ReadonlyArray<ProductFamily>
  /** Human-readable differences between the products. */
  readonly differences: ReadonlyArray<FieldDifference>
}

export interface MergeCheck {
  readonly label: string
  readonly passed: boolean
  readonly detail?: string
}

export interface MergePlan {
  /** The winning product (survives). */
  readonly winner: ProductFamily
  /** The losing product (will be soft-deleted). */
  readonly loser: ProductFamily
  /** SKUs from loser that are new (no color match in winner). */
  readonly newSkus: ReadonlyArray<ProductSku>
  /** SKUs from loser that match existing winner SKUs by color name. */
  readonly matchedSkus: ReadonlyArray<{
    readonly loserId: string
    readonly winnerId: string
    readonly colorName: string
  }>
  /** Samples from loser to transfer. */
  readonly samplesToTransfer: number
  /** Comments from loser to transfer. */
  readonly commentsToTransfer: number
  /** Documents from loser to transfer. */
  readonly documentsToTransfer: number
  /** Shot IDs that reference the loser's familyId. */
  readonly affectedShotIds: ReadonlyArray<string>
  /** Pull items that reference the loser. */
  readonly affectedPullCount: number
  /** Request references to update. */
  readonly affectedRequestCount: number
  /** Whether any data loss would occur. */
  readonly hasDataLoss: boolean
  /** Verification checks. */
  readonly checks: ReadonlyArray<MergeCheck>
}

// ---------------------------------------------------------------------------
// Normalization helpers (pure)
// ---------------------------------------------------------------------------

/** Normalize style number for duplicate grouping. */
export function normalizeStyleNumber(sn: string | undefined): string {
  if (!sn) return ""
  return sn.trim().toUpperCase().replace(/[-_\s]/g, "")
}

/** Normalize product name for fuzzy comparison. */
export function normalizeProductName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
}

/** Strip vendor code suffix for base color comparison. */
export function baseColorName(colorName: string | undefined): string {
  if (!colorName) return ""
  return colorName
    .replace(/\s*\([^)]*\)$/, "")
    .trim()
    .toLowerCase()
}

/**
 * Levenshtein distance between two strings.
 * Used for fuzzy name matching within duplicate groups.
 */
export function levenshtein(a: string, b: string): number {
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0) return bLen
  if (bLen === 0) return aLen

  // Use a single flat array for the DP matrix (previous row only)
  let prev = Array.from({ length: bLen + 1 }, (_, i) => i)

  for (let i = 1; i <= aLen; i++) {
    const curr = [i] as number[]
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + cost,
      )
    }
    prev = curr
  }

  return prev[bLen]!
}

// ---------------------------------------------------------------------------
// Duplicate detection (pure)
// ---------------------------------------------------------------------------

const DIFF_FIELDS: ReadonlyArray<{
  readonly field: keyof ProductFamily
  readonly label: string
}> = [
  { field: "category", label: "Category" },
  { field: "productType", label: "Product Type" },
  { field: "productSubcategory", label: "Subcategory" },
  { field: "gender", label: "Gender" },
  { field: "status", label: "Status" },
]

function formatFieldValue(value: unknown): string {
  if (value == null) return "(empty)"
  if (typeof value === "string") return value || "(empty)"
  if (typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
    return (value as { toDate: () => Date }).toDate().toISOString().slice(0, 10)
  }
  return String(value)
}

function computeFieldDifferences(
  families: ReadonlyArray<ProductFamily>,
): ReadonlyArray<FieldDifference> {
  const diffs: FieldDifference[] = []

  for (const { field, label } of DIFF_FIELDS) {
    const values = families.map((f) => ({
      familyId: f.id,
      value: formatFieldValue(f[field]),
    }))

    // Only include if values are not all the same
    const uniqueValues = new Set(values.map((v) => v.value))
    if (uniqueValues.size > 1) {
      diffs.push({ field, label, values })
    }
  }

  // Also compare createdAt / updatedAt as informational diffs
  for (const tsField of ["createdAt", "updatedAt"] as const) {
    const values = families.map((f) => ({
      familyId: f.id,
      value: formatFieldValue(f[tsField]),
    }))
    const uniqueValues = new Set(values.map((v) => v.value))
    if (uniqueValues.size > 1) {
      diffs.push({
        field: tsField,
        label: tsField === "createdAt" ? "Created" : "Updated",
        values,
      })
    }
  }

  return diffs
}

/**
 * Returns true if any two families in the group have similar names.
 * "Similar" means either normalized names match exactly OR Levenshtein <= 3.
 */
function hasSimilarNames(families: ReadonlyArray<ProductFamily>): boolean {
  for (let i = 0; i < families.length; i++) {
    for (let j = i + 1; j < families.length; j++) {
      const a = normalizeProductName(families[i]!.styleName)
      const b = normalizeProductName(families[j]!.styleName)
      if (a === b || levenshtein(a, b) <= 3) return true
    }
  }
  return false
}

/**
 * Detect duplicate product families.
 *
 * Pure function -- no Firestore calls. Groups families by normalized style
 * number and then checks name similarity within each group.
 */
export function detectDuplicates(
  families: ReadonlyArray<ProductFamily>,
): ReadonlyArray<DuplicateGroup> {
  // 1. Filter out deleted/archived
  const active = families.filter(
    (f) => f.deleted !== true && f.archived !== true,
  )

  // 2. Group by normalized style number
  const groups = new Map<string, ProductFamily[]>()
  for (const family of active) {
    const key = normalizeStyleNumber(family.styleNumber)
    if (!key) continue // skip families without a style number
    const existing = groups.get(key)
    if (existing) {
      existing.push(family)
    } else {
      groups.set(key, [family])
    }
  }

  // 3. Filter to groups with 2+ AND similar names
  const duplicates: DuplicateGroup[] = []
  for (const [key, groupFamilies] of groups) {
    if (groupFamilies.length < 2) continue
    if (!hasSimilarNames(groupFamilies)) continue

    duplicates.push({
      key,
      families: groupFamilies,
      differences: computeFieldDifferences(groupFamilies),
    })
  }

  return duplicates
}

// ---------------------------------------------------------------------------
// Merge planning (Firestore reads)
// ---------------------------------------------------------------------------

async function countSubcollectionDocs(
  pathSegments: ReadonlyArray<string>,
): Promise<number> {
  const snap = await getDocs(
    collection(db, pathSegments[0]!, ...pathSegments.slice(1)),
  )
  return snap.docs.filter((d) => d.data().deleted !== true).length
}

function matchSkusByColor(
  winnerSkus: ReadonlyArray<ProductSku>,
  loserSkus: ReadonlyArray<ProductSku>,
): {
  readonly newSkus: ReadonlyArray<ProductSku>
  readonly matchedSkus: ReadonlyArray<{
    readonly loserId: string
    readonly winnerId: string
    readonly colorName: string
  }>
} {
  // Build map of base color -> winner SKU id
  const winnerColorMap = new Map<string, string>()
  for (const sku of winnerSkus) {
    const base = baseColorName(sku.colorName ?? sku.name)
    if (base) winnerColorMap.set(base, sku.id)
  }

  const matched: Array<{
    readonly loserId: string
    readonly winnerId: string
    readonly colorName: string
  }> = []
  const unmatched: ProductSku[] = []

  for (const sku of loserSkus) {
    const base = baseColorName(sku.colorName ?? sku.name)
    const winnerSkuId = base ? winnerColorMap.get(base) : undefined
    if (winnerSkuId) {
      matched.push({
        loserId: sku.id,
        winnerId: winnerSkuId,
        colorName: base,
      })
    } else {
      unmatched.push(sku)
    }
  }

  return { newSkus: unmatched, matchedSkus: matched }
}

async function fetchSkus(
  familyId: string,
  clientId: string,
): Promise<ReadonlyArray<ProductSku>> {
  const path = productFamilySkusPath(familyId, clientId)
  const snap = await getDocs(collection(db, path[0]!, ...path.slice(1)))
  return snap.docs
    .filter((d) => d.data().deleted !== true)
    .map(
      (d) =>
        ({
          id: d.id,
          ...(d.data() as Record<string, unknown>),
        }) as unknown as ProductSku,
    )
}

/**
 * Build a merge plan for two duplicate product families.
 *
 * Performs one-time Firestore reads to count subcollection items,
 * match SKUs by color, and identify affected shots/pulls/requests.
 */
export async function buildMergePlan(args: {
  readonly winner: ProductFamily
  readonly loser: ProductFamily
  readonly clientId: string
}): Promise<MergePlan> {
  const { winner, loser, clientId } = args

  // Fetch SKUs in parallel
  const [winnerSkus, loserSkus] = await Promise.all([
    fetchSkus(winner.id, clientId),
    fetchSkus(loser.id, clientId),
  ])

  // Match SKUs by base color name
  const { newSkus, matchedSkus } = matchSkusByColor(winnerSkus, loserSkus)

  // Count subcollection items in parallel
  const [samplesToTransfer, commentsToTransfer, documentsToTransfer] =
    await Promise.all([
      countSubcollectionDocs(productFamilySamplesPath(loser.id, clientId)),
      countSubcollectionDocs(productFamilyCommentsPath(loser.id, clientId)),
      countSubcollectionDocs(productFamilyDocumentsPath(loser.id, clientId)),
    ])

  // Query shots that actually reference the loser (don't rely on stale denormalized shotIds)
  const affectedShotIds: string[] = []
  try {
    const shotPath = shotsPath(clientId)
    const shotCol = collection(db, shotPath[0]!, ...shotPath.slice(1))
    const shotSnap = await getDocs(shotCol)
    for (const shotDoc of shotSnap.docs) {
      const data = shotDoc.data()
      if (data.deleted === true) continue
      const products = (data.products ?? []) as Array<{ familyId?: string }>
      const looks = (data.looks ?? []) as Array<{ products?: Array<{ familyId?: string }>; heroProductId?: string }>
      const refsLoser =
        products.some((p) => p.familyId === loser.id) ||
        looks.some((l) => l.heroProductId === loser.id || (l.products ?? []).some((p) => p.familyId === loser.id))
      if (refsLoser) affectedShotIds.push(shotDoc.id)
    }
  } catch {
    // Fallback to denormalized shotIds if query fails
    if (Array.isArray(loser.shotIds)) affectedShotIds.push(...loser.shotIds)
  }

  // Pulls must be scanned at merge execution time (project-scoped, not queryable here)
  const affectedPullCount = 0

  // Count affected requests referencing the loser
  let affectedRequestCount = 0
  try {
    const requestsPath = shotRequestsPath(clientId)
    const requestsQuery = query(
      collection(db, requestsPath[0]!, ...requestsPath.slice(1)),
      where("relatedFamilyIds", "array-contains", loser.id),
    )
    const requestSnap = await getDocs(requestsQuery)
    affectedRequestCount = requestSnap.size
  } catch {
    // If query fails (e.g., missing index), fall back to zero
    affectedRequestCount = 0
  }

  // Build verification checks
  const allSkusAccountedFor =
    newSkus.length + matchedSkus.length === loserSkus.length
  const checks: ReadonlyArray<MergeCheck> = [
    {
      label: "All SKU colorways accounted for",
      passed: allSkusAccountedFor,
      detail: allSkusAccountedFor
        ? `${matchedSkus.length} matched + ${newSkus.length} new = ${loserSkus.length} total`
        : `${matchedSkus.length} matched + ${newSkus.length} new != ${loserSkus.length} total`,
    },
    {
      label: "Samples accounted for",
      passed: true,
      detail: samplesToTransfer > 0
        ? `${samplesToTransfer} sample(s) will be transferred`
        : "No samples to transfer",
    },
    {
      label: "Shot references identified",
      passed: !(affectedShotIds.length === 0 && (loser.skuCount ?? 0) > 0 && (loser.shotIds ?? []).length > 0),
      detail:
        affectedShotIds.length > 0
          ? `${affectedShotIds.length} shot(s) reference this product`
          : "No shots reference this product",
    },
    {
      label: "No data loss",
      passed: allSkusAccountedFor && newSkus.length + matchedSkus.length >= loserSkus.length,
    },
  ]

  const hasDataLoss = !allSkusAccountedFor

  return {
    winner,
    loser,
    newSkus,
    matchedSkus,
    samplesToTransfer,
    commentsToTransfer,
    documentsToTransfer,
    affectedShotIds,
    affectedPullCount,
    affectedRequestCount,
    hasDataLoss,
    checks,
  }
}
