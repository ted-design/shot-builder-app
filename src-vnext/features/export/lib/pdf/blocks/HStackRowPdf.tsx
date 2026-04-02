import { View } from "@react-pdf/renderer"
import type { HStackRow } from "../../../types/exportBuilder"
import type { ExportVariable } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import { ExportPdfBlockMapper } from "../ExportPdfBlockMapper"

interface HStackRowPdfProps {
  readonly row: HStackRow
  readonly variables: readonly ExportVariable[]
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
}

/**
 * Renders an HStack row as a horizontal flex container in PDF output.
 * Each column gets its percentage width, blocks are rendered sequentially within.
 */
export function HStackRowPdf({
  row,
  variables,
  data,
  imageMap,
}: HStackRowPdfProps) {
  return (
    <View style={{ flexDirection: "row", width: "100%" }}>
      {row.columns.map((col) => (
        <View
          key={col.id}
          style={{
            width: `${String(col.widthPercent)}%`,
            paddingHorizontal: 4,
          }}
        >
          {col.blocks.map((block) => (
            <ExportPdfBlockMapper
              key={block.id}
              block={block}
              variables={variables}
              data={data}
              imageMap={imageMap}
            />
          ))}
        </View>
      ))}
    </View>
  )
}
