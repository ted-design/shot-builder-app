import type { PageSettings } from "../types/exportBuilder"

/**
 * Canonical page dimensions in PDF points (1/72 inch).
 *
 * Single source of truth shared by the @react-pdf renderer (re-exported as
 * `PAGE_SIZES` from `pdf/pdfStyles`) and the on-screen `DocumentPreview`, so the
 * preview's aspect ratio can never drift from the exported PDF.
 */
export const PAGE_DIMENSIONS_PT = {
  letter: { width: 612, height: 792 },
  a4: { width: 595.28, height: 841.89 },
  legal: { width: 612, height: 1008 },
} as const

export type PageSizeKey = keyof typeof PAGE_DIMENSIONS_PT

/**
 * Page dimensions in points for a given size + orientation. Width/height are
 * swapped for landscape. This is the one place the orientation swap lives, so
 * the preview and the PDF can't disagree about what "landscape" means.
 */
export function getPageDimensionsPt(
  size: PageSettings["size"] | undefined,
  layout: PageSettings["layout"] | undefined,
): { readonly width: number; readonly height: number } {
  const dims =
    PAGE_DIMENSIONS_PT[(size ?? "letter") as PageSizeKey] ?? PAGE_DIMENSIONS_PT.letter
  return layout === "landscape"
    ? { width: dims.height, height: dims.width }
    : { width: dims.width, height: dims.height }
}

/**
 * On-screen preview frame width. The preview is fit-to-width: a fixed canvas
 * width with the page's true aspect ratio driving the min-height. 960px keeps
 * portrait Letter at ~960×1242 (the historical frame's min-height was 1243px;
 * the aspect-exact value is 1242) so the default document is visually
 * unchanged, while landscape / A4 / Legal reshape with no horizontal overflow
 * of the center column.
 */
export const PREVIEW_PAGE_WIDTH_PX = 960

/**
 * Preview frame dimensions (CSS px) for a given size + orientation. Returns a
 * fixed `width` and an aspect-correct `minHeight` (content may grow taller).
 */
export function getPreviewPageDimensions(
  size: PageSettings["size"] | undefined,
  layout: PageSettings["layout"] | undefined,
): { readonly width: number; readonly minHeight: number } {
  const { width, height } = getPageDimensionsPt(size, layout)
  return {
    width: PREVIEW_PAGE_WIDTH_PX,
    minHeight: Math.round(PREVIEW_PAGE_WIDTH_PX * (height / width)),
  }
}
