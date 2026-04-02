import type { ExportBlock, ExportPage, PageItem } from "../../types/exportBuilder"
import { isHStackRow } from "../../types/exportBuilder"

/**
 * Split pages into visual page groups.
 * Each ExportPage is a distinct visual page; within each page, page-break
 * blocks create additional visual pages. Result: a flat list of item groups.
 * HStack rows are preserved as PageItems so they render as side-by-side columns.
 */
export function splitByPageBreaks(
  pages: readonly ExportPage[],
): readonly (readonly PageItem[])[] {
  const result: PageItem[][] = pages.flatMap((page) =>
    splitPageItemsByBreaks(page.items ?? []),
  )

  // Ensure at least one page
  return result.length > 0 ? result : [[]]
}

/** Split a single page's items on page-break blocks */
function splitPageItemsByBreaks(
  items: readonly PageItem[],
): readonly PageItem[][] {
  const groups: PageItem[][] = []
  let current: PageItem[] = []

  for (const item of items) {
    if (!isHStackRow(item) && item.type === "page-break") {
      groups.push(current)
      current = []
    } else {
      current.push(item)
    }
  }

  // Always push the final group (even if empty — the page itself is a boundary)
  groups.push(current)
  return groups
}

/**
 * Legacy helper: flatten all pages into a flat block list (for image resolution).
 * HStack rows are flattened: their column blocks are inlined sequentially.
 */
export function flattenPagesToBlocks(
  pages: readonly ExportPage[],
): readonly ExportBlock[] {
  return pages.flatMap((p) =>
    (p.items ?? []).flatMap((item) =>
      isHStackRow(item) ? item.columns.flatMap((c) => c.blocks) : [item],
    ),
  )
}
