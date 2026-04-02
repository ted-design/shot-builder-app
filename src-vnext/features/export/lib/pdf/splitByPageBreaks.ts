import type { ExportBlock, ExportPage } from "../../types/exportBuilder"

/**
 * Flatten all pages into a single block list, then split on page-break blocks.
 * Each resulting group becomes a separate <Page> in the PDF.
 */
export function splitByPageBreaks(
  pages: readonly ExportPage[],
): readonly (readonly ExportBlock[])[] {
  const allBlocks = pages.flatMap((p) => p.blocks)
  const result: ExportBlock[][] = []
  let current: ExportBlock[] = []

  for (const block of allBlocks) {
    if (block.type === "page-break") {
      result.push(current)
      current = []
    } else {
      current.push(block)
    }
  }

  // Push final group
  if (current.length > 0) {
    result.push(current)
  }

  // Ensure at least one page
  return result.length > 0 ? result : [[]]
}
