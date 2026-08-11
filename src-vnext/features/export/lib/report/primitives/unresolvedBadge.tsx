import { Text } from "@react-pdf/renderer"
import { COLOR, FONT } from "../reportPdfShared"

// Canonical UnresolvedBadge primitive (Phase 2). ONE spec, ONE pure deriver,
// TWO adapters (DOM in ../../../components/report/primitives/UnresolvedBadge.tsx,
// PDF below) that present the SAME spec so the renderers can't drift.
//
// Locked design: the badge is INK, not red — a DEMOTION from today's red-ink
// (DOM `--sb-red-ink` / PDF `accentInk #B3261E`). Border color follows the ink
// text (DOM `currentColor`; PDF `borderColor === color`). This is the only
// canonical change vs the shipped `.sb-badge-unresolved`; geometry is preserved.
//
// px→pt: report PDFs are hand-tuned in raw points (~0.5× DOM px), NOT px*0.75,
// so the spec carries explicit `*DomPx`/`*Pt` pairs. The DOM adapter emits the
// px strings; the PDF adapter emits the raw pt numbers. Colors are never
// unit-converted. Margins are LAYOUT (host-owned) and stay out of the spec.

export interface UnresolvedBadgeSpec {
  readonly kind: "unresolvedBadge"
  readonly label: string // caller: "Unresolved" | "Mixed" | "Gender ?"
  readonly inkHex: string // "#18181B" (=== COLOR.text) — demoted from accentInk
  readonly inkVar: string // "var(--sb-ink)" — demoted from --sb-red-ink
  readonly fontDomPx: number // 9 (--sb-t-3xs)
  readonly fontPt: number // 5.5
  readonly letterSpacingDomEm: number // 0.06
  readonly letterSpacingPt: number // 0.4
  readonly paddingDomPx: string // "1px 4px"
  readonly paddingHorizontalPt: number // 3
  readonly borderRadiusDomPx: number // 2
  readonly borderRadiusPt: number // 1
  readonly borderWidthPt: number // 0.5
}

export interface UnresolvedBadgeInput {
  readonly label: string
}

// Canonical ink (the DEMOTION target — was red-ink `--sb-red-ink`/`accentInk`).
const INK_HEX = "#18181B" // === COLOR.text
const INK_VAR = "var(--sb-ink)" // DOM

// Geometry — DOM px / PDF pt pairs (hand-tuned pt, not px*0.75).
const FONT_DOM_PX = 9
const FONT_PT = 5.5
const LETTER_SPACING_DOM_EM = 0.06
const LETTER_SPACING_PT = 0.4
const PADDING_DOM_PX = "1px 4px"
const PADDING_HORIZONTAL_PT = 3
const BORDER_RADIUS_DOM_PX = 2
const BORDER_RADIUS_PT = 1
const BORDER_WIDTH_PT = 0.5

/** Resolve an UnresolvedBadge input to its renderer-agnostic spec. PURE. */
export function deriveUnresolvedBadgeSpec(
  input: UnresolvedBadgeInput,
): UnresolvedBadgeSpec {
  return {
    kind: "unresolvedBadge",
    label: input.label,
    inkHex: INK_HEX,
    inkVar: INK_VAR,
    fontDomPx: FONT_DOM_PX,
    fontPt: FONT_PT,
    letterSpacingDomEm: LETTER_SPACING_DOM_EM,
    letterSpacingPt: LETTER_SPACING_PT,
    paddingDomPx: PADDING_DOM_PX,
    paddingHorizontalPt: PADDING_HORIZONTAL_PT,
    borderRadiusDomPx: BORDER_RADIUS_DOM_PX,
    borderRadiusPt: BORDER_RADIUS_PT,
    borderWidthPt: BORDER_WIDTH_PT,
  }
}

// @react-pdf presenter for UnresolvedBadgeSpec — the only adapter importing
// @react-pdf, so it stays in the lazy pdf chunk. Exhaustive via the explicit
// return type + defaultless switch (unhandled variant -> tsc error = red build).

/** Render a resolved UnresolvedBadge spec to @react-pdf primitives. */
export function renderUnresolvedBadgePdf(
  spec: UnresolvedBadgeSpec,
): React.ReactElement {
  switch (spec.kind) {
    case "unresolvedBadge":
      return (
        <Text
          data-testid="unresolved-badge"
          style={{
            fontFamily: FONT.uiBold,
            fontSize: spec.fontPt,
            letterSpacing: spec.letterSpacingPt,
            textTransform: "uppercase",
            color: COLOR.text,
            borderWidth: spec.borderWidthPt,
            borderColor: COLOR.text,
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
export function UnresolvedBadgePdf(
  input: UnresolvedBadgeInput,
): React.ReactElement {
  return renderUnresolvedBadgePdf(deriveUnresolvedBadgeSpec(input))
}
