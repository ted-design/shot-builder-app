import { Text, View } from "@react-pdf/renderer"
import type { ProductTableBlock, ProductTableColumn } from "../../../types/exportBuilder"
import { COLUMN_WIDTH_PRESETS } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import type { ProductFamily } from "@/shared/types"
import { styles } from "../pdfStyles"

interface ProductTableBlockPdfProps {
  readonly block: ProductTableBlock
  readonly data: ExportData
}

function cellText(family: ProductFamily, key: string): string {
  switch (key) {
    case "styleName": return family.styleName
    case "styleNumber": return family.styleNumbers?.[0] ?? family.styleNumber ?? "\u2014"
    case "gender": return family.gender ?? "\u2014"
    case "skuCount": return family.skuCount != null ? String(family.skuCount) : "\u2014"
    case "classification": return family.category ?? "\u2014"
    default: return "\u2014"
  }
}

function colFlex(col: ProductTableColumn): number {
  return COLUMN_WIDTH_PRESETS[col.width ?? "md"].flex
}

export function ProductTableBlockPdf({ block, data }: ProductTableBlockPdfProps) {
  const families = data.productFamilies.filter((f) => f.deleted !== true)
  const cols = block.columns.filter((c) => c.visible)

  if (families.length === 0) return null

  const ts = block.tableStyle
  const showBorders = ts?.showBorders !== false
  const showHeaderBg = ts?.showHeaderBg !== false
  const stripe = ts?.stripeRows !== false

  return (
    <View style={showBorders ? styles.tableContainer : undefined}>
      <View style={showHeaderBg ? styles.tableHeader : { flexDirection: "row" as const }}>
        {cols.map((col) => (
          <Text key={col.key} style={{ ...styles.tableHeaderCell, flex: colFlex(col) }}>
            {col.label}
          </Text>
        ))}
      </View>
      {families.map((family, i) => (
        <View
          key={family.id}
          wrap={false}
          style={stripe && i % 2 === 1 ? styles.tableRowStriped : styles.tableRow}
        >
          {cols.map((col) => (
            <Text key={col.key} style={{ ...styles.tableCell, flex: colFlex(col) }}>
              {cellText(family, col.key)}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}
