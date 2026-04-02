import { Text, View } from "@react-pdf/renderer"
import type { ShotGridBlock } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import type { Shot, TalentRecord } from "@/shared/types"
import { styles, STATUS_COLORS, STATUS_LABELS } from "../pdfStyles"

interface ShotGridBlockPdfProps {
  readonly block: ShotGridBlock
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
}

function filterShots(shots: readonly Shot[], filter: ShotGridBlock["filter"]): readonly Shot[] {
  if (!filter) return shots
  return shots.filter((shot) => {
    if (filter.status?.length && !filter.status.includes(shot.status)) return false
    if (filter.tagIds?.length) {
      const ids = shot.tags?.map((t) => t.id) ?? []
      if (!filter.tagIds.some((id) => ids.includes(id))) return false
    }
    return true
  })
}

function sortShots(shots: readonly Shot[], sortBy: ShotGridBlock["sortBy"], dir: ShotGridBlock["sortDirection"]): readonly Shot[] {
  if (!sortBy) return shots
  const m = dir === "desc" ? -1 : 1
  return [...shots].sort((a, b) => {
    if (sortBy === "shotNumber") return (Number(a.shotNumber ?? 0) - Number(b.shotNumber ?? 0)) * m
    if (sortBy === "title") return a.title.localeCompare(b.title) * m
    return a.status.localeCompare(b.status) * m
  })
}

function resolveProducts(shot: Shot): string {
  const names = [
    ...shot.products.map((p) => p.familyName).filter(Boolean),
    ...(shot.looks ?? []).flatMap((l) => l.products.map((p) => p.familyName)).filter(Boolean),
  ]
  return [...new Set(names)].join(", ") || "\u2014"
}

function resolveTalent(shot: Shot, talent: readonly TalentRecord[]): string {
  if (shot.talentIds?.length) {
    const map = new Map(talent.map((t) => [t.id, t.name]))
    const names = shot.talentIds.map((id) => map.get(id)).filter(Boolean)
    if (names.length > 0) return names.join(", ")
  }
  return shot.talent?.length ? shot.talent.join(", ") : "\u2014"
}

function cellText(shot: Shot, key: string, talent: readonly TalentRecord[]): string {
  switch (key) {
    case "shotNumber": return String(shot.shotNumber ?? "0").padStart(3, "0")
    case "title": return shot.title
    case "products": return resolveProducts(shot)
    case "talent": return resolveTalent(shot, talent)
    case "location": return shot.locationName ?? "\u2014"
    case "description": return shot.description ?? "\u2014"
    case "tags": return shot.tags?.map((t) => t.label).join(", ") || "\u2014"
    case "notes": return shot.notes ?? "\u2014"
    case "thumbnail": return ""
    default: return "\u2014"
  }
}

export function ShotGridBlockPdf({ block, data }: ShotGridBlockPdfProps) {
  const filtered = filterShots(data.shots, block.filter)
  const sorted = sortShots(filtered, block.sortBy, block.sortDirection)
  const cols = block.columns.filter((c) => c.visible && c.key !== "thumbnail")

  if (sorted.length === 0) return null

  const ts = block.tableStyle
  const showBorders = ts?.showBorders !== false
  const showHeaderBg = ts?.showHeaderBg !== false
  const stripe = ts?.stripeRows !== false

  return (
    <View style={showBorders ? styles.tableContainer : undefined}>
      <View style={showHeaderBg ? styles.tableHeader : { flexDirection: "row" as const }}>
        {cols.map((col) => (
          <Text key={col.key} style={{ ...styles.tableHeaderCell, flex: 1 }}>
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
              const sc = STATUS_COLORS[shot.status] ?? { bg: "#F3F4F6", text: "#374151" }
              return (
                <View key={col.key} style={{ ...styles.tableCell, flex: 1 }}>
                  <Text style={{ ...styles.badge, backgroundColor: sc.bg, color: sc.text }}>
                    {STATUS_LABELS[shot.status] ?? shot.status}
                  </Text>
                </View>
              )
            }
            return (
              <Text key={col.key} style={{ ...styles.tableCell, flex: 1 }}>
                {cellText(shot, col.key, data.talent)}
              </Text>
            )
          })}
        </View>
      ))}
    </View>
  )
}
