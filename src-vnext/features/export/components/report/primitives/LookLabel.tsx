import {
  deriveLookLabelSpec,
  type LookLabelInput,
  type LookLabelSpec,
} from "../../../lib/report/primitives/lookLabel"

// DOM adapter for the canonical LookLabel primitive. Presents the SAME spec the
// @react-pdf adapter (lib/report/primitives/lookLabel.tsx) consumes. Every
// metric is rendered inline from the spec so the two renderers can't drift; the
// label is emitted VERBATIM with `textTransform: 'uppercase'` (never
// `.toUpperCase()` in JS), and the count keeps `textTransform: 'none'` so it
// stays "1 piece", not "1 PIECE".
//
// This file does NOT import @react-pdf, so it stays out of the lazy PDF chunk.

// Exhaustiveness tripwire — a future missing variant fails typecheck here.
function assertNeverVariant(v: never): never {
  throw new Error(`Unhandled LookLabel variant: ${String(v)}`)
}

/** Render a resolved LookLabelSpec to DOM primitives. */
export function LookLabelDom(spec: LookLabelSpec): React.ReactElement {
  const labelStyle: React.CSSProperties = {
    fontFamily: "var(--sb-font-ui)",
    fontSize: `${String(spec.labelFontDomPx)}px`,
    fontWeight: 700,
    letterSpacing: `${String(spec.labelLetterSpacingDomEm)}em`,
    textTransform: "uppercase",
    color: spec.labelColorVar,
  }
  switch (spec.variant) {
    case "rule":
      return (
        <div
          data-testid="look-label"
          data-variant="rule"
          style={{ display: "flex", alignItems: "center" }}
        >
          <span data-testid="look-label-text" style={labelStyle}>
            {spec.label}
          </span>
          <span
            data-testid="look-rule"
            style={{
              flex: 1,
              borderTop: "1px solid var(--sb-rule)",
              marginLeft: "8px",
            }}
          />
        </div>
      )
    case "chip":
      return (
        <div
          data-testid="look-label"
          data-variant="chip"
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <span data-testid="look-label-text" style={labelStyle}>
            {spec.label}
          </span>
          <span
            data-testid="look-count"
            style={{
              fontSize: `${String(spec.countFontDomPx)}px`,
              fontWeight: 600,
              letterSpacing: "0.06em",
              color: spec.countColorVar,
              border: "1px solid var(--sb-rule)",
              borderRadius: "2px",
              padding: "0 5px",
              textTransform: "none",
              marginLeft: "6px",
            }}
          >
            {spec.countText}
          </span>
        </div>
      )
    default:
      return assertNeverVariant(spec.variant)
  }
}

interface LookLabelViewProps {
  readonly input: LookLabelInput
}

/** Props wrapper: resolve the spec once, render the DOM adapter. */
export function LookLabelView({ input }: LookLabelViewProps) {
  return LookLabelDom(deriveLookLabelSpec(input))
}
