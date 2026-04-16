const MIN_ROWS_KEEP_TOGETHER = 4

/**
 * Compute the index at which the "keep-together" group starts.
 * Returns -1 if no grouping is needed (too few rows).
 *
 * When a table has more than MIN_ROWS_KEEP_TOGETHER rows, the last
 * MIN_ROWS_KEEP_TOGETHER rows should be wrapped in a single
 * non-breaking View so they always land on the same page. This
 * prevents the Saturation-style orphan problem where a total row
 * ends up alone on the last page.
 */
export function computeOrphanGroupIndex(totalRows: number): number {
  if (totalRows <= MIN_ROWS_KEEP_TOGETHER) return -1
  return totalRows - MIN_ROWS_KEEP_TOGETHER
}
