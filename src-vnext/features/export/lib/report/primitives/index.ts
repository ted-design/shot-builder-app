// Barrel for the canonical report primitives (Phase 2).
//
// Re-exports every primitive's spec + pure derive*Spec() + both render fns
// (render*Dom / render*Pdf) from its co-located `<name>.tsx`, plus the shared
// qtyGlyph + token maps, plus the six DOM wrapper components from the sibling
// `components/report/primitives/` tree.
//
// NOTE (expected): this file will NOT typecheck until the six builders land
// their per-primitive files (heroMark / statusChip / holdFlag / unresolvedBadge
// / lookLabel / productRow) and the matching DOM wrappers. That is by design —
// the scaffold pre-declares the barrel so builders drop in against a stable
// surface; the Verify phase runs after all six land.
//
// The barrel is the ONLY thing pulling the DOM wrappers into `lib/`. The DOM
// wrappers do NOT import @react-pdf; each primitive file's render*Pdf is a
// distinct named export, so a DOM consumer that only touches the *View exports
// tree-shakes the PDF render out. If review flags the co-mingling, split into
// index.dom.ts / index.pdf.ts; default to this single barrel.

export * from "./qtyGlyph"
export * from "./primitiveTokens"

// Per-primitive spec + deriver + render fns (built by later agents).
export * from "./heroMark"
export * from "./statusChip"
export * from "./holdFlag"
export * from "./unresolvedBadge"
export * from "./lookLabel"
export * from "./productRow"

// DOM wrapper components (built by later agents).
export { HeroMarkView } from "../../../components/report/primitives/HeroMark"
export { StatusChipView } from "../../../components/report/primitives/StatusChip"
export { HoldFlagView } from "../../../components/report/primitives/HoldFlag"
export { UnresolvedBadgeView } from "../../../components/report/primitives/UnresolvedBadge"
export { LookLabelView } from "../../../components/report/primitives/LookLabel"
export {
  ProductRowView,
  ProductColHeadView,
} from "../../../components/report/primitives/ProductRow"
