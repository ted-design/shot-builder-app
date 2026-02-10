import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"

export type ShotsPdfOrientation = "portrait" | "landscape"
export type ShotsPdfLayout = "table" | "cards"
export type ContactSheetDensity = "standard" | "compact" | "max"
export type ContactCardsPerPage = "auto" | "4" | "6" | "8"
export type AddendumMode = "full" | "summary" | "off"
export type RunSheetDensity = "comfortable" | "compact"

export interface RunSheetColumns {
  readonly hero: boolean
  readonly date: boolean
  readonly location: boolean
  readonly talent: boolean
  readonly products: boolean
  readonly status: boolean
  readonly addendum: boolean
}

export const DEFAULT_RUN_SHEET_COLUMNS: RunSheetColumns = {
  hero: true,
  date: true,
  location: true,
  talent: true,
  products: true,
  status: true,
  addendum: false,
}

export type ShotsPdfRow = {
  readonly id: string
  readonly title: string
  readonly shotNumber?: string | null
  readonly status?: string | null
  readonly dateLabel?: string | null
  readonly locationLabel?: string | null
  readonly talentLines: readonly string[]
  readonly productLines: readonly string[]
  readonly description?: string | null
  readonly notesAddendum?: string | null
  readonly heroImageRequested?: boolean
  readonly heroImageMissing?: boolean
  readonly heroImageUrl?: string | null
}

type StatusTone = {
  readonly bg: string
  readonly border: string
  readonly text: string
}

const STATUS_TONES: Record<string, StatusTone> = {
  todo: { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" },
  in_progress: { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" },
  on_hold: { bg: "#F9FAFB", border: "#D1D5DB", text: "#374151" },
  complete: { bg: "#ECFDF5", border: "#A7F3D0", text: "#047857" },
}

const A4_LONG_PT = 841.89
const A4_SHORT_PT = 595.28
const PAGE_HORIZONTAL_PADDING_PT = 24

const styles = StyleSheet.create({
  page: {
    paddingTop: 92,
    paddingHorizontal: PAGE_HORIZONTAL_PADDING_PT,
    paddingBottom: 24,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  header: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  headerTitle: { fontSize: 20, fontWeight: 700, color: "#0F172A" },
  headerSub: { marginTop: 2, fontSize: 9, color: "#64748B" },
  headerMeta: { fontSize: 9, color: "#64748B", textAlign: "right" },

  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  summaryChip: {
    marginRight: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  summaryChipText: {
    fontSize: 8,
    color: "#334155",
  },

  sectionLabel: {
    fontSize: 7.5,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  table: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    minHeight: 60,
  },
  tableRowPortrait: {
    minHeight: 54,
  },
  tableRowCompact: {
    minHeight: 52,
  },
  tableRowPortraitCompact: {
    minHeight: 46,
  },
  tableCell: {
    paddingVertical: 7,
    paddingHorizontal: 8,
    justifyContent: "flex-start",
  },
  tableCellCompact: {
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableShotTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#0F172A",
  },
  tableShotMeta: {
    marginTop: 2,
    fontSize: 8.4,
    color: "#475569",
  },
  tableShotTitlePortrait: {
    fontSize: 9.2,
  },
  tableShotMetaPortrait: {
    fontSize: 7.4,
  },
  tableShotTitleCompact: {
    fontSize: 9.1,
  },
  tableShotMetaCompact: {
    marginTop: 1,
    fontSize: 7.6,
  },
  tableSection: { marginTop: 4 },
  tableLine: { fontSize: 8.4, lineHeight: 1.24, color: "#1F2937" },
  tableLineMuted: { fontSize: 8.4, lineHeight: 1.24, color: "#94A3B8" },
  tableLinePortrait: { fontSize: 7.5, lineHeight: 1.2 },
  tableLineMutedPortrait: { fontSize: 7.5, lineHeight: 1.2 },
  tableLineCompact: { fontSize: 7.6, lineHeight: 1.16 },
  tableLineMutedCompact: { fontSize: 7.6, lineHeight: 1.16 },

  heroThumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginTop: 1,
  },
  heroThumbImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  heroThumbWrapCompact: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginTop: 1,
  },
  heroThumbImageCompact: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  heroThumbText: {
    fontSize: 7,
    lineHeight: 1.2,
    textAlign: "center",
    color: "#64748B",
    paddingHorizontal: 4,
  },
  heroThumbWarn: {
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
  },
  heroThumbWarnText: {
    color: "#92400E",
  },

  cardsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  cardWarn: {
    borderColor: "#FCD34D",
  },
  cardTop: {
    flexDirection: "row",
  },
  cardHero: {
    width: 156,
    height: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 10,
  },
  cardHeroCompact: {
    width: 112,
    height: 76,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 9,
  },
  cardHeroDense: {
    width: 74,
    height: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginRight: 8,
  },
  cardHeroImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  cardMain: { flex: 1 },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#0F172A",
    marginRight: 6,
  },
  cardMetaRow: {
    marginTop: 4,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  cardMetaItem: {
    marginRight: 10,
    fontSize: 8.2,
    color: "#475569",
  },
  cardInfoBlock: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 6,
    backgroundColor: "#F8FAFC",
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  cardInfoTitle: {
    fontSize: 7.3,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardSection: { marginTop: 6 },
  cardSectionsSplit: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  cardSectionCol: {
    width: "49%",
  },
  cardSectionTitle: {
    fontSize: 7.3,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  cardLine: { fontSize: 8.5, lineHeight: 1.24, color: "#1F2937" },
  cardLineMuted: { fontSize: 8.5, lineHeight: 1.24, color: "#94A3B8" },
  cardDenseInline: { marginTop: 5 },
  cardDenseInlineLine: { fontSize: 7.3, lineHeight: 1.16, color: "#334155" },
  cardDenseInlineLabel: { fontSize: 7, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.45 },

  pill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 1.8,
    paddingHorizontal: 6,
    marginRight: 4,
    marginTop: 2,
  },
  pillText: {
    fontSize: 7.3,
    lineHeight: 1.1,
    letterSpacing: 0.1,
  },
  pillCompact: {
    paddingVertical: 1.2,
    paddingHorizontal: 4,
    marginTop: 1,
  },
  pillTextCompact: {
    fontSize: 6.6,
    letterSpacing: 0,
  },

  detailCard: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
  },
  detailHero: {
    width: "100%",
    height: 230,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 10,
  },
  detailHeroLandscape: {
    width: "100%",
    height: 180,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    marginBottom: 10,
  },
  detailHeroImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  detailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "#0F172A",
    marginRight: 6,
  },
  detailMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  detailMetaItem: {
    marginRight: 12,
    fontSize: 9,
    color: "#475569",
  },
  detailSection: { marginTop: 8 },
  detailSectionTitle: {
    fontSize: 8,
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  detailLine: { fontSize: 9.2, lineHeight: 1.3, color: "#1F2937" },
  detailLineMuted: { fontSize: 9.2, lineHeight: 1.3, color: "#94A3B8" },

  pageNumber: {
    position: "absolute",
    right: 24,
    bottom: 14,
    fontSize: 8.5,
    color: "#94A3B8",
  },
})

function formatStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown"
  if (status === "in_progress") return "In progress"
  if (status === "on_hold") return "On hold"
  if (status === "todo") return "To do"
  if (status === "complete") return "Complete"
  return status
}

function statusToneFor(status: string | null | undefined): StatusTone {
  if (!status) return { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" }
  return STATUS_TONES[status] ?? { bg: "#F8FAFC", border: "#CBD5E1", text: "#475569" }
}

function compactLines(lines: readonly string[], max: number): readonly string[] {
  if (lines.length <= max) return lines
  const next = [...lines.slice(0, max)]
  next.push(`+${lines.length - max} more`)
  return next
}

function compactText(value: string | null | undefined, maxChars: number): string | null {
  if (!value) return null
  const normalized = value.replace(/\s+/g, " ").trim()
  if (!normalized) return null
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, maxChars).trimEnd()}…`
}

function resolveEffectiveContactDensity(
  orientation: ShotsPdfOrientation,
  density: ContactSheetDensity,
  cardsPerPage: ContactCardsPerPage,
): ContactSheetDensity {
  if (cardsPerPage === "auto") return density
  if (cardsPerPage === "4") {
    return orientation === "landscape" ? "standard" : "compact"
  }
  if (cardsPerPage === "6") return "compact"
  return "max"
}

function resolveTargetCardsPerPage(
  orientation: ShotsPdfOrientation,
  density: ContactSheetDensity,
  cardsPerPage: ContactCardsPerPage,
): number {
  if (cardsPerPage !== "auto") return Number(cardsPerPage)
  if (orientation === "landscape") {
    if (density === "standard") return 4
    if (density === "compact") return 6
    return 8
  }
  if (density === "standard") return 3
  if (density === "compact") return 4
  return 8
}

function resolveGridConfig(
  orientation: ShotsPdfOrientation,
  density: ContactSheetDensity,
): { readonly columns: 1 | 2; readonly cardWidth: number; readonly gap: number; readonly marginBottom: number } {
  const contentWidth =
    (orientation === "landscape" ? A4_LONG_PT : A4_SHORT_PT) - PAGE_HORIZONTAL_PADDING_PT * 2

  if (orientation === "landscape") {
    const gap = density === "standard" ? 10 : density === "compact" ? 8 : 6
    return {
      columns: 2,
      gap,
      cardWidth: (contentWidth - gap) / 2,
      marginBottom: density === "standard" ? 10 : density === "compact" ? 8 : 6,
    }
  }

  if (density === "max") {
    const gap = 6
    return {
      columns: 2,
      gap,
      cardWidth: (contentWidth - gap) / 2,
      marginBottom: 6,
    }
  }

  return {
    columns: 1,
    gap: 0,
    cardWidth: contentWidth,
    marginBottom: density === "standard" ? 10 : 7,
  }
}

function resolveCardHeight(
  orientation: ShotsPdfOrientation,
  density: ContactSheetDensity,
): number {
  if (orientation === "landscape") {
    if (density === "standard") return 198
    if (density === "compact") return 136
    return 102
  }

  if (density === "standard") return 152
  if (density === "compact") return 110
  return 96
}

function resolveCardTextBudget(
  density: ContactSheetDensity,
  isLandscape: boolean,
): {
  readonly description: number
  readonly addendumFull: number
  readonly addendumSummary: number
  readonly talentLines: number
  readonly productLines: number
  readonly splitMeta: boolean
} {
  if (density === "max") {
    return {
      description: isLandscape ? 42 : 52,
      addendumFull: isLandscape ? 52 : 64,
      addendumSummary: isLandscape ? 34 : 40,
      talentLines: 1,
      productLines: 1,
      splitMeta: true,
    }
  }

  if (density === "compact") {
    return {
      description: isLandscape ? 88 : 98,
      addendumFull: isLandscape ? 110 : 120,
      addendumSummary: isLandscape ? 74 : 84,
      talentLines: isLandscape ? 2 : 2,
      productLines: isLandscape ? 2 : 2,
      splitMeta: true,
    }
  }

  return {
    description: isLandscape ? 126 : 176,
    addendumFull: isLandscape ? 170 : 220,
    addendumSummary: isLandscape ? 96 : 124,
    talentLines: isLandscape ? 3 : 3,
    productLines: isLandscape ? 3 : 3,
    splitMeta: isLandscape,
  }
}

function resolveTableAddendumBudget(
  addendumMode: AddendumMode,
  isLandscape: boolean,
  compact: boolean,
): number {
  if (addendumMode === "summary") return isLandscape ? (compact ? 74 : 96) : compact ? 42 : 54
  return isLandscape ? (compact ? 142 : 200) : compact ? 62 : 84
}

function shortStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown"
  if (status === "in_progress") return "In prog."
  if (status === "on_hold") return "On hold"
  if (status === "todo") return "To do"
  if (status === "complete") return "Done"
  return status
}

function StatusPill({
  status,
  compact = false,
  shortLabel = false,
}: {
  readonly status?: string | null
  readonly compact?: boolean
  readonly shortLabel?: boolean
}) {
  const tone = statusToneFor(status)
  return (
    <View
      style={[
        styles.pill,
        compact ? styles.pillCompact : null,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
        },
      ]}
    >
      <Text
        style={[styles.pillText, compact ? styles.pillTextCompact : null, { color: tone.text }]}
        wrap={false}
      >
        {shortLabel ? shortStatusLabel(status) : formatStatusLabel(status)}
      </Text>
    </View>
  )
}

function chunkRows<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size) as T[])
  }
  return chunks
}

function HeroImageBox({
  row,
  variant,
}: {
  readonly row: ShotsPdfRow
  readonly variant: "thumb" | "thumbCompact" | "card" | "cardCompact" | "cardDense" | "detail" | "detailLandscape"
}) {
  const style =
    variant === "thumb"
      ? styles.heroThumbWrap
      : variant === "thumbCompact"
        ? styles.heroThumbWrapCompact
        : variant === "card"
          ? styles.cardHero
          : variant === "cardCompact"
            ? styles.cardHeroCompact
            : variant === "cardDense"
              ? styles.cardHeroDense
              : variant === "detailLandscape"
                ? styles.detailHeroLandscape
                : styles.detailHero

  const showWarn = !row.heroImageUrl && !!row.heroImageMissing
  return (
    <View style={[style, showWarn ? styles.heroThumbWarn : null]}>
      {row.heroImageUrl ? <Image src={row.heroImageUrl} style={styles.cardHeroImage} /> : null}
      {!row.heroImageUrl ? (
        <Text style={[styles.heroThumbText, showWarn ? styles.heroThumbWarnText : null]}>
          {showWarn ? "Image unavailable" : "No image"}
        </Text>
      ) : null}
    </View>
  )
}

function PdfHeader({
  title,
  subtitle,
  generatedAt,
}: {
  readonly title: string
  readonly subtitle: string
  readonly generatedAt: string
}) {
  return (
    <View fixed style={styles.header}>
      <View>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSub}>{subtitle}</Text>
      </View>
      <Text style={styles.headerMeta}>Generated {generatedAt}</Text>
    </View>
  )
}

function SummaryChip({ label }: { readonly label: string }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryChipText}>{label}</Text>
    </View>
  )
}

export function ShotsListPdfDocument({
  projectName,
  title,
  generatedAt,
  orientation,
  layout,
  rows,
  includeHero,
  includeDescription,
  includeNotesAddendum,
  addendumMode = "full",
  contactDensity = "standard",
  contactCardsPerPage = "auto",
  runSheetColumns = DEFAULT_RUN_SHEET_COLUMNS,
  runSheetDensity = "comfortable",
  hideEmptyMeta = false,
}: {
  readonly projectName: string
  readonly title: string
  readonly generatedAt: string
  readonly orientation: ShotsPdfOrientation
  readonly layout: ShotsPdfLayout
  readonly rows: readonly ShotsPdfRow[]
  readonly includeHero: boolean
  readonly includeDescription: boolean
  readonly includeNotesAddendum: boolean
  readonly addendumMode?: AddendumMode
  readonly contactDensity?: ContactSheetDensity
  readonly contactCardsPerPage?: ContactCardsPerPage
  readonly runSheetColumns?: RunSheetColumns
  readonly runSheetDensity?: RunSheetDensity
  readonly hideEmptyMeta?: boolean
}) {
  const subtitle = `${projectName} - ${rows.length} shots`
  const heroRequested = rows.filter((row) => row.heroImageRequested).length
  const heroResolved = rows.filter((row) => row.heroImageRequested && !!row.heroImageUrl).length
  const heroMissing = Math.max(0, heroRequested - heroResolved)
  const effectiveAddendumMode: AddendumMode = includeNotesAddendum ? addendumMode : "off"

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <PdfHeader title={title} subtitle={subtitle} generatedAt={generatedAt} />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />

        <View style={styles.summaryBar}>
          <SummaryChip label={`${rows.length} shots`} />
          {includeHero ? (
            <>
              <SummaryChip label={`${heroResolved}/${heroRequested} heroes embedded`} />
              {heroMissing > 0 ? <SummaryChip label={`${heroMissing} image unavailable`} /> : null}
            </>
          ) : (
            <SummaryChip label="Hero images hidden" />
          )}
        </View>

        {layout === "cards" ? (
          <ContactCardsPdf
            rows={rows}
            orientation={orientation}
            density={contactDensity}
            cardsPerPage={contactCardsPerPage}
            includeHero={includeHero}
            includeDescription={includeDescription}
            addendumMode={effectiveAddendumMode}
            hideEmptyMeta={hideEmptyMeta}
          />
        ) : (
          <ShotsTablePdf
            rows={rows}
            includeHero={includeHero}
            includeDescription={includeDescription}
            addendumMode={effectiveAddendumMode}
            orientation={orientation}
            columns={runSheetColumns}
            rowDensity={runSheetDensity}
          />
        )}
      </Page>
    </Document>
  )
}

function ContactCardsPdf({
  rows,
  orientation,
  density,
  cardsPerPage,
  includeHero,
  includeDescription,
  addendumMode,
  hideEmptyMeta,
}: {
  readonly rows: readonly ShotsPdfRow[]
  readonly orientation: ShotsPdfOrientation
  readonly density: ContactSheetDensity
  readonly cardsPerPage: ContactCardsPerPage
  readonly includeHero: boolean
  readonly includeDescription: boolean
  readonly addendumMode: AddendumMode
  readonly hideEmptyMeta: boolean
}) {
  const isLandscape = orientation === "landscape"
  const effectiveDensity = resolveEffectiveContactDensity(orientation, density, cardsPerPage)
  const targetCardsPerPage = resolveTargetCardsPerPage(orientation, effectiveDensity, cardsPerPage)
  const cardHeight = resolveCardHeight(orientation, effectiveDensity)
  const grid = resolveGridConfig(orientation, effectiveDensity)

  if (grid.columns === 1) {
    const cardsPerChunk = Math.max(1, targetCardsPerPage)
    const chunks = chunkRows(rows, cardsPerChunk)
    return (
      <View>
        {chunks.map((chunk, chunkIndex) => (
          <View key={`chunk-${chunkIndex}`} break={chunkIndex > 0}>
            {chunk.map((row, rowIndex) => (
              <ShotCardPdf
                key={row.id}
                row={row}
                includeHero={includeHero}
                includeDescription={includeDescription}
                isLandscape={isLandscape}
                density={effectiveDensity}
                addendumMode={addendumMode}
                hideEmptyMeta={hideEmptyMeta}
                marginBottom={rowIndex === chunk.length - 1 ? 0 : grid.marginBottom}
                cardHeight={cardHeight}
              />
            ))}
          </View>
        ))}
      </View>
    )
  }

  const rowsByLine = chunkRows(rows, 2)
  const linesPerPage = Math.max(1, Math.floor(targetCardsPerPage / 2))
  const linePages = chunkRows(rowsByLine, linesPerPage)
  return (
    <View>
      {linePages.map((linePage, pageIndex) => (
        <View key={`line-page-${pageIndex}`} break={pageIndex > 0}>
          {linePage.map((line, lineIndex) => (
            <View
              key={`line-${pageIndex}-${lineIndex}`}
              style={{ flexDirection: "row", marginBottom: lineIndex === linePage.length - 1 ? 0 : grid.marginBottom }}
              wrap={false}
            >
              {line.map((row, columnIndex) => (
                <View
                  key={row.id}
                  style={{ width: grid.cardWidth, marginRight: columnIndex === 0 ? grid.gap : 0 }}
                >
                  <ShotCardPdf
                    row={row}
                    includeHero={includeHero}
                    includeDescription={includeDescription}
                    isLandscape={isLandscape}
                    density={effectiveDensity}
                    addendumMode={addendumMode}
                    hideEmptyMeta={hideEmptyMeta}
                    marginBottom={0}
                    cardHeight={cardHeight}
                  />
                </View>
              ))}
              {line.length === 1 ? <View style={{ width: grid.cardWidth }} /> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

function ShotsTablePdf({
  rows,
  includeHero,
  includeDescription,
  addendumMode,
  orientation,
  columns,
  rowDensity,
}: {
  readonly rows: readonly ShotsPdfRow[]
  readonly includeHero: boolean
  readonly includeDescription: boolean
  readonly addendumMode: AddendumMode
  readonly orientation: ShotsPdfOrientation
  readonly columns: RunSheetColumns
  readonly rowDensity: RunSheetDensity
}) {
  const isLandscape = orientation === "landscape"
  const compactRows = rowDensity === "compact"
  const cols = [
    columns.hero && includeHero ? { key: "hero", flex: isLandscape ? 0.92 : 0.68 } : null,
    { key: "shot", flex: isLandscape ? 2.7 : 2.3 },
    columns.date ? { key: "date", flex: isLandscape ? 0.9 : 0.78 } : null,
    columns.location ? { key: "location", flex: isLandscape ? 1.18 : 0.94 } : null,
    columns.talent ? { key: "talent", flex: isLandscape ? 1.34 : 1.1 } : null,
    columns.products ? { key: "products", flex: isLandscape ? 1.72 : 1.34 } : null,
    columns.status ? { key: "status", flex: isLandscape ? 1.02 : 1.28 } : null,
  ].filter(Boolean) as Array<{ readonly key: string; readonly flex: number }>
  const densePortrait = !isLandscape && cols.length >= (compactRows ? 4 : 5)

  const headerLabel = (key: string) => {
    if (key === "hero") return "Hero"
    if (key === "shot") return "Shot"
    if (key === "date") return "Date"
    if (key === "location") return "Location"
    if (key === "talent") return "Talent"
    if (key === "products") return "Products"
    if (key === "status") return "Status"
    return key
  }

  const addendumBudget = resolveTableAddendumBudget(addendumMode, isLandscape, compactRows)
  const descriptionBudget = isLandscape ? (compactRows ? 92 : 112) : densePortrait ? 38 : compactRows ? 52 : 64
  const talentLineBudget = isLandscape ? (compactRows ? 2 : 3) : densePortrait ? 1 : compactRows ? 1 : 2
  const productLineBudget = isLandscape ? (compactRows ? 3 : 4) : densePortrait ? 2 : compactRows ? 2 : 3

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {cols.map((c) => (
          <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
            <Text style={styles.sectionLabel}>{headerLabel(c.key)}</Text>
          </View>
        ))}
      </View>

      {rows.map((row) => (
        <View
          key={row.id}
          style={[
            styles.tableRow,
            !isLandscape ? styles.tableRowPortrait : null,
            compactRows ? styles.tableRowCompact : null,
            compactRows && !isLandscape ? styles.tableRowPortraitCompact : null,
          ]}
          wrap={false}
        >
          {cols.map((c) => {
            if (c.key === "hero") {
              return (
                <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex, alignItems: "center" }]}>
                  <HeroImageBox row={row} variant={isLandscape && !compactRows ? "thumb" : "thumbCompact"} />
                </View>
              )
            }

            if (c.key === "shot") {
              const description = includeDescription
                ? compactText(row.description, descriptionBudget)
                : null
              const addendum =
                addendumMode === "off" || !columns.addendum
                  ? null
                  : compactText(row.notesAddendum, addendumBudget)

              return (
                <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
                  <Text
                    style={[
                      styles.tableShotTitle,
                      !isLandscape ? styles.tableShotTitlePortrait : null,
                      compactRows ? styles.tableShotTitleCompact : null,
                    ]}
                  >
                    {row.shotNumber ? `#${row.shotNumber} - ` : ""}
                    {row.title}
                  </Text>
                  {description ? (
                    <Text
                      style={[
                        styles.tableShotMeta,
                        !isLandscape ? styles.tableShotMetaPortrait : null,
                        compactRows ? styles.tableShotMetaCompact : null,
                      ]}
                    >
                      {description}
                    </Text>
                  ) : null}
                  {addendum ? (
                    <View style={styles.tableSection}>
                      <Text style={styles.sectionLabel}>Addendum</Text>
                      <Text
                        style={[
                          styles.tableLine,
                          !isLandscape ? styles.tableLinePortrait : null,
                          compactRows ? styles.tableLineCompact : null,
                        ]}
                      >
                        {addendum}
                      </Text>
                    </View>
                  ) : null}
                </View>
              )
            }

            if (c.key === "date") {
              return (
                <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
                  <Text style={[styles.tableLine, !isLandscape ? styles.tableLinePortrait : null, compactRows ? styles.tableLineCompact : null]}>
                    {row.dateLabel || "-"}
                  </Text>
                </View>
              )
            }

            if (c.key === "location") {
              return (
                <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
                  <Text style={[styles.tableLine, !isLandscape ? styles.tableLinePortrait : null, compactRows ? styles.tableLineCompact : null]}>
                    {row.locationLabel || "-"}
                  </Text>
                </View>
              )
            }

            if (c.key === "talent") {
              const lines = compactLines(row.talentLines, talentLineBudget)
              return (
                <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
                  {lines.length === 0 ? (
                    <Text
                      style={[
                        styles.tableLineMuted,
                        !isLandscape ? styles.tableLineMutedPortrait : null,
                        compactRows ? styles.tableLineMutedCompact : null,
                      ]}
                    >
                      -
                    </Text>
                  ) : (
                    lines.map((line, index) => (
                      <Text
                        key={`${line}-${index}`}
                        style={[styles.tableLine, !isLandscape ? styles.tableLinePortrait : null, compactRows ? styles.tableLineCompact : null]}
                      >
                        {line}
                      </Text>
                    ))
                  )}
                </View>
              )
            }

            if (c.key === "products") {
              const lines = compactLines(row.productLines, productLineBudget)
              return (
                <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
                  {lines.length === 0 ? (
                    <Text
                      style={[
                        styles.tableLineMuted,
                        !isLandscape ? styles.tableLineMutedPortrait : null,
                        compactRows ? styles.tableLineMutedCompact : null,
                      ]}
                    >
                      -
                    </Text>
                  ) : (
                    lines.map((line, index) => (
                      <Text
                        key={`${line}-${index}`}
                        style={[styles.tableLine, !isLandscape ? styles.tableLinePortrait : null, compactRows ? styles.tableLineCompact : null]}
                      >
                        {line}
                      </Text>
                    ))
                  )}
                </View>
              )
            }

            if (c.key === "status") {
              return (
                <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
                  <StatusPill
                    status={row.status}
                    compact={!isLandscape || compactRows}
                    shortLabel={!isLandscape || densePortrait || compactRows}
                  />
                </View>
              )
            }

            return (
              <View key={c.key} style={[styles.tableCell, compactRows ? styles.tableCellCompact : null, { flex: c.flex }]}>
                <Text
                  style={[
                    styles.tableLineMuted,
                    !isLandscape ? styles.tableLineMutedPortrait : null,
                    compactRows ? styles.tableLineMutedCompact : null,
                  ]}
                >
                  -
                </Text>
              </View>
            )
          })}
        </View>
      ))}
    </View>
  )
}

function ShotCardPdf({
  row,
  includeHero,
  includeDescription,
  isLandscape,
  density,
  addendumMode,
  hideEmptyMeta,
  marginBottom,
  cardHeight,
}: {
  readonly row: ShotsPdfRow
  readonly includeHero: boolean
  readonly includeDescription: boolean
  readonly isLandscape: boolean
  readonly density: ContactSheetDensity
  readonly addendumMode: AddendumMode
  readonly hideEmptyMeta: boolean
  readonly marginBottom: number
  readonly cardHeight: number
}) {
  const budget = resolveCardTextBudget(density, isLandscape)
  const dense = density === "max"
  const talentLines = compactLines(row.talentLines, budget.talentLines)
  const productLines = compactLines(row.productLines, budget.productLines)
  const description = includeDescription ? compactText(row.description, budget.description) : null
  const showDate = !hideEmptyMeta || !!row.dateLabel
  const showLocation = !hideEmptyMeta || !!row.locationLabel

  let addendum: string | null = null
  if (addendumMode === "full") {
    addendum = compactText(row.notesAddendum, budget.addendumFull)
  } else if (addendumMode === "summary") {
    addendum = compactText(row.notesAddendum, budget.addendumSummary)
  }

  const heroVariant =
    density === "max"
      ? "cardDense"
      : density === "compact"
        ? isLandscape
          ? "cardDense"
          : "cardCompact"
        : isLandscape
          ? "cardCompact"
          : "card"

  return (
    <View
      style={[
        styles.card,
        row.heroImageMissing ? styles.cardWarn : null,
        {
          marginBottom,
          padding: density === "max" ? 7 : density === "compact" ? 8 : 9,
          minHeight: cardHeight,
          height: cardHeight,
        },
      ]}
      wrap={false}
    >
      <View style={styles.cardTop}>
        {includeHero ? <HeroImageBox row={row} variant={heroVariant} /> : null}

        <View style={styles.cardMain}>
          <View style={styles.cardTitleRow}>
            <Text style={[styles.cardTitle, dense ? { fontSize: 10.4 } : null]}>{row.title}</Text>
            {row.shotNumber ? (
              <View style={styles.pill}>
                <Text style={[styles.pillText, { color: "#334155" }]}>#{row.shotNumber}</Text>
              </View>
            ) : null}
            <StatusPill status={row.status} />
          </View>

          {showDate || showLocation ? (
            <View style={styles.cardMetaRow}>
              {showDate ? (
                <Text style={[styles.cardMetaItem, dense ? { fontSize: 7.6, marginRight: 8 } : null]}>
                  {row.dateLabel || "No date"}
                </Text>
              ) : null}
              {showLocation ? (
                <Text style={[styles.cardMetaItem, dense ? { fontSize: 7.6, marginRight: 8 } : null]}>
                  {row.locationLabel || "No location"}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!dense && description ? (
            <View style={styles.cardInfoBlock}>
              <Text style={styles.cardInfoTitle}>Description</Text>
              <Text style={styles.cardLine}>{description}</Text>
            </View>
          ) : null}

          {!dense && addendum ? (
            <View style={styles.cardInfoBlock}>
              <Text style={styles.cardInfoTitle}>Addendum</Text>
              <Text style={styles.cardLine}>{addendum}</Text>
            </View>
          ) : null}

          {dense && (description || addendum) ? (
            <View style={styles.cardDenseInline}>
              {description ? (
                <Text style={styles.cardDenseInlineLine}>
                  <Text style={styles.cardDenseInlineLabel}>Desc </Text>
                  {description}
                </Text>
              ) : null}
              {addendum ? (
                <Text style={styles.cardDenseInlineLine}>
                  <Text style={styles.cardDenseInlineLabel}>Add </Text>
                  {addendum}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>

      {budget.splitMeta ? (
        <View style={styles.cardSectionsSplit}>
          <View style={styles.cardSectionCol}>
            <Text style={styles.cardSectionTitle}>Talent</Text>
            {talentLines.length === 0 ? (
              <Text style={[styles.cardLineMuted, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>None assigned</Text>
            ) : (
              talentLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={[styles.cardLine, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>
                  {line}
                </Text>
              ))
            )}
          </View>
          <View style={styles.cardSectionCol}>
            <Text style={styles.cardSectionTitle}>Products</Text>
            {productLines.length === 0 ? (
              <Text style={[styles.cardLineMuted, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>None assigned</Text>
            ) : (
              productLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={[styles.cardLine, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>
                  {line}
                </Text>
              ))
            )}
          </View>
        </View>
      ) : (
        <>
          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Talent</Text>
            {talentLines.length === 0 ? (
              <Text style={[styles.cardLineMuted, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>None assigned</Text>
            ) : (
              talentLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={[styles.cardLine, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>
                  {line}
                </Text>
              ))
            )}
          </View>

          <View style={styles.cardSection}>
            <Text style={styles.cardSectionTitle}>Products</Text>
            {productLines.length === 0 ? (
              <Text style={[styles.cardLineMuted, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>None assigned</Text>
            ) : (
              productLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={[styles.cardLine, dense ? { fontSize: 7.3, lineHeight: 1.14 } : null]}>
                  {line}
                </Text>
              ))
            )}
          </View>
        </>
      )}
    </View>
  )
}

export function ShotDetailPdfDocument({
  projectName,
  title,
  generatedAt,
  orientation,
  row,
  includeHero,
  includeDescription,
  includeNotesAddendum,
}: {
  readonly projectName: string
  readonly title: string
  readonly generatedAt: string
  readonly orientation: ShotsPdfOrientation
  readonly row: ShotsPdfRow
  readonly includeHero: boolean
  readonly includeDescription: boolean
  readonly includeNotesAddendum: boolean
}) {
  const isLandscape = orientation === "landscape"
  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <PdfHeader title={title} subtitle={projectName} generatedAt={generatedAt} />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />

        <View style={styles.detailCard}>
          {includeHero ? <HeroImageBox row={row} variant={isLandscape ? "detailLandscape" : "detail"} /> : null}

          <View style={styles.detailTitleRow}>
            <Text style={styles.detailTitle}>{row.title}</Text>
            {row.shotNumber ? (
              <View style={styles.pill}>
                <Text style={[styles.pillText, { color: "#334155" }]}>#{row.shotNumber}</Text>
              </View>
            ) : null}
            <StatusPill status={row.status} />
          </View>

          <View style={styles.detailMetaRow}>
            <Text style={styles.detailMetaItem}>Date: {row.dateLabel || "-"}</Text>
            <Text style={styles.detailMetaItem}>Location: {row.locationLabel || "-"}</Text>
          </View>

          {includeDescription && row.description ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Description</Text>
              <Text style={styles.detailLine}>{row.description}</Text>
            </View>
          ) : null}

          {includeNotesAddendum && row.notesAddendum ? (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Addendum</Text>
              <Text style={styles.detailLine}>{row.notesAddendum}</Text>
            </View>
          ) : null}

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Talent</Text>
            {row.talentLines.length === 0 ? (
              <Text style={styles.detailLineMuted}>None assigned</Text>
            ) : (
              row.talentLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.detailLine}>
                  {line}
                </Text>
              ))
            )}
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Products</Text>
            {row.productLines.length === 0 ? (
              <Text style={styles.detailLineMuted}>None assigned</Text>
            ) : (
              row.productLines.map((line, index) => (
                <Text key={`${line}-${index}`} style={styles.detailLine}>
                  {line}
                </Text>
              ))
            )}
          </View>
        </View>
      </Page>
    </Document>
  )
}
