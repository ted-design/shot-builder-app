import type { DividerBlock } from "../../types/exportBuilder"

interface DividerBlockViewProps {
  readonly block: DividerBlock
}

export function DividerBlockView({ block }: DividerBlockViewProps) {
  const borderStyle = block.style ?? "solid"
  const color = block.color ?? "#d1d5db"

  return (
    <hr
      data-testid="divider-block"
      style={{
        borderTopStyle: borderStyle,
        borderTopWidth: "1px",
        borderTopColor: color,
        borderBottom: "none",
        borderLeft: "none",
        borderRight: "none",
      }}
      className="my-2"
    />
  )
}
