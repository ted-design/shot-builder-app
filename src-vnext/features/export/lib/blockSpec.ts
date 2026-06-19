import type { DividerBlock } from "../types/exportBuilder"

// Renderer-agnostic block specs. A pure `derive*Spec` resolver turns a block +
// data into a serializable, presentation-free spec (px-canonical sizes, author
// colors, no CSS classes / no pt). The DOM and @react-pdf adapters are thin
// presenters over the SAME spec, so the two renderers cannot drift — the parity
// tests assert on the spec. One variant is added per migrated block type.

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
