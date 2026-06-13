// Warehouse pull-list aggregation (Phase 5f-III).
//
// PURE + deterministic. The warehouse pull surface must pull EVERY product
// requirement across ALL looks of ALL shots (not just the primary look — the
// shoot needs everything in the closet, not just the cover). We aggregate by a
// stable composite key (familyId|familyName + colourName + size) so the same
// garment/colour/size requested by multiple shots collapses into ONE row, with
// the requesting shots listed under `neededByShots`.
//
// ⚠️ There is NO per-product prep/pull-status field in the shot/product model
// (the only fulfillment state lives in the SEPARATE pulls feature, a different
// entity). So a PullListRow carries NO fabricated prep status — it carries what
// the warehouse needs to FIND the item (label, colourway, size, style/SKU) and
// the shots that need it.
import type { ProductAssignment, ProductFamily, Shot } from "@/shared/types"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import { formatProductAssignmentLabel } from "./shotListSummaries"

/** A shot that requires a given pull-list product. */
export interface PullListShotRef {
  readonly shotId: string
  /** Shot number when present (e.g. "12"); falls back to the shot title. */
  readonly shotLabel: string
}

/** One aggregated product requirement for the warehouse to pull. */
export interface PullListRow {
  /** Stable composite key: `${familyId|familyName}|${colourName}|${size}`. */
  readonly key: string
  /** Display label, reusing formatProductAssignmentLabel (no quantity dupes). */
  readonly label: string
  /** Resolved style number / SKU, or null when unresolvable. */
  readonly styleNumber: string | null
  /** Colourway name for a swatch, or null when none assigned. */
  readonly colourName: string | null
  /** Every shot that requires this product, de-duplicated, sorted. */
  readonly neededByShots: ReadonlyArray<PullListShotRef>
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function shotLabelFor(shot: Shot): string {
  return (
    asNonEmptyString(shot.shotNumber) ??
    asNonEmptyString(shot.title) ??
    shot.id
  )
}

// Identity of a requirement = family + colourway + size. Quantity is NOT part
// of the key (it's a per-line count, not an identity); colourName/size carry
// the variant. familyName backstops a missing familyId so two unlinked
// assignments of the same garment still collapse.
function compositeKey(p: ProductAssignment): string {
  const family =
    asNonEmptyString(p.familyId) ?? asNonEmptyString(p.familyName) ?? "product"
  const colour = asNonEmptyString(p.colourName) ?? ""
  const size = asNonEmptyString(p.size) ?? p.sizeScope ?? ""
  return `${family}|${colour}|${size}`
}

function resolveStyleNumber(
  p: ProductAssignment,
  familyById?: ReadonlyMap<string, ProductFamily>,
): string | null {
  const family = p.familyId && familyById ? familyById.get(p.familyId) : undefined
  return family?.styleNumber ?? family?.styleNumbers?.[0] ?? asNonEmptyString(p.skuName)
}

interface MutableRow {
  readonly key: string
  readonly label: string
  readonly styleNumber: string | null
  readonly colourName: string | null
  readonly shotRefs: Map<string, PullListShotRef>
}

function collectAssignment(
  rows: Map<string, MutableRow>,
  p: ProductAssignment,
  shotRef: PullListShotRef,
  familyById?: ReadonlyMap<string, ProductFamily>,
): void {
  const key = compositeKey(p)
  const existing = rows.get(key)
  if (existing) {
    if (!existing.shotRefs.has(shotRef.shotId)) {
      existing.shotRefs.set(shotRef.shotId, shotRef)
    }
    return
  }
  const shotRefs = new Map<string, PullListShotRef>()
  shotRefs.set(shotRef.shotId, shotRef)
  rows.set(key, {
    key,
    label: formatProductAssignmentLabel(p),
    styleNumber: resolveStyleNumber(p, familyById),
    colourName: asNonEmptyString(p.colourName),
    shotRefs,
  })
}

function sortShotRefs(
  refs: Iterable<PullListShotRef>,
): ReadonlyArray<PullListShotRef> {
  return [...refs].sort((a, b) =>
    a.shotLabel.localeCompare(b.shotLabel, undefined, { numeric: true }),
  )
}

/**
 * Aggregate every product requirement across ALL looks of ALL given shots into
 * a deterministic, de-duplicated pull list. Deleted shots are skipped. Rows are
 * stably sorted by label (then key) so renders and snapshots are reproducible.
 */
export function buildWarehousePullList(
  shots: ReadonlyArray<Shot>,
  familyById?: ReadonlyMap<string, ProductFamily>,
): PullListRow[] {
  const rows = new Map<string, MutableRow>()

  for (const shot of shots) {
    if (shot.deleted === true) continue
    const shotRef: PullListShotRef = {
      shotId: shot.id,
      shotLabel: shotLabelFor(shot),
    }
    // Aggregate across ALL looks. For legacy/imported shots that carry no look
    // rows but still hold top-level `shot.products` assignments (the app maps
    // and renders these via extractShotAssignedProducts), fall back to the
    // shared extractor so the pull list never silently omits required items.
    // Dedup-by-compositeKey makes the fallback safe even if a shot had both.
    const lookProducts: ProductAssignment[] = []
    for (const look of shot.looks ?? []) {
      for (const product of look.products ?? []) lookProducts.push(product)
    }
    const assignments =
      lookProducts.length > 0 ? lookProducts : extractShotAssignedProducts(shot)
    for (const product of assignments) {
      collectAssignment(rows, product, shotRef, familyById)
    }
  }

  return [...rows.values()]
    .map((row) => ({
      key: row.key,
      label: row.label,
      styleNumber: row.styleNumber,
      colourName: row.colourName,
      neededByShots: sortShotRefs(row.shotRefs.values()),
    }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.key.localeCompare(b.key))
}
