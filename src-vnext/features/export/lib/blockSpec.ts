import type { DividerBlock } from "../types/exportBuilder"

// Pure, px-canonical, presentation-free block specs. The DOM + @react-pdf
// adapters both present the SAME spec, so the two renderers can't drift.

export type DividerLineStyle = NonNullable<DividerBlock["style"]>

export interface DividerSpec {
  readonly kind: "divider"
  readonly lineStyle: DividerLineStyle
  readonly color: string
  readonly thicknessPx: number
  readonly marginYPx: number
}

/** Discriminated union of resolved block specs — grows one variant per block type. */
export type ResolvedBlockSpec = DividerSpec

// Canonical divider defaults — the single source both renderers resolve from.
// (Replaces the View `#d1d5db`/1px vs PDF `#D1D5DB`/0.5pt fork.)
const DIVIDER_DEFAULT_COLOR = "#D1D5DB"
const DIVIDER_THICKNESS_PX = 1
const DIVIDER_MARGIN_Y_PX = 8

/** Resolve a DividerBlock to its renderer-agnostic spec. */
export function deriveDividerSpec(block: DividerBlock): DividerSpec {
  return {
    kind: "divider",
    lineStyle: block.style ?? "solid",
    color: block.color ?? DIVIDER_DEFAULT_COLOR,
    thicknessPx: DIVIDER_THICKNESS_PX,
    marginYPx: DIVIDER_MARGIN_Y_PX,
  }
}
