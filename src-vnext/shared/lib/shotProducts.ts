import type { ProductAssignment, Shot } from "@/shared/types"

function normalizeSizeScope(p: ProductAssignment): NonNullable<ProductAssignment["sizeScope"]> {
  if (p.sizeScope === "all" || p.sizeScope === "single" || p.sizeScope === "pending") return p.sizeScope
  return "pending"
}

function buildDedupKey(p: ProductAssignment): string {
  const familyId = p.familyId ?? ""
  const colourId = p.colourId ?? ""
  const scope = normalizeSizeScope(p)
  const size = scope === "single" ? (p.size ?? "") : scope
  return `${familyId}::${colourId}::${scope}::${size}`
}

/**
 * Merge shot products across legacy-supported fields without extra reads:
 * - `shot.products[]`
 * - `shot.looks[].products[]`
 *
 * Dedup is intentionally conservative to avoid double-counting when the same
 * assignment appears both at shot-level and within looks.
 */
export function extractShotAssignedProducts(shot: Shot): ProductAssignment[] {
  const merged: ProductAssignment[] = []
  const seen = new Set<string>()

  const add = (p: ProductAssignment) => {
    if (!p || !p.familyId) return
    const key = buildDedupKey(p)
    if (seen.has(key)) return
    seen.add(key)
    merged.push(p)
  }

  for (const p of shot.products) add(p)

  for (const look of shot.looks ?? []) {
    for (const p of look.products) add(p)
  }

  return merged
}

