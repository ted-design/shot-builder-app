import {
  deriveTagChipSpec,
  type TagChipInput,
  type TagChipSpec,
} from "../../../lib/report/primitives/tagChip"

// DOM adapter for TagChipSpec. Every metric is rendered INLINE from the spec
// (so the DOM and the @react-pdf adapter provably consume one source and the
// parity test can read the values in jsdom, which resolves no stylesheet), PLUS
// the shipped `sb-tag-chip` class for real-page fidelity — belt-and-suspenders,
// the same pattern StatusChipDom uses for the status dot.
//
// The chip is NEUTRAL (thin rule-strong border, ink-2 uppercase label) — see
// the primitive's docstring for why the app's per-tag-coloured Tailwind
// TagBadge is deliberately not reused here. Margins/gaps between chips are
// LAYOUT (host-owned by each recipe's tag row), not rendered here.
//
// Exhaustive via the explicit return type + defaultless switch (unhandled
// variant -> tsc error = red build); promote to a `never` default once the
// union is multi-variant.

/** Render a resolved TagChip spec to DOM primitives. */
export function renderTagChipDom(spec: TagChipSpec): React.ReactElement {
  switch (spec.kind) {
    case "tagChip":
      return (
        <span
          data-testid="tag-chip"
          className="sb-tag-chip"
          style={{
            fontFamily: "var(--sb-font-ui)",
            fontSize: `${String(spec.fontDomPx)}px`,
            fontWeight: 600,
            letterSpacing: `${String(spec.letterSpacingDomEm)}em`,
            textTransform: "uppercase",
            color: spec.inkVar,
            // LONGHANDS, not the `border` shorthand: jsdom's CSS parser drops a
            // shorthand whose colour is a `var(...)` (it can't resolve the
            // custom property), so `style.borderWidth`/`style.borderColor` come
            // back EMPTY and the parity test can't read what this renders.
            // Longhands round-trip verbatim.
            borderWidth: `${String(spec.borderWidthDomPx)}px`,
            borderStyle: "solid",
            borderColor: spec.borderVar,
            borderRadius: `${String(spec.borderRadiusDomPx)}px`,
            padding: spec.paddingDomPx,
            lineHeight: 1.2,
            display: "inline-block",
            whiteSpace: "nowrap",
          }}
        >
          {spec.label}
        </span>
      )
  }
}

/** Thin DOM wrapper: derive the spec, then present it via the DOM adapter. */
export function TagChipView(input: TagChipInput): React.ReactElement {
  return renderTagChipDom(deriveTagChipSpec(input))
}
