import { View } from "@react-pdf/renderer"
import type { ResolvedBlockSpec } from "../../blockSpec"
import { pxToPt } from "../../units"

// @react-pdf presenter for ResolvedBlockSpec — the only adapter importing
// @react-pdf, so it stays in the lazy pdf chunk. Exhaustive via the explicit
// return type (unhandled variant -> tsc error = red build); promote to a
// `never` default once the union is multi-variant.

/** Render a resolved block spec to @react-pdf primitives. */
export function renderBlockSpecPdf(spec: ResolvedBlockSpec): React.ReactElement {
  switch (spec.kind) {
    case "divider":
      return (
        <View
          style={{
            borderBottomWidth: pxToPt(spec.thicknessPx),
            borderBottomColor: spec.color,
            borderBottomStyle: spec.lineStyle,
            marginVertical: pxToPt(spec.marginYPx),
          }}
        />
      )
  }
}
