import type { Shot, ProductFamily, ProductSku } from "@/shared/types"
import type { FilterCondition, FilterValue, DateRangeValue } from "./filterConditions"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import { computeShotReadiness, type ShotReadiness } from "./shotProductReadiness"

// ---------------------------------------------------------------------------
// Eval context — lookup maps passed by the caller
// ---------------------------------------------------------------------------

export interface EvalContext {
  readonly familyById: ReadonlyMap<string, ProductFamily>
  readonly skuById?: ReadonlyMap<string, ProductSku>
  /** Per-shot readiness cache — avoids recomputation when multiple conditions need readiness. */
  readonly readinessCache?: Map<string, ShotReadiness>
}

// ---------------------------------------------------------------------------
// Set helpers
// ---------------------------------------------------------------------------

function asStringArray(value: FilterValue): readonly string[] {
  if (Array.isArray(value)) return value as readonly string[]
  return []
}

/**
 * Evaluate a set condition against a single string value.
 * "in" → value is in the set; "notIn" → value is NOT in the set.
 */
function evalSet(actual: string | undefined | null, operator: string, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true
  const match = actual != null && allowed.includes(actual)
  return operator === "in" ? match : !match
}

/**
 * Evaluate a set condition against an array of IDs (e.g. tags, talent).
 * "in" → at least one ID appears in the set; "notIn" → none do.
 */
function evalSetArray(actualIds: readonly string[], operator: string, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true
  const allowedSet = new Set(allowed)
  const match = actualIds.some((id) => allowedSet.has(id))
  return operator === "in" ? match : !match
}

// ---------------------------------------------------------------------------
// Missing evaluation
// ---------------------------------------------------------------------------

type MissingCheck = "products" | "talent" | "location" | "image"

function isMissing(shot: Shot, key: MissingCheck): boolean {
  switch (key) {
    case "products":
      return extractShotAssignedProducts(shot).length === 0
    case "talent":
      return !(shot.talentIds ?? shot.talent).some(
        (t) => typeof t === "string" && t.trim().length > 0,
      )
    case "location":
      return !shot.locationId
    case "image":
      return !shot.heroImage?.downloadURL && !shot.heroImage?.path
    default:
      return false
  }
}

function evalMissing(shot: Shot, operator: string, value: FilterValue): boolean {
  const keys = asStringArray(value)
  if (keys.length === 0) return true
  // "in" means "show shots that ARE missing these fields" — all specified keys must be missing
  if (operator === "in") {
    return keys.every((k) => isMissing(shot, k as MissingCheck))
  }
  return true
}

// ---------------------------------------------------------------------------
// Date evaluation
// ---------------------------------------------------------------------------

function parseDate(dateStr: string): number | null {
  if (!dateStr) return null
  const ms = Date.parse(dateStr)
  return Number.isNaN(ms) ? null : ms
}

function evalDate(actualMs: number | null, operator: string, value: FilterValue): boolean {
  if (operator === "empty") return actualMs === null

  if (actualMs === null) return false

  if (operator === "before") {
    const threshold = parseDate(value as string)
    return threshold !== null && actualMs < threshold
  }

  if (operator === "after") {
    const threshold = parseDate(value as string)
    return threshold !== null && actualMs >= threshold
  }

  if (operator === "between") {
    const range = value as DateRangeValue
    const fromMs = parseDate(range.from)
    const toMs = parseDate(range.to)
    if (fromMs === null || toMs === null) return false
    return actualMs >= fromMs && actualMs <= toMs
  }

  return true
}

// ---------------------------------------------------------------------------
// Product family IDs extraction
// ---------------------------------------------------------------------------

function extractFamilyIds(shot: Shot): readonly string[] {
  const assigned = extractShotAssignedProducts(shot)
  const ids = new Set<string>()
  for (const p of assigned) {
    if (p.familyId) ids.add(p.familyId)
  }
  return [...ids]
}

function getReadiness(shot: Shot, ctx: EvalContext): ShotReadiness {
  if (ctx.readinessCache) {
    const cached = ctx.readinessCache.get(shot.id)
    if (cached) return cached
    const result = computeShotReadiness(shot, ctx.familyById, ctx.skuById)
    ctx.readinessCache.set(shot.id, result)
    return result
  }
  return computeShotReadiness(shot, ctx.familyById, ctx.skuById)
}

// ---------------------------------------------------------------------------
// Core evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate a single filter condition against one shot.
 */
export function evaluateCondition(
  shot: Shot,
  condition: FilterCondition,
  ctx: EvalContext,
): boolean {
  const { field, operator, value } = condition

  switch (field) {
    case "status":
      return evalSet(shot.status, operator, asStringArray(value))

    case "tag": {
      const tagIds = (shot.tags ?? []).map((t) => t.id)
      return evalSetArray(tagIds, operator, asStringArray(value))
    }

    case "talent": {
      const talentIds = (shot.talentIds ?? shot.talent).filter(
        (t): t is string => typeof t === "string" && t.trim().length > 0,
      )
      return evalSetArray(talentIds, operator, asStringArray(value))
    }

    case "location":
      return evalSet(shot.locationId, operator, asStringArray(value))

    case "product": {
      const familyIds = extractFamilyIds(shot)
      return evalSetArray(familyIds, operator, asStringArray(value))
    }

    case "missing":
      return evalMissing(shot, operator, value)

    case "launchDate": {
      const readiness = getReadiness(shot, ctx)
      let ms: number | null = null
      if (readiness.earliestLaunchDate) {
        try {
          ms = readiness.earliestLaunchDate.toDate().getTime()
        } catch {
          ms = null
        }
      }
      return evalDate(ms, operator, value)
    }

    case "hasRequirements": {
      const readiness = getReadiness(shot, ctx)
      const has = readiness.totalRequirements > 0
      const expected = value === true
      return has === expected
    }

    case "hasHeroImage": {
      const hasImage = !!(shot.heroImage?.downloadURL || shot.heroImage?.path)
      const expected = value === true
      return hasImage === expected
    }

    default:
      return true
  }
}

// ---------------------------------------------------------------------------
// Batch filter
// ---------------------------------------------------------------------------

/**
 * Apply all filter conditions to an array of shots.
 * A shot passes if it satisfies ALL conditions (logical AND).
 */
export function applyFilterConditions(
  shots: ReadonlyArray<Shot>,
  conditions: readonly FilterCondition[],
  ctx: EvalContext,
): ReadonlyArray<Shot> {
  if (conditions.length === 0) return shots

  // Create a per-call readiness cache when any condition needs it
  const needsReadiness = conditions.some(
    (c) => c.field === "launchDate" || c.field === "hasRequirements",
  )
  const evalCtx: EvalContext = needsReadiness
    ? { ...ctx, readinessCache: new Map() }
    : ctx

  return shots.filter((shot) =>
    conditions.every((c) => evaluateCondition(shot, c, evalCtx)),
  )
}
