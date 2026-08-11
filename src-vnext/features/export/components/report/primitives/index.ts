// Barrel for the canonical report primitives' DOM adapter components (Phase 2).
//
// Thin wrappers that call derive*Spec + render*Dom from the co-located
// `lib/report/primitives/<name>.tsx`. None of these import @react-pdf, so this
// barrel stays DOM-only and out of the lazy PDF chunk.
//
// NOTE (expected): this file will NOT typecheck until the six builders land
// their DOM wrapper components (built by later agents). That is by design.

export { HeroMarkView } from "./HeroMark"
export { StatusChipView } from "./StatusChip"
export { HoldFlagView } from "./HoldFlag"
export { UnresolvedBadgeView } from "./UnresolvedBadge"
export { LookLabelView } from "./LookLabel"
export { ProductRowView, ProductColHeadView } from "./ProductRow"
