import type { ProductAssignment, ShotLook } from "@/shared/types"

// Resolves a look's hero products. Source of truth is ProductAssignment.isHero;
// when no product is starred it falls back to the legacy single heroProductId so
// pre-CO-2 shots keep their cover non-destructively. Shared by the looks editor
// (star UI + cover sync) and the Capture One share resolver (CO-3).
//
// heroProductId is the legacy cover pointer, kept synced to the first star. It can
// still be explicitly null (NONE) via "hide header" — that suppresses the cover
// image but does NOT clear the heroes (filename source); a later star toggle resyncs it.

/** The id heroProductId points at for a product — mirrors the legacy cover dropdown + coverProductImage matching. */
export function assignmentHeroId(p: ProductAssignment): string {
  return p.skuId ?? p.colourId ?? p.familyId
}

/** True when `p` is the product the legacy heroProductId referenced (sku/colour/family). */
export function matchesHeroProductId(p: ProductAssignment, heroId: string): boolean {
  return p.skuId === heroId || p.colourId === heroId || p.familyId === heroId
}

/** Indices of a look's hero products: starred ones, else the legacy heroProductId match, else none. */
export function lookHeroIndexes(look: ShotLook): number[] {
  const products = look.products ?? []
  const starred = products.flatMap((p, i) => (p.isHero === true ? [i] : []))
  if (starred.length > 0) return starred

  const heroId = look.heroProductId
  if (typeof heroId === "string" && heroId.length > 0) {
    const i = products.findIndex((p) => matchesHeroProductId(p, heroId))
    if (i >= 0) return [i]
  }
  return []
}

/** A look's hero product assignments (isHero-first, legacy fallback). */
export function lookHeroAssignments(look: ShotLook): ProductAssignment[] {
  const products = look.products ?? []
  return lookHeroIndexes(look).map((i) => products[i]!).filter(Boolean)
}

/**
 * The heroProductId to persist for a products array = the first starred product's id.
 * Returns undefined when none are starred so the cover stays in AUTO mode (first-product
 * fallback) rather than NONE (which suppresses the cover entirely).
 */
export function firstHeroProductId(
  products: ReadonlyArray<ProductAssignment>,
): string | undefined {
  const first = products.find((p) => p.isHero === true)
  return first ? assignmentHeroId(first) : undefined
}

/**
 * The heroProductId to persist after a products edit (add / colorway edit / remove).
 * Stars win; otherwise keep a still-resolvable legacy pointer (non-destructive),
 * but drop a dangling one to undefined (AUTO) so a removed cover product never
 * leaves the look stuck in EXPLICIT mode pointing at nothing.
 */
export function reconcileHeroProductId(
  products: ReadonlyArray<ProductAssignment>,
  prevHeroProductId: string | null | undefined,
): string | null | undefined {
  // An explicit NONE (null) — set by "hide header" — stays hidden across product
  // edits; only an explicit star toggle (handleToggleHero, which calls
  // firstHeroProductId directly) re-enables the cover.
  if (prevHeroProductId === null) return null
  const starred = firstHeroProductId(products)
  if (starred !== undefined) return starred
  if (typeof prevHeroProductId === "string" && prevHeroProductId.length > 0) {
    return products.some((p) => matchesHeroProductId(p, prevHeroProductId))
      ? prevHeroProductId
      : undefined
  }
  return prevHeroProductId
}
