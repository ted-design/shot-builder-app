import {
  deriveHoldFlagSpec,
  type HoldFlagInput,
  type HoldFlagSpec,
} from "../../../lib/report/primitives/holdFlag"

// DOM adapter for the canonical HoldFlag primitive (Phase 2). Presents the SAME
// HoldFlagSpec the @react-pdf adapter (renderHoldFlagPdf) does, so screen and PDF
// can't drift. This file does NOT import @react-pdf, so it stays out of the lazy
// pdf chunk.
//
// HoldFlag is the ONLY primitive allowed to emit var(--sb-red) — the one
// sanctioned red (locked decision #2). It renders NOTHING (no rail, no text, no
// reserved space) when !hold. The vertical writing-mode is applied only for
// orientation='vertical' (the production-sheet spine); horizontal omits it.

/** Render a resolved HoldFlag spec to DOM primitives. */
export function renderHoldFlagDom(spec: HoldFlagSpec): React.ReactElement {
  if (spec.kind !== "holdFlag") {
    const _exhaustive: never = spec.kind
    return _exhaustive
  }
  if (!spec.hold) {
    return <span data-testid="hold-flag" data-hold="false" />
  }
  return (
    <span data-testid="hold-flag" data-hold="true">
      <span
        data-testid="hold-rail"
        style={{
          display: "inline-block",
          width: `${String(spec.railWidthDomPx)}px`,
          alignSelf: "stretch",
          background: spec.redVar,
        }}
      />
      <span
        data-testid="hold-label"
        style={{
          fontFamily: "var(--sb-font-ui)",
          fontWeight: 700,
          fontSize: `${String(spec.labelFontDomPx)}px`,
          letterSpacing: `${String(spec.labelLetterSpacingDomEm)}em`,
          textTransform: "uppercase",
          color: spec.redVar,
          ...(spec.orientation === "vertical"
            ? { writingMode: "vertical-rl", transform: "rotate(180deg)" }
            : {}),
        }}
      >
        {spec.labelText}
      </span>
    </span>
  )
}

/** Thin DOM wrapper: derives the spec from an input and renders it. */
export function HoldFlagView(props: HoldFlagInput): React.ReactElement {
  return renderHoldFlagDom(deriveHoldFlagSpec(props))
}
