import { View } from "@react-pdf/renderer"
import type { DividerBlock } from "../../../types/exportBuilder"

interface DividerBlockPdfProps {
  readonly block: DividerBlock
}

export function DividerBlockPdf({ block }: DividerBlockPdfProps) {
  const borderStyle = block.style ?? "solid"
  const color = block.color ?? "#D1D5DB"

  return (
    <View
      style={{
        borderBottomWidth: 0.5,
        borderBottomColor: color,
        borderBottomStyle: borderStyle,
        marginVertical: 8,
      }}
    />
  )
}
