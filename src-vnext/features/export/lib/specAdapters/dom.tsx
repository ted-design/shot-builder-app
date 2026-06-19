import type { ResolvedBlockSpec } from "../blockSpec"

// DOM presenter for resolved block specs (the preview tree). The explicit
// ReactElement return type makes the switch exhaustive over ResolvedBlockSpec:
// an added variant with no case leaves a non-returning path -> tsc error
// (caught by typecheck:baseline) = red build. Promote to a `never` default once
// the union is multi-variant (single-member unions don't narrow to never).

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
