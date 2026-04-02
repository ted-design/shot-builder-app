import { Text, View, Image } from "@react-pdf/renderer"
import type { ShotDetailBlock } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import type { Shot } from "@/shared/types"
import { styles, STATUS_COLORS, STATUS_LABELS } from "../pdfStyles"

interface ShotDetailBlockPdfProps {
  readonly block: ShotDetailBlock
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
}

function resolveProducts(shot: Shot): string {
  const names = [
    ...shot.products.map((p) => p.familyName).filter(Boolean),
    ...(shot.looks ?? []).flatMap((l) => l.products.map((p) => p.familyName)).filter(Boolean),
  ]
  return [...new Set(names)].join(", ")
}

export function ShotDetailBlockPdf({ block, data, imageMap }: ShotDetailBlockPdfProps) {
  const shot = block.shotId ? data.shots.find((s) => s.id === block.shotId) : undefined
  if (!shot) return null

  const sc = STATUS_COLORS[shot.status] ?? { bg: "#F3F4F6", text: "#374151" }
  const statusLabel = STATUS_LABELS[shot.status] ?? shot.status
  const showHero = block.showHeroImage !== false
  const showDesc = block.showDescription !== false
  const showNotes = block.showNotes !== false
  const showProducts = block.showProducts !== false
  const heroSrc = showHero && shot.heroImage?.path ? imageMap.get(shot.heroImage.path) : undefined
  const productNames = showProducts ? resolveProducts(shot) : ""

  return (
    <View wrap={false} style={{ flexDirection: "row", gap: 10, marginVertical: 4 }}>
      {heroSrc ? (
        <Image src={heroSrc} style={{ width: 150 }} />
      ) : null}

      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: "#111827" }}>
            #{String(shot.shotNumber ?? "0").padStart(3, "0")} {shot.title}
          </Text>
          <Text style={{ ...styles.badge, backgroundColor: sc.bg, color: sc.text }}>
            {statusLabel}
          </Text>
        </View>

        {showDesc && shot.description ? (
          <Text style={styles.bodyText}>{shot.description}</Text>
        ) : null}

        {showNotes && shot.notes ? (
          <Text style={{ ...styles.bodyText, fontSize: 8, color: "#9CA3AF", marginTop: 2 }}>
            {shot.notes}
          </Text>
        ) : null}

        {showProducts && productNames ? (
          <Text style={{ ...styles.bodyText, fontSize: 8, color: "#6B7280", marginTop: 3 }}>
            Products: {productNames}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
