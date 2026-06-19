import { View } from "@react-pdf/renderer"
import type { ResolvedBlockSpec } from "../../blockSpec"

// @react-pdf presenter for resolved block specs (the PDF tree). The ONLY new
// file that imports @react-pdf, so it stays in the lazy pdf chunk. px-canonical
// spec values are converted to points here. The explicit ReactElement return
// type keeps the switch exhaustive: an unhandled variant -> tsc error = red
// build. Promote to a `never` default once the union is multi-variant.

/** CSS px -> PDF points (1px = 1/96in, 1pt = 1/72in). */
export const pxToPt = (px: number): number => (px * 72) / 96

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
