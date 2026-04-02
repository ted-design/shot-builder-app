import type { Style } from "@react-pdf/types"
import type { BlockLayout } from "../../types/exportBuilder"

export function blockLayoutToPdfStyle(
  layout: BlockLayout | undefined,
): Style {
  if (!layout) return {}
  const style: Style = {}
  if (layout.paddingTop) style.paddingTop = layout.paddingTop
  if (layout.paddingRight) style.paddingRight = layout.paddingRight
  if (layout.paddingBottom) style.paddingBottom = layout.paddingBottom
  if (layout.paddingLeft) style.paddingLeft = layout.paddingLeft
  if (layout.marginTop) style.marginTop = layout.marginTop
  if (layout.marginRight) style.marginRight = layout.marginRight
  if (layout.marginBottom) style.marginBottom = layout.marginBottom
  if (layout.marginLeft) style.marginLeft = layout.marginLeft
  if (layout.borderWidth) {
    style.borderWidth = layout.borderWidth
    style.borderColor = layout.borderColor ?? "#000"
    const bs = layout.borderStyle ?? "solid"
    if (bs !== "none") {
      style.borderStyle = bs
    }
  }
  if (layout.borderRadius) style.borderRadius = layout.borderRadius
  if (layout.backgroundColor) style.backgroundColor = layout.backgroundColor
  if (layout.minHeight) style.minHeight = layout.minHeight
  return style
}
