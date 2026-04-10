import { Text, View } from "@react-pdf/renderer"
import type { ShotGridBlock, ShotGridColumn } from "../../../types/exportBuilder"
import { COLUMN_WIDTH_PRESETS } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import type { Shot, ShotTag } from "@/shared/types"
import type { ShotFirestoreStatus } from "@/shared/types"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"
import { styles, PDF_STATUS_COLORS, PDF_TAG_CATEGORY_COLORS, PDF_TAG_COLOR_MAP } from "../pdfStyles"
import { isTagColorKey } from "@/shared/lib/tagColors"
import {
  filterShots,
  sortShots,
  resolveProductNamesString,
  resolveTalentNames,
} from "../../blockDataResolvers"

interface ShotGridBlockPdfProps {
  readonly block: ShotGridBlock
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
}

function cellText(shot: Shot, key: string, data: ExportData): string {
  switch (key) {
    case "shotNumber": return shot.shotNumber || "\u2014"
    case "title": return shot.title
    case "products": return resolveProductNamesString(shot)
    case "talent": return resolveTalentNames(shot, data.talent)
    case "location": return shot.locationName ?? "\u2014"
    case "description": return shot.description ?? "\u2014"
    case "tags": return shot.tags?.map((t) => t.label).join(", ") || "\u2014"
    case "notes": return shot.notes ?? "\u2014"
    case "thumbnail": return ""
    default: return "\u2014"
  }
}

function colFlex(col: ShotGridColumn): number {
  return COLUMN_WIDTH_PRESETS[col.width ?? "md"].flex
}

export function ShotGridBlockPdf({ block, data }: ShotGridBlockPdfProps) {
  const filtered = filterShots(data.shots, block.filter)
  const sorted = sortShots(filtered, block.sortBy, block.sortDirection)
  const cols = [...block.columns]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .filter((c) => c.visible && c.key !== "thumbnail")

  if (sorted.length === 0) return null

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
      {sorted.map((shot, i) => (
        <View
          key={shot.id}
          wrap={false}
          style={stripe && i % 2 === 1 ? styles.tableRowStriped : styles.tableRow}
        >
          {cols.map((col) => {
            if (col.key === "status") {
              const color = getShotStatusColor(shot.status as ShotFirestoreStatus)
              const sc = PDF_STATUS_COLORS[color] ?? { bg: "#F3F4F6", text: "#374151" }
              return (
                <View key={col.key} style={{ ...styles.tableCell, flex: colFlex(col) }}>
                  <Text style={{ ...styles.badge, backgroundColor: sc.bg, color: sc.text }}>
                    {getShotStatusLabel(shot.status as ShotFirestoreStatus)}
                  </Text>
                </View>
              )
            }
            if (col.key === "tags") {
              const tags: readonly ShotTag[] = shot.tags ?? []
              if (tags.length === 0) {
                return (
                  <Text key={col.key} style={{ ...styles.tableCell, flex: colFlex(col) }}>
                    {"\u2014"}
                  </Text>
                )
              }
              return (
                <View key={col.key} style={{ ...styles.tableCell, flex: colFlex(col), flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
                  {tags.map((t) => {
                    const cat = resolveShotTagCategory(t)
                    const catColors = PDF_TAG_CATEGORY_COLORS[cat] ?? PDF_TAG_CATEGORY_COLORS.other!
                    const borderColor = (typeof t.color === "string" && isTagColorKey(t.color))
                      ? (PDF_TAG_COLOR_MAP[t.color] ?? catColors.border)
                      : catColors.border
                    return (
                      <Text
                        key={t.id}
                        style={{
                          ...styles.badge,
                          backgroundColor: catColors.bg,
                          color: catColors.text,
                          borderLeftWidth: 2,
                          borderLeftColor: borderColor,
                          borderRadius: 3,
                          marginRight: 2,
                          marginBottom: 1,
                        }}
                      >
                        {t.label.length > 24 ? `${t.label.slice(0, 22)}\u2026` : t.label}
                      </Text>
                    )
                  })}
                </View>
              )
            }
            return (
              <Text key={col.key} style={{ ...styles.tableCell, flex: colFlex(col) }}>
                {cellText(shot, col.key, data)}
              </Text>
            )
          })}
        </View>
      ))}
    </View>
  )
}
