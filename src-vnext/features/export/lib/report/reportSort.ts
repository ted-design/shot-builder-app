// Shared sort engine + comparator primitives for the report models (R2/R5).
// A LEAF module: it imports from NO model or type file, so reportModel /
// productInfoModel / talentModel import FROM it with zero risk of a cycle. It
// owns the cross-type sort direction vocabulary and the ONE stable-sort engine,
// so the DOM views and every @react-pdf renderer inherit an identical, tie-broken
// order by consuming the already-sorted model (they never re-sort).

/** Sort direction, shared by all three report types. */
export type SortDir = "asc" | "desc"

// Direction display labels — the single source for the shared Order-by/Direction
// control. An exhaustive typed literal (TS flags a missing variant); the option
// list derives from it so the strings aren't duplicated (mirrors REPORT_LAYOUT_*).
export const SORT_DIR_LABEL: Record<SortDir, string> = {
  asc: "Ascending",
  desc: "Descending",
}
export const SORT_DIR_OPTIONS: ReadonlyArray<{ readonly value: SortDir; readonly label: string }> =
  (Object.keys(SORT_DIR_LABEL) as SortDir[]).map((value) => ({
    value,
    label: SORT_DIR_LABEL[value],
  }))

/** Sort key for shot numbers: numerics first (ascending), then non-numerics alpha.
 *  Relocated verbatim from reportModel (a pure leaf util) and re-exported there. */
export function shotNumberSortKey(n: string): [number, number, string] {
  const num = Number.parseInt(n, 10)
  return Number.isNaN(num) ? [1, 0, n] : [0, num, n]
}

/** Numeric-aware shot-number compare ("2" before "10"), non-numerics alpha last. */
export function compareShotNumber(a: string, b: string): number {
  const [ak, an, as] = shotNumberSortKey(a)
  const [bk, bn, bs] = shotNumberSortKey(b)
  return ak - bk || an - bn || as.localeCompare(bs)
}

/** Null-safe text compare (nullish sorts as ""). */
export function compareText(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? "").localeCompare(b ?? "")
}

/** Ordinal compare against a fixed order: knowns by index, then unknowns after knowns, ties alpha. */
export function compareByOrder(order: readonly string[], a: string, b: string): number {
  const ai = order.indexOf(a)
  const bi = order.indexOf(b)
  if (ai !== -1 && bi !== -1) return ai - bi
  if (ai !== -1) return -1
  if (bi !== -1) return 1
  return compareText(a, b)
}

/**
 * THE ENGINE. Stable, deterministic sort. `dir` flips the PRIMARY key ONLY —
 * the tie-break is ALWAYS ascending, so duplicate-primary-key cases are ordered
 * identically on every engine and every Firestore read order (the @react-pdf
 * worker path included). Array.sort is stable in every supported engine, but the
 * explicit tie-break means correctness never relies on that.
 */
export function sortItemsStable<T>(
  items: readonly T[],
  primary: (a: T, b: T) => number,
  tieBreak: (a: T, b: T) => number,
  dir: SortDir,
): T[] {
  const factor = dir === "desc" ? -1 : 1
  return [...items].sort((a, b) => {
    const p = factor * primary(a, b)
    return p !== 0 ? p : tieBreak(a, b)
  })
}

/**
 * Partition `items` into buckets keyed by `keyOf`, preserving input (already-sorted)
 * order within each bucket, then order the buckets by `keyOrder`. Empty buckets never
 * appear (only keys present in `items` get a bucket) — matching the gender-group
 * "drop empties" rule. Used for the shot report's new status grouping.
 */
export function orderedBuckets<T>(
  items: readonly T[],
  keyOf: (t: T) => string,
  keyOrder: (a: string, b: string) => number,
  label: (k: string) => string,
): ReadonlyArray<{ readonly key: string; readonly label: string; readonly count: number; readonly items: readonly T[] }> {
  const byKey = new Map<string, T[]>()
  for (const item of items) {
    const k = keyOf(item)
    const bucket = byKey.get(k)
    if (bucket) bucket.push(item)
    else byKey.set(k, [item])
  }
  return [...byKey.keys()].sort(keyOrder).map((k) => {
    const inGroup = byKey.get(k) ?? []
    return { key: k, label: label(k), count: inGroup.length, items: inGroup }
  })
}
