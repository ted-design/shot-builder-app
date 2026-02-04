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
  readonly heroImageUrl?: string | null
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 24,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
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
  headerLeft: { flexDirection: "column" },
  headerTitle: { fontSize: 16, fontWeight: 700 },
  headerSub: { marginTop: 2, fontSize: 9, color: "#6B7280" },
  headerRight: { flexDirection: "column", alignItems: "flex-end" },
  headerMeta: { fontSize: 9, color: "#6B7280" },

  sectionLabel: {
    marginTop: 2,
    fontSize: 8,
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  table: { borderWidth: 1, borderColor: "#E5E7EB" },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  cell: { paddingVertical: 8, paddingHorizontal: 8 },
  cellMuted: { color: "#6B7280" },
  cellTitle: { fontSize: 10, fontWeight: 700 },
  cellSub: { marginTop: 2, fontSize: 9, color: "#6B7280" },
  cellLines: { marginTop: 4, flexDirection: "column" },
  line: { fontSize: 9, lineHeight: 1.25 },

  thumb: { width: 28, height: 28, borderRadius: 4, objectFit: "cover" },
  thumbCell: { justifyContent: "center", alignItems: "center" },

  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  cardTop: { flexDirection: "row", gap: 10 },
  cardThumb: { width: 64, height: 64, borderRadius: 8, objectFit: "cover" },
  cardTitleRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  cardTitle: { fontSize: 12, fontWeight: 700 },
  cardPill: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 6,
    fontSize: 8,
    color: "#6B7280",
  },
  cardMetaRow: { marginTop: 6, flexDirection: "row", gap: 10 },
  cardMeta: { fontSize: 9, color: "#374151" },
  cardBody: { marginTop: 8 },
  cardBlock: { marginTop: 8 },
  cardBlockTitle: { fontSize: 8, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.6 },

  pageNumber: {
    position: "absolute",
    right: 24,
    bottom: 16,
    fontSize: 9,
    color: "#9CA3AF",
  },
})

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
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>{title}</Text>
        <Text style={styles.headerSub}>{subtitle}</Text>
      </View>
      <View style={styles.headerRight}>
        <Text style={styles.headerMeta}>Generated {generatedAt}</Text>
      </View>
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
}) {
  const subtitle = `${projectName} · ${rows.length} shots`

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <PdfHeader title={title} subtitle={subtitle} generatedAt={generatedAt} />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />

        {layout === "cards" ? (
          <View>
            {rows.map((row) => (
              <ShotCardPdf
                key={row.id}
                row={row}
                includeHero={includeHero}
                includeDescription={includeDescription}
                includeNotesAddendum={includeNotesAddendum}
              />
            ))}
          </View>
        ) : (
          <ShotsTablePdf
            rows={rows}
            includeHero={includeHero}
            includeDescription={includeDescription}
            includeNotesAddendum={includeNotesAddendum}
          />
        )}
      </Page>
    </Document>
  )
}

function ShotsTablePdf({
  rows,
  includeHero,
  includeDescription,
  includeNotesAddendum,
}: {
  readonly rows: readonly ShotsPdfRow[]
  readonly includeHero: boolean
  readonly includeDescription: boolean
  readonly includeNotesAddendum: boolean
}) {
  // Flex weights tuned for scanability.
  const cols = [
    includeHero ? { key: "hero", flex: 0.6 } : null,
    { key: "shot", flex: 2.0 },
    { key: "date", flex: 0.7 },
    { key: "location", flex: 1.1 },
    { key: "talent", flex: 1.2 },
    { key: "products", flex: 1.8 },
    { key: "status", flex: 0.7 },
  ].filter(Boolean) as Array<{ readonly key: string; readonly flex: number }>

  const headerLabel = (key: string) => {
    switch (key) {
      case "hero":
        return ""
      case "shot":
        return "Shot"
      case "date":
        return "Date"
      case "location":
        return "Location"
      case "talent":
        return "Talent"
      case "products":
        return "Products"
      case "status":
        return "Status"
      default:
        return key
    }
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableHeader}>
        {cols.map((c) => (
          <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
            <Text style={[styles.sectionLabel, { marginTop: 0 }]}>{headerLabel(c.key)}</Text>
          </View>
        ))}
      </View>

      {rows.map((row) => (
        <View key={row.id} style={styles.row}>
          {cols.map((c) => {
            switch (c.key) {
              case "hero":
                return (
                  <View key={c.key} style={[styles.cell, styles.thumbCell, { flex: c.flex }]}>
                    {row.heroImageUrl ? <Image src={row.heroImageUrl} style={styles.thumb} /> : null}
                  </View>
                )
              case "shot":
                return (
                  <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
                    <Text style={styles.cellTitle}>
                      {row.title}
                      {row.shotNumber ? `  #${row.shotNumber}` : ""}
                    </Text>
                    {includeDescription && row.description ? (
                      <Text style={styles.cellSub}>{row.description}</Text>
                    ) : null}
                    {includeNotesAddendum && row.notesAddendum ? (
                      <View style={styles.cellLines}>
                        <Text style={styles.sectionLabel}>Addendum</Text>
                        <Text style={styles.line}>{row.notesAddendum}</Text>
                      </View>
                    ) : null}
                  </View>
                )
              case "date":
                return (
                  <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
                    <Text style={styles.line}>{row.dateLabel || "—"}</Text>
                  </View>
                )
              case "location":
                return (
                  <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
                    <Text style={styles.line}>{row.locationLabel || "—"}</Text>
                  </View>
                )
              case "talent":
                return (
                  <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
                    {row.talentLines.length === 0 ? (
                      <Text style={[styles.line, styles.cellMuted]}>—</Text>
                    ) : (
                      <View style={styles.cellLines}>
                        {row.talentLines.map((line) => (
                          <Text key={line} style={styles.line}>
                            {line}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )
              case "products":
                return (
                  <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
                    {row.productLines.length === 0 ? (
                      <Text style={[styles.line, styles.cellMuted]}>—</Text>
                    ) : (
                      <View style={styles.cellLines}>
                        {row.productLines.map((line, index) => (
                          <Text key={`${line}-${index}`} style={styles.line}>
                            {line}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )
              case "status":
                return (
                  <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
                    <Text style={styles.line}>{row.status || "—"}</Text>
                  </View>
                )
              default:
                return (
                  <View key={c.key} style={[styles.cell, { flex: c.flex }]}>
                    <Text style={styles.line}>—</Text>
                  </View>
                )
            }
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
  includeNotesAddendum,
}: {
  readonly row: ShotsPdfRow
  readonly includeHero: boolean
  readonly includeDescription: boolean
  readonly includeNotesAddendum: boolean
}) {
  return (
    <View style={styles.card} wrap={false}>
      <View style={styles.cardTop}>
        {includeHero && row.heroImageUrl ? (
          <Image src={row.heroImageUrl} style={styles.cardThumb} />
        ) : null}
        <View style={{ flex: 1 }}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>{row.title}</Text>
            {row.shotNumber ? <Text style={styles.cardPill}>#{row.shotNumber}</Text> : null}
            {row.status ? <Text style={styles.cardPill}>{row.status}</Text> : null}
          </View>
          <View style={styles.cardMetaRow}>
            <Text style={styles.cardMeta}>{row.dateLabel || "—"}</Text>
            <Text style={styles.cardMeta}>{row.locationLabel || "—"}</Text>
          </View>
          {includeDescription && row.description ? (
            <View style={styles.cardBody}>
              <Text style={styles.line}>{row.description}</Text>
            </View>
          ) : null}
          {includeNotesAddendum && row.notesAddendum ? (
            <View style={styles.cardBlock}>
              <Text style={styles.cardBlockTitle}>Addendum</Text>
              <Text style={styles.line}>{row.notesAddendum}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {row.talentLines.length > 0 ? (
        <View style={styles.cardBlock}>
          <Text style={styles.cardBlockTitle}>Talent</Text>
          {row.talentLines.map((line) => (
            <Text key={line} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {row.productLines.length > 0 ? (
        <View style={styles.cardBlock}>
          <Text style={styles.cardBlockTitle}>Products</Text>
          {row.productLines.map((line, index) => (
            <Text key={`${line}-${index}`} style={styles.line}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}
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
  const subtitle = projectName
  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <PdfHeader title={title} subtitle={subtitle} generatedAt={generatedAt} />
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed
        />

        <ShotCardPdf
          row={row}
          includeHero={includeHero}
          includeDescription={includeDescription}
          includeNotesAddendum={includeNotesAddendum}
        />
      </Page>
    </Document>
  )
}

