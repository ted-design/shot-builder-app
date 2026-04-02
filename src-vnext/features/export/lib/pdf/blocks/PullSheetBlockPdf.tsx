import { Text, View } from "@react-pdf/renderer"
import type { PullSheetBlock } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import type { PullItem } from "@/shared/types"
import { styles } from "../pdfStyles"

interface PullSheetBlockPdfProps {
  readonly block: PullSheetBlock
  readonly data: ExportData
}

const FULFILLMENT_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: "#F3F4F6", text: "#374151" },
  fulfilled: { bg: "#D1FAE5", text: "#047857" },
  partial: { bg: "#FEF3C7", text: "#B45309" },
  substituted: { bg: "#DBEAFE", text: "#1D4ED8" },
}

function totalQty(item: PullItem): number {
  return item.sizes.reduce((sum, s) => sum + s.quantity, 0)
}

function sizeLabel(item: PullItem): string {
  return item.sizes.map((s) => s.size).join(", ") || "\u2014"
}

const HEADERS = ["Product", "Color/SKU", "Size", "Qty"] as const

export function PullSheetBlockPdf({ block, data }: PullSheetBlockPdfProps) {
  const pull = block.pullId
    ? data.pulls.find((p) => p.id === block.pullId) ?? null
    : data.pulls[0] ?? null

  if (!pull || pull.items.length === 0) return null

  const showStatus = block.showFulfillmentStatus !== false
  const headers = showStatus ? [...HEADERS, "Status" as const] : HEADERS

  return (
    <View>
      <Text style={styles.sectionLabel}>{pull.name ?? pull.title ?? "Pull Sheet"}</Text>
      <View style={styles.tableContainer}>
        <View style={styles.tableHeader}>
          {headers.map((h) => (
            <Text key={h} style={{ ...styles.tableHeaderCell, flex: 1 }}>{h}</Text>
          ))}
        </View>
        {pull.items.map((item, i) => (
          <View
            key={item.id ?? i}
            wrap={false}
            style={i % 2 === 1 ? styles.tableRowStriped : styles.tableRow}
          >
            <Text style={{ ...styles.tableCell, flex: 1 }}>{item.familyName ?? "\u2014"}</Text>
            <Text style={{ ...styles.tableCell, flex: 1 }}>{item.colourName ?? "\u2014"}</Text>
            <Text style={{ ...styles.tableCell, flex: 1 }}>{sizeLabel(item)}</Text>
            <Text style={{ ...styles.tableCell, flex: 1 }}>{totalQty(item)}</Text>
            {showStatus ? (
              <View style={{ ...styles.tableCell, flex: 1 }}>
                <Text
                  style={{
                    ...styles.badge,
                    backgroundColor: FULFILLMENT_COLORS[item.fulfillmentStatus]?.bg ?? "#F3F4F6",
                    color: FULFILLMENT_COLORS[item.fulfillmentStatus]?.text ?? "#374151",
                  }}
                >
                  {item.fulfillmentStatus}
                </Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  )
}
