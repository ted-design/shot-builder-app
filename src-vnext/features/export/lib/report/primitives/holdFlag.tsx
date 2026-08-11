import { View, Text } from "@react-pdf/renderer"
import type { ReportShotStatus } from "../reportTypes"
import { COLOR, FONT } from "../reportPdfShared"
import { HOLD_RED_HEX, HOLD_RED_VAR } from "./primitiveTokens"

// Canonical HoldFlag primitive (Phase 2). ONE spec + a pure deriveHoldFlagSpec()
// + the @react-pdf adapter; the DOM adapter (renderHoldFlagDom / HoldFlagView)
// lives in the sibling components/report/primitives/HoldFlag.tsx and presents the
// SAME spec, so screen and PDF can't drift.
//
// HoldFlag is the ONLY primitive allowed to emit #EB1400 / var(--sb-red) — the
// one sanctioned red (locked decision #2). It renders NOTHING when !hold.

/** Rail orientation. `vertical` = the production-sheet spine (default). */
export type HoldFlagOrientation = "vertical" | "horizontal"

export interface HoldFlagSpec {
  readonly kind: "holdFlag"
  readonly hold: boolean
  readonly labelText: string // "HOLD" (uppercase canonical)
  readonly railWidthDomPx: number // 4 (shipped DOM rail)
  readonly railWidthPt: number // 3 (shipped PDF rail)
  readonly redHex: string // "#EB1400"  (=== COLOR.accent) — the ONE sanctioned red
  readonly redVar: string // "var(--sb-red)"
  readonly labelFontDomPx: number // 9  (--sb-t-3xs)
  readonly labelFontPt: number // 5
  readonly labelLetterSpacingDomEm: number // 0.14
  readonly labelLetterSpacingPt: number // 0.5
  readonly orientation: HoldFlagOrientation // vertical = production-sheet spine (default)
}

export interface HoldFlagInput {
  readonly status: ReportShotStatus
  readonly orientation?: HoldFlagOrientation
}

// Canonical geometry — the single source both adapters resolve from. The red is
// single-sourced from primitiveTokens (HoldFlag is the only red-bearing spec).
const HOLD_LABEL = "HOLD"
const HOLD_RAIL_DOM_PX = 4
const HOLD_RAIL_PT = 3
const HOLD_LABEL_FONT_DOM_PX = 9
const HOLD_LABEL_FONT_PT = 5
const HOLD_LABEL_LS_DOM_EM = 0.14
const HOLD_LABEL_LS_PT = 0.5

/**
 * Resolve a shot status to its renderer-agnostic HoldFlag spec.
 * `hold` mirrors the shipped `isFlagged` (status === "on_hold"). Returns a
 * fully-populated spec even when !hold (adapters gate on `spec.hold`), so the
 * Layer-1 snapshot is stable. Pure — no mutation.
 */
export function deriveHoldFlagSpec(input: HoldFlagInput): HoldFlagSpec {
  return {
    kind: "holdFlag",
    hold: input.status === "on_hold",
    labelText: HOLD_LABEL,
    railWidthDomPx: HOLD_RAIL_DOM_PX,
    railWidthPt: HOLD_RAIL_PT,
    redHex: HOLD_RED_HEX,
    redVar: HOLD_RED_VAR,
    labelFontDomPx: HOLD_LABEL_FONT_DOM_PX,
    labelFontPt: HOLD_LABEL_FONT_PT,
    labelLetterSpacingDomEm: HOLD_LABEL_LS_DOM_EM,
    labelLetterSpacingPt: HOLD_LABEL_LS_PT,
    orientation: input.orientation ?? "vertical",
  }
}

// @react-pdf presenter for the HoldFlag spec — the only adapter importing
// @react-pdf, so it stays in the lazy pdf chunk. Exhaustive via the explicit
// return type + a `never` guard on the discriminant (an unhandled variant ->
// tsc error = red build). @react-pdf has no writing-mode, so the PDF label is
// always horizontal 'HOLD' (matches the shipped `holdTxt`); vertical orientation
// is a host layout concern in adoption.

/** Render a resolved HoldFlag spec to @react-pdf primitives. */
export function renderHoldFlagPdf(spec: HoldFlagSpec): React.ReactElement {
  if (spec.kind !== "holdFlag") {
    const _exhaustive: never = spec.kind
    return _exhaustive
  }
  if (!spec.hold) return <View />
  return (
    <View
      data-testid="hold-flag"
      style={{
        borderLeftWidth: spec.railWidthPt,
        borderLeftColor: COLOR.accent,
      }}
    >
      <Text
        style={{
          fontFamily: FONT.uiBold,
          fontSize: spec.labelFontPt,
          letterSpacing: spec.labelLetterSpacingPt,
          textTransform: "uppercase",
          color: COLOR.accent,
        }}
      >
        {spec.labelText}
      </Text>
    </View>
  )
}
