import type { ResolvedBlockSpec } from "../blockSpec"

// DOM presenter for ResolvedBlockSpec. Exhaustive via the explicit return type
// (unhandled variant -> tsc error = red build); promote to a `never` default
// once the union is multi-variant. Spacing is rendered inline from the spec
// (not a Tailwind class) so the DOM and PDF consume one source and can't drift.

/** Render a resolved block spec to DOM primitives. */
export function renderBlockSpecDom(spec: ResolvedBlockSpec): React.ReactElement {
  switch (spec.kind) {
    case "divider":
      return (
        <hr
          data-testid="divider-block"
          style={{
            borderTopStyle: spec.lineStyle,
            borderTopWidth: `${String(spec.thicknessPx)}px`,
            borderTopColor: spec.color,
            borderBottom: "none",
            borderLeft: "none",
            borderRight: "none",
            marginTop: `${String(spec.marginYPx)}px`,
            marginBottom: `${String(spec.marginYPx)}px`,
          }}
        />
      )
  }
}
