import { View, Text } from "@react-pdf/renderer"
import { COLOR, FONT } from "../reportPdfShared"

// Canonical LookLabel primitive (Phase 2). One spec + pure deriveLookLabelSpec()
// + two adapters (DOM in ../../../components/report/primitives/LookLabel.tsx,
// @react-pdf below) presenting the SAME spec, so the image-led "rule" line and
// the ps/br "chip" tag can't drift.
//
// PARITY NOTE: the label is carried VERBATIM (never `.toUpperCase()` in JS) —
// casing is a presentation concern done in CSS/PDF `textTransform`. This kills
// the production-sheet fork (`look.label.toUpperCase()`) vs balanced-rows
// (`look.label`) that ships today. Alt tint is canonicalized to one step lighter
// (`--sb-ink-2` / COLOR.textSecondary), matching image-led + production-sheet and
// harmonizing balanced-rows' start.

export interface LookLabelSpec {
  readonly kind: "lookLabel"
  readonly label: string // verbatim from ReportLook.label (NOT .toUpperCase'd in JS)
  readonly isAlt: boolean
  readonly variant: "rule" | "chip" // rule = image-led (flex rule line, no count); chip = ps/br (bordered count tag)
  readonly countText: string | null // null when no count; else "1 piece" | "N pieces"
  // label metrics
  readonly labelFontDomPx: number
  readonly labelFontPt: number
  readonly labelLetterSpacingDomEm: number
  readonly labelLetterSpacingPt: number
  readonly labelColorVar: string // primary 'var(--sb-ink)' ; alt 'var(--sb-ink-2)'
  readonly labelColorHex: string // primary COLOR.text ; alt COLOR.textSecondary
  // count chip metrics (chip variant only)
  readonly countFontDomPx: number
  readonly countFontPt: number
  readonly countColorVar: string // 'var(--sb-ink-3)'
  readonly countColorHex: string // COLOR.textSubtle
}

export interface LookLabelInput {
  readonly label: string
  readonly isAlt: boolean
  readonly pieceCount?: number // undefined -> rule variant; defined -> chip variant
  readonly variantOverride?: "rule" | "chip"
}

// Per-variant presets. The single source both adapters resolve label/count
// metrics from — no metric is hardcoded in an adapter.
interface VariantPreset {
  readonly labelFontDomPx: number
  readonly labelFontPt: number
  readonly labelLetterSpacingDomEm: number
  readonly labelLetterSpacingPt: number
}

const RULE_PRESET: VariantPreset = {
  labelFontDomPx: 10,
  labelFontPt: 7,
  labelLetterSpacingDomEm: 0.12,
  labelLetterSpacingPt: 1,
}

const CHIP_PRESET: VariantPreset = {
  labelFontDomPx: 10,
  labelFontPt: 6.5,
  labelLetterSpacingDomEm: 0.12,
  labelLetterSpacingPt: 0.8,
}

// Count chip metrics — chip variant only.
const COUNT_FONT_DOM_PX = 9
const COUNT_FONT_PT = 5.5

// Canonical color tokens (single-sourced; alt = one step lighter).
const LABEL_COLOR_VAR_PRIMARY = "var(--sb-ink)"
const LABEL_COLOR_VAR_ALT = "var(--sb-ink-2)"
const COUNT_COLOR_VAR = "var(--sb-ink-3)"

/** Resolve a look label to its renderer-agnostic spec. PURE — no mutation. */
export function deriveLookLabelSpec(input: LookLabelInput): LookLabelSpec {
  const variant: LookLabelSpec["variant"] =
    input.variantOverride ?? (input.pieceCount === undefined ? "rule" : "chip")
  const countText: string | null =
    input.pieceCount === undefined
      ? null
      : input.pieceCount === 1
        ? "1 piece"
        : `${String(input.pieceCount)} pieces`
  const preset = variant === "rule" ? RULE_PRESET : CHIP_PRESET
  return {
    kind: "lookLabel",
    label: input.label,
    isAlt: input.isAlt,
    variant,
    countText,
    labelFontDomPx: preset.labelFontDomPx,
    labelFontPt: preset.labelFontPt,
    labelLetterSpacingDomEm: preset.labelLetterSpacingDomEm,
    labelLetterSpacingPt: preset.labelLetterSpacingPt,
    labelColorVar: input.isAlt ? LABEL_COLOR_VAR_ALT : LABEL_COLOR_VAR_PRIMARY,
    labelColorHex: input.isAlt ? COLOR.textSecondary : COLOR.text,
    countFontDomPx: COUNT_FONT_DOM_PX,
    countFontPt: COUNT_FONT_PT,
    countColorVar: COUNT_COLOR_VAR,
    countColorHex: COLOR.textSubtle,
  }
}

// Exhaustiveness tripwire — a future missing variant fails typecheck here.
function assertNeverVariant(v: never): never {
  throw new Error(`Unhandled LookLabel variant: ${String(v)}`)
}

/** @react-pdf presenter for a LookLabelSpec — the only adapter importing
 *  @react-pdf, so it stays in the lazy pdf chunk. Every metric flows from the
 *  spec; casing is applied via `textTransform`, never `.toUpperCase()`. */
export function LookLabelPdf(spec: LookLabelSpec): React.ReactElement {
  switch (spec.variant) {
    case "rule":
      return (
        <View
          data-testid="look-label"
          data-variant="rule"
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Text
            style={{
              fontFamily: FONT.uiBold,
              fontSize: spec.labelFontPt,
              letterSpacing: spec.labelLetterSpacingPt,
              textTransform: "uppercase",
              color: spec.labelColorHex,
            }}
          >
            {spec.label}
          </Text>
          <View
            style={{
              flex: 1,
              height: 0.5,
              backgroundColor: COLOR.rule,
              marginLeft: 8,
            }}
          />
        </View>
      )
    case "chip":
      return (
        <View
          data-testid="look-label"
          data-variant="chip"
          style={{ flexDirection: "row", alignItems: "center" }}
        >
          <Text
            style={{
              fontFamily: FONT.uiBold,
              fontSize: spec.labelFontPt,
              letterSpacing: spec.labelLetterSpacingPt,
              textTransform: "uppercase",
              color: spec.labelColorHex,
            }}
          >
            {spec.label}
          </Text>
          <Text
            style={{
              fontFamily: FONT.ui,
              fontSize: spec.countFontPt,
              color: spec.countColorHex,
              borderWidth: 0.5,
              borderColor: COLOR.rule,
              borderRadius: 1,
              paddingHorizontal: 3,
              marginLeft: 6,
            }}
          >
            {spec.countText}
          </Text>
        </View>
      )
    default:
      return assertNeverVariant(spec.variant)
  }
}
