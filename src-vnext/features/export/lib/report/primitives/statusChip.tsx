import { View, Text } from "@react-pdf/renderer"
import { COLOR, FONT, STATUS } from "../reportPdfShared"
import type { ReportShotStatus } from "../reportTypes"
import { STATUS_DOT_OKLCH, STATUS_DOT_CLASS } from "./primitiveTokens"

// Canonical StatusChip primitive — a status dot + a caller-supplied label.
// ONE spec both adapters present, so the DOM preview and the @react-pdf export
// can't drift on the reserved palette. The dot colour is resolved from the
// single-sourced reserved set (green/amber/blue/gray) in `primitiveTokens` /
// `reportPdfShared` — NEVER red; `on_hold` is AMBER (#D97706) by locked decision
// (2026-06-29). The label is caller-supplied verbatim (legacy labels for the
// image-led layout, canonical labels for recipes) — it is passed through, NOT
// derived. Per-host metrics (font size, letter-spacing, label ink) are kept as
// spec fields, resolved from a `variant` preset, so each host stays
// byte-identical rather than forcing one shared size.

export interface StatusChipSpec {
  readonly kind: "statusChip"
  readonly status: ReportShotStatus
  readonly label: string // caller-supplied (legacy for image-led, canonical for recipes)
  // dot color resolved from the reserved set (never red; on_hold AMBER)
  readonly dotOklch: string // DOM  (STATUS_DOT_OKLCH[status])
  readonly dotHex: string // PDF  (STATUS[status].color)
  readonly dotDomClass: string // STATUS_DOT_CLASS[status]
  // per-host metrics (kept overridable so each host stays byte-identical)
  readonly labelFontDomPx: number // default 10 (image-led/balanced); 9 for production inline
  readonly labelFontPt: number // default 7 (image-led); 6 for recipes
  readonly labelLetterSpacingDomEm: number // 0.06 default (image-led) / 0.08 recipes
  readonly labelLetterSpacingPt: number // 0.5
  readonly labelColorVar: string // DOM: 'var(--sb-ink-2)' default / 'var(--sb-ink-3)' production inline
  readonly labelColorHex: string // PDF: COLOR.textSecondary default / COLOR.textSubtle production inline
  readonly dotDomPx: number // 7 (DOM established size)
  readonly dotPt: number // 5
}

export type StatusChipVariant = "imageLed" | "balanced" | "productionInline"

export interface StatusChipInput {
  readonly status: ReportShotStatus
  readonly label: string
  readonly variant?: StatusChipVariant // selects the per-host metric preset
}

/** Discriminated-union of resolved primitive specs handled here. Single-variant
 * today; the defaultless `switch(spec.kind)` in each adapter stays exhaustive via
 * the explicit ReactElement return type (add a `never` default when it grows). */
type ResolvedStatusChipSpec = StatusChipSpec

// Constant dot geometry — the DOM-established 7px dot / 5pt PDF dot.
const DOT_DOM_PX = 7
const DOT_PT = 5

// Per-host metric presets. Each host stays byte-identical to its shipped output
// by resolving its own font/letter-spacing/ink from here instead of a single
// forced size. `labelLetterSpacingPt` is 0.5 across the board.
interface StatusChipPreset {
  readonly labelFontDomPx: number
  readonly labelFontPt: number
  readonly labelLetterSpacingDomEm: number
  readonly labelLetterSpacingPt: number
  readonly labelColorVar: string
  readonly labelColorHex: string
}

const STATUS_PRESETS: Record<StatusChipVariant, StatusChipPreset> = {
  imageLed: {
    labelFontDomPx: 10,
    labelFontPt: 7,
    labelLetterSpacingDomEm: 0.06,
    labelLetterSpacingPt: 0.5,
    labelColorVar: "var(--sb-ink-2)",
    labelColorHex: COLOR.textSecondary,
  },
  balanced: {
    labelFontDomPx: 10,
    labelFontPt: 6,
    labelLetterSpacingDomEm: 0.08,
    labelLetterSpacingPt: 0.5,
    labelColorVar: "var(--sb-ink-2)",
    labelColorHex: COLOR.textSecondary,
  },
  productionInline: {
    labelFontDomPx: 9,
    labelFontPt: 6,
    labelLetterSpacingDomEm: 0.08,
    labelLetterSpacingPt: 0.5,
    labelColorVar: "var(--sb-ink-3)",
    labelColorHex: COLOR.textSubtle,
  },
}

/** Resolve a status + caller label (+ variant preset) to its renderer-agnostic
 * StatusChip spec. PURE. Dot colours come from the single-sourced reserved set
 * (never red; on_hold AMBER); the label passes through verbatim. */
export function deriveStatusChipSpec(input: StatusChipInput): StatusChipSpec {
  const preset = STATUS_PRESETS[input.variant ?? "imageLed"]
  return {
    kind: "statusChip",
    status: input.status,
    label: input.label,
    dotOklch: STATUS_DOT_OKLCH[input.status],
    dotHex: STATUS[input.status].color,
    dotDomClass: STATUS_DOT_CLASS[input.status],
    labelFontDomPx: preset.labelFontDomPx,
    labelFontPt: preset.labelFontPt,
    labelLetterSpacingDomEm: preset.labelLetterSpacingDomEm,
    labelLetterSpacingPt: preset.labelLetterSpacingPt,
    labelColorVar: preset.labelColorVar,
    labelColorHex: preset.labelColorHex,
    dotDomPx: DOT_DOM_PX,
    dotPt: DOT_PT,
  }
}

// DOM adapter for StatusChipSpec. Exhaustive via the explicit return type
// (unhandled variant -> tsc error = red build); promote to a `never` default once
// the union is multi-variant. Metrics are rendered inline from the spec (not a
// Tailwind class) so the DOM and PDF consume one source and can't drift. The dot
// colour is applied inline as OKLCH (so the parity test can read it in jsdom,
// which does NOT resolve the class colour) AND the shipped `.sb-status--*` class
// is applied for real-page fidelity. Label ink is the canonical CSS var.

/** Render a resolved StatusChip spec to DOM primitives. */
export function StatusChipDom(spec: ResolvedStatusChipSpec): React.ReactElement {
  switch (spec.kind) {
    case "statusChip":
      return (
        <span
          data-testid="status-chip"
          className={`sb-status-chip `}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontFamily: "var(--sb-font-ui)",
            fontSize: `${String(spec.labelFontDomPx)}px`,
            fontWeight: 600,
            letterSpacing: `${String(spec.labelLetterSpacingDomEm)}em`,
            textTransform: "uppercase",
            color: spec.labelColorVar,
          }}
        >
          <span
            data-testid="status-dot"
            className={spec.dotDomClass}
            style={{
              width: "7px",
              height: "7px",
              borderRadius: "50%",
              display: "inline-block",
              background: spec.dotOklch,
            }}
          />
          <span data-testid="status-label">{spec.label}</span>
        </span>
      )
  }
}

// @react-pdf adapter for StatusChipSpec — the only adapter importing @react-pdf,
// so it stays in the lazy pdf chunk. Exhaustive via the explicit return type
// (unhandled variant -> tsc error = red build); promote to a `never` default once
// the union is multi-variant. The dot colour is the verbatim reserved-palette
// hex (`STATUS[status].color`); the label ink is the canonical PDF colour. The
// margins around the whole chip (marginRight/marginLeft per host) are LAYOUT and
// stay with the host wrapper — NOT baked in here.

/** Render a resolved StatusChip spec to @react-pdf primitives. */
export function StatusChipPdf(spec: ResolvedStatusChipSpec): React.ReactElement {
  switch (spec.kind) {
    case "statusChip":
      return (
        <View data-testid="status-chip" style={{ flexDirection: "row", alignItems: "center" }}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 2.5,
              backgroundColor: spec.dotHex,
              marginRight: 5,
            }}
          />
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
        </View>
      )
  }
}
