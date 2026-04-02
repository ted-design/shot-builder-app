import { Text, View, Image } from "@react-pdf/renderer"
import type { ShotDetailBlock } from "../../../types/exportBuilder"
import type { ExportData } from "../../../hooks/useExportData"
import type { ShotFirestoreStatus } from "@/shared/types"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import { styles, PDF_STATUS_COLORS } from "../pdfStyles"
import { resolveProductNamesList } from "../../blockDataResolvers"

interface ShotDetailBlockPdfProps {
  readonly block: ShotDetailBlock
  readonly data: ExportData
  readonly imageMap: ReadonlyMap<string, string>
}

export function ShotDetailBlockPdf({ block, data, imageMap }: ShotDetailBlockPdfProps) {
  const shot = block.shotId ? data.shots.find((s) => s.id === block.shotId) : undefined
  if (!shot) return null

  const color = getShotStatusColor(shot.status as ShotFirestoreStatus)
  const sc = PDF_STATUS_COLORS[color] ?? { bg: "#F3F4F6", text: "#374151" }
  const statusLabel = getShotStatusLabel(shot.status as ShotFirestoreStatus)
  const showHero = block.showHeroImage !== false
  const showDesc = block.showDescription !== false
  const showNotes = block.showNotes !== false
  const showProducts = block.showProducts !== false
  const heroSrc = showHero && shot.heroImage?.path ? imageMap.get(shot.heroImage.path) : undefined
  const productNames = showProducts ? resolveProductNamesList(shot).join(", ") : ""

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
