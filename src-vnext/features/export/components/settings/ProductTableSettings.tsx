import type { ProductTableBlock } from "../../types/exportBuilder"
import { ColumnTableSettings } from "./ColumnTableSettings"

export function ProductTableSettings({
  block,
  onUpdate,
}: {
  readonly block: ProductTableBlock
  readonly onUpdate: (updates: Partial<ProductTableBlock>) => void
}) {
  return (
    <ColumnTableSettings
      columns={block.columns}
      tableStyle={block.tableStyle}
      onColumnsChange={(cols) => onUpdate({ columns: cols })}
      onTableStyleChange={(style) => onUpdate({ tableStyle: style })}
    />
  )
}
