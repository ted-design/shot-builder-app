import {
  deriveUnresolvedBadgeSpec,
  type UnresolvedBadgeInput,
  type UnresolvedBadgeSpec,
} from "../../../lib/report/primitives/unresolvedBadge"

// DOM adapter for UnresolvedBadgeSpec. Fully inline (no `sb-badge-unresolved`
// class): that shipped class still points at red-ink in the untouched
// stylesheet, so the primitive stays byte-controllable and does NOT inherit the
// old red. `border: 1px solid currentColor` + `color: var(--sb-ink)` = an ink
// border that follows the ink text — the shipped badge's structure with only the
// color token demoted from red-ink to ink.
//
// Exhaustive via the explicit return type + defaultless switch (unhandled
// variant -> tsc error = red build); promote to a `never` default once the union
// is multi-variant. Margins are LAYOUT (host-owned), not rendered here.

/** Render a resolved UnresolvedBadge spec to DOM primitives. */
export function renderUnresolvedBadgeDom(
  spec: UnresolvedBadgeSpec,
): React.ReactElement {
  switch (spec.kind) {
    case "unresolvedBadge":
      return (
        <span
          data-testid="unresolved-badge"
          style={{
            fontFamily: "var(--sb-font-ui)",
            fontSize: `${String(spec.fontDomPx)}px`,
            fontWeight: 600,
            letterSpacing: `${String(spec.letterSpacingDomEm)}em`,
            textTransform: "uppercase",
            color: spec.inkVar,
            border: "1px solid currentColor",
            borderRadius: `${String(spec.borderRadiusDomPx)}px`,
            padding: spec.paddingDomPx,
            lineHeight: 1.2,
            display: "inline-block",
          }}
        >
          {spec.label}
        </span>
      )
  }
}

/** Thin DOM wrapper: derive the spec, then present it via the DOM adapter. */
export function UnresolvedBadgeView(
  input: UnresolvedBadgeInput,
): React.ReactElement {
  return renderUnresolvedBadgeDom(deriveUnresolvedBadgeSpec(input))
}
