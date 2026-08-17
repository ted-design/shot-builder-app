import { Text } from "@react-pdf/renderer"
import { COLOR, FONT } from "../reportPdfShared"

// Canonical TagChip primitive (2026-08-17) — the small neutral chip each shot
// row prints for its tags. ONE spec, ONE pure deriver, TWO adapters (DOM in
// ../../../components/report/primitives/TagChip.tsx, PDF below) presenting the
// SAME spec, so the on-screen report and the @react-pdf export can't drift.
//
// NEUTRAL BY DESIGN — deliberately NOT the app's Tailwind `TagBadge`
// (shared/components/TagBadge.tsx). `ShotTag.color` is a Tailwind class KEY
// ("red" | "amber" | "emerald" | ...) with no hex table behind it, and the
// report deliberately keeps a RESERVED palette in which red has exactly one
// job per recipe (the image-led shot number / the production-sheet hold flag /
// the balanced-rows hero mark). Painting a per-tag colour here would put a
// second red on the page and invent hexes the design system never defined. So
// the chip borrows the shipped gender-chip / unresolved-badge treatment
// instead: a thin rule-strong border, an ink-2 uppercase label. Same shape on
// both renderers; the tag's own colour key is not consumed at all.
//
// px -> pt: the report PDFs are hand-tuned in raw points (~0.5x DOM px), NOT
// px*0.75, so the spec carries explicit `*DomPx`/`*Pt` pairs — DOM emits the px
// strings, PDF emits the raw pt numbers. Colors are never unit-converted.
// Margins / gaps between chips are LAYOUT (owned by each host's tag row), not
// baked in here.

export interface TagChipSpec {
  readonly kind: "tagChip"
  /** Caller-supplied tag label, passed through verbatim (never re-derived). */
  readonly label: string
  readonly inkHex: string // "#52525B" (=== COLOR.textSecondary)
  readonly inkVar: string // "var(--sb-ink-2)"
  readonly borderHex: string // "#D4D4D8" (=== COLOR.ruleStrong)
  readonly borderVar: string // "var(--sb-rule-strong)"
  readonly fontDomPx: number // 9 (--sb-t-3xs)
  readonly fontPt: number // 5.5 (matches reportPdfBalancedRows genderChip)
  readonly letterSpacingDomEm: number // 0.08
  readonly letterSpacingPt: number // 0.4
  readonly paddingDomPx: string // "1px 6px"
  readonly paddingHorizontalPt: number // 3
  readonly borderRadiusDomPx: number // 2
  readonly borderRadiusPt: number // 1
  readonly borderWidthDomPx: number // 1
  readonly borderWidthPt: number // 0.5
}

export interface TagChipInput {
  readonly label: string
}

/** Discriminated-union of resolved primitive specs handled here. Single-variant
 *  today; the defaultless `switch(spec.kind)` in each adapter stays exhaustive
 *  via the explicit ReactElement return type (add a `never` default when it
 *  grows). */
type ResolvedTagChipSpec = TagChipSpec

// Canonical ink + border. Resolved from the shared PDF palette rather than
// re-hardcoded, so the reserved set stays single-sourced (reportPdfShared.ts).
// The DOM side names the equivalent CSS custom properties, which reportStyles.ts
// defines as the OKLCH originals these hexes approximate.
const INK_HEX = COLOR.textSecondary // "#52525B"
const INK_VAR = "var(--sb-ink-2)"
const BORDER_HEX = COLOR.ruleStrong // "#D4D4D8"
const BORDER_VAR = "var(--sb-rule-strong)"

// Geometry — DOM px / PDF pt pairs (hand-tuned pt, not px*0.75). These are the
// SHIPPED gender-chip metrics: DOM `.sb-br-gender-chip` (reportStyles.ts) and
// PDF `genderChip` (reportPdfBalancedRows.tsx), so a tag chip and a gender chip
// sitting on the same row read as one family.
const FONT_DOM_PX = 9
const FONT_PT = 5.5
const LETTER_SPACING_DOM_EM = 0.08
const LETTER_SPACING_PT = 0.4
const PADDING_DOM_PX = "1px 6px"
const PADDING_HORIZONTAL_PT = 3
const BORDER_RADIUS_DOM_PX = 2
const BORDER_RADIUS_PT = 1
const BORDER_WIDTH_DOM_PX = 1
const BORDER_WIDTH_PT = 0.5

/** Resolve a TagChip input to its renderer-agnostic spec. PURE. */
export function deriveTagChipSpec(input: TagChipInput): TagChipSpec {
  return {
    kind: "tagChip",
    label: input.label,
    inkHex: INK_HEX,
    inkVar: INK_VAR,
    borderHex: BORDER_HEX,
    borderVar: BORDER_VAR,
    fontDomPx: FONT_DOM_PX,
    fontPt: FONT_PT,
    letterSpacingDomEm: LETTER_SPACING_DOM_EM,
    letterSpacingPt: LETTER_SPACING_PT,
    paddingDomPx: PADDING_DOM_PX,
    paddingHorizontalPt: PADDING_HORIZONTAL_PT,
    borderRadiusDomPx: BORDER_RADIUS_DOM_PX,
    borderRadiusPt: BORDER_RADIUS_PT,
    borderWidthDomPx: BORDER_WIDTH_DOM_PX,
    borderWidthPt: BORDER_WIDTH_PT,
  }
}

// @react-pdf presenter for TagChipSpec — the only adapter importing @react-pdf,
// so it stays in the lazy pdf chunk. Exhaustive via the explicit return type +
// defaultless switch (unhandled variant -> tsc error = red build).

/** Render a resolved TagChip spec to @react-pdf primitives. */
export function renderTagChipPdf(spec: ResolvedTagChipSpec): React.ReactElement {
  switch (spec.kind) {
    case "tagChip":
      return (
        <Text
          data-testid="tag-chip"
          style={{
            fontFamily: FONT.uiBold,
            fontSize: spec.fontPt,
            letterSpacing: spec.letterSpacingPt,
            textTransform: "uppercase",
            color: spec.inkHex,
            borderWidth: spec.borderWidthPt,
            borderColor: spec.borderHex,
            borderRadius: spec.borderRadiusPt,
            paddingHorizontal: spec.paddingHorizontalPt,
          }}
        >
          {spec.label}
        </Text>
      )
  }
}

/** Thin PDF wrapper: derive the spec, then present it via the @react-pdf adapter. */
export function TagChipPdf(input: TagChipInput): React.ReactElement {
  return renderTagChipPdf(deriveTagChipSpec(input))
}
