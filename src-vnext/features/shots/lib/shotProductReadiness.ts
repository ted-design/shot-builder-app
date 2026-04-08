import type { Shot, ProductFamily, ProductSku, ProductSample, ShotLook } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"
import { countActiveRequirements, getActiveRequirementKeys } from "@/features/products/lib/assetRequirements"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeroAssignment {
  readonly familyId: string
  readonly skuId: string | null
}

export interface ShotReadiness {
  /** Earliest launch date across hero products (SKU-level when available). */
  readonly earliestLaunchDate: Timestamp | null
  /** Active requirement count (per-SKU when available, family fallback). */
  readonly totalRequirements: number
  /** Total sample count (per-SKU when scoped, family fallback). */
  readonly totalSamples: number
  /** Arrived sample count (per-SKU when scoped, family fallback). */
  readonly arrivedSamples: number
  /** Names of the hero families (for tooltip). */
  readonly heroFamilyNames: ReadonlyArray<string>
  /** Whether data is SKU-level or family-level (for display labeling). */
  readonly isSkuLevel: boolean
  /** Active requirement type keys (e.g., ["ecomm_on_figure", "lifestyle"]). */
  readonly activeRequirementTypes: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------
// Hero product resolution
// ---------------------------------------------------------------------------

function extractHeroAssignmentFromLook(look: ShotLook): HeroAssignment | null {
  const products = look.products
  if (!Array.isArray(products) || products.length === 0) return null

  // 1. Explicit hero: heroProductId set and matches a product
  if (typeof look.heroProductId === "string" && look.heroProductId.length > 0) {
    const match = products.find(
      (p) => p.familyId === look.heroProductId || (p as unknown as Record<string, unknown>)["productId"] === look.heroProductId,
    )
    if (match) return { familyId: match.familyId, skuId: match.skuId ?? null }
  }

  // 2/3. Implicit hero: first product
  const first = products[0]
  if (!first) return null
  return { familyId: first.familyId, skuId: first.skuId ?? null }
}

/**
 * Resolve hero product assignments (familyId + skuId) for a shot.
 * Returns unique assignments across all looks. Falls back to shot.products[].
 */
export function resolveHeroAssignments(shot: Shot): ReadonlyArray<HeroAssignment> {
  const seen = new Set<string>()
  const result: HeroAssignment[] = []

  const addUnique = (a: HeroAssignment) => {
    const key = `${a.familyId}::${a.skuId ?? ""}`
    if (seen.has(key)) return
    seen.add(key)
    result.push(a)
  }

  // Primary: resolve from looks
  const looks = shot.looks
  if (Array.isArray(looks) && looks.length > 0) {
    const sorted = [...looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    for (const look of sorted) {
      const assignment = extractHeroAssignmentFromLook(look)
      if (assignment) addUnique(assignment)
    }
  }

  // Fallback: top-level products
  if (result.length === 0 && Array.isArray(shot.products) && shot.products.length > 0) {
    const first = shot.products[0]
    if (first?.familyId) addUnique({ familyId: first.familyId, skuId: first.skuId ?? null })
  }

  return result
}

/**
 * Resolve hero family IDs (convenience wrapper for sort functions).
 */
export function resolveHeroFamilyIds(shot: Shot): ReadonlyArray<string> {
  const assignments = resolveHeroAssignments(shot)
  const ids = new Set<string>()
  for (const a of assignments) ids.add(a.familyId)
  return [...ids]
}

// ---------------------------------------------------------------------------
// Readiness computation
// ---------------------------------------------------------------------------

function earlierTimestamp(a: Timestamp | null, b: Timestamp | null): Timestamp | null {
  if (!a) return b
  if (!b) return a
  try {
    return a.toDate().getTime() <= b.toDate().getTime() ? a : b
  } catch {
    return a
  }
}

function computeSkuSampleStatus(
  familyId: string,
  skuId: string | null,
  samplesByFamily: ReadonlyMap<string, ReadonlyArray<ProductSample>>,
): { total: number; arrived: number; isSkuScoped: boolean } {
  const familySamples = samplesByFamily.get(familyId)
  if (!familySamples || familySamples.length === 0) return { total: 0, arrived: 0, isSkuScoped: false }

  // Try SKU-scoped samples first
  if (skuId) {
    const skuScoped = familySamples.filter((s) => s.scopeSkuId === skuId)
    if (skuScoped.length > 0) {
      return {
        total: skuScoped.length,
        arrived: skuScoped.filter((s) => s.status === "arrived").length,
        isSkuScoped: true,
      }
    }
  }

  // Fallback: all family samples (not SKU-scoped)
  return {
    total: familySamples.length,
    arrived: familySamples.filter((s) => s.status === "arrived").length,
    isSkuScoped: false,
  }
}

/**
 * Compute readiness metrics for a shot.
 *
 * When `skuById` is provided, uses per-colorway data (requirements, launch dates).
 * When `samplesByFamily` is provided, attempts per-SKU sample matching via scopeSkuId.
 * Falls back to family-level aggregates when specific data isn't available.
 */
export function computeShotReadiness(
  shot: Shot,
  familyById: ReadonlyMap<string, ProductFamily>,
  skuById?: ReadonlyMap<string, ProductSku>,
  samplesByFamily?: ReadonlyMap<string, ReadonlyArray<ProductSample>>,
): ShotReadiness {
  const heroAssignments = resolveHeroAssignments(shot)
  const heroFamilyNames: string[] = []

  let earliestLaunchDate: Timestamp | null = null
  let totalRequirements = 0
  let totalSamples = 0
  let arrivedSamples = 0
  let usedSkuLevel = false
  const activeRequirementTypesSet = new Set<string>()

  for (const { familyId, skuId } of heroAssignments) {
    const family = familyById.get(familyId)
    if (!family || family.deleted === true) continue

    heroFamilyNames.push(family.styleName)

    // --- Launch date: SKU-level when available ---
    const sku = skuId && skuById ? skuById.get(skuId) : null
    if (sku) {
      usedSkuLevel = true
      const skuLaunch = sku.launchDate ?? family?.earliestLaunchDate ?? null
      earliestLaunchDate = earlierTimestamp(earliestLaunchDate, skuLaunch)

      // --- Requirements: per-colorway ---
      totalRequirements += countActiveRequirements(sku.assetRequirements)
      for (const key of getActiveRequirementKeys(sku.assetRequirements)) {
        activeRequirementTypesSet.add(key)
      }
    } else {
      // Family-level fallback — no type breakdown available
      earliestLaunchDate = earlierTimestamp(earliestLaunchDate, family.earliestLaunchDate ?? null)
      totalRequirements += family.activeRequirementCount ?? 0
    }

    // --- Samples: SKU-scoped when possible ---
    if (samplesByFamily) {
      const sampleStatus = computeSkuSampleStatus(familyId, skuId, samplesByFamily)
      totalSamples += sampleStatus.total
      arrivedSamples += sampleStatus.arrived
    } else {
      totalSamples += family.sampleCount ?? 0
      arrivedSamples += family.samplesArrivedCount ?? 0
    }
  }

  return {
    earliestLaunchDate,
    totalRequirements,
    totalSamples,
    arrivedSamples,
    heroFamilyNames,
    isSkuLevel: usedSkuLevel,
    activeRequirementTypes: [...activeRequirementTypesSet],
  }
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

/** Extract the earliest hero launch date as epoch ms for sorting. */
export function shotLaunchDateMs(
  shot: Shot,
  familyById: ReadonlyMap<string, ProductFamily>,
  skuById?: ReadonlyMap<string, ProductSku>,
): number {
  const readiness = computeShotReadiness(shot, familyById, skuById)
  if (!readiness.earliestLaunchDate) return Number.MAX_SAFE_INTEGER
  try {
    return readiness.earliestLaunchDate.toDate().getTime()
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

/** Extract total hero requirements for sorting (descending). */
export function shotRequirementsCount(
  shot: Shot,
  familyById: ReadonlyMap<string, ProductFamily>,
  skuById?: ReadonlyMap<string, ProductSku>,
): number {
  return computeShotReadiness(shot, familyById, skuById).totalRequirements
}

// ---------------------------------------------------------------------------
// Display helpers (shared by ShotCard + shotColumnRenderers)
// ---------------------------------------------------------------------------

/** Format a Firestore Timestamp as "Apr 15" style short date. */
export function formatLaunchDateShort(ts: Timestamp): string {
  try {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(ts.toDate())
  } catch {
    return "\u2014"
  }
}

/** Return a CSS class for launch urgency coloring: red (overdue), amber (<=14d), green (>14d). */
export function launchUrgencyClass(ts: Timestamp): string {
  try {
    const daysUntil = Math.ceil((ts.toDate().getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) return "text-[var(--color-status-red-text)]"
    if (daysUntil <= 14) return "text-[var(--color-status-amber-text)]"
    return "text-[var(--color-status-green-text)]"
  } catch {
    return "text-[var(--color-text-muted)]"
  }
}
