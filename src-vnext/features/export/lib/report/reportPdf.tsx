// @react-pdf landscape renderer for the Comprehensive Shot Report.
// Parity sibling of the DOM ReportView — both consume the same resolved
// ReportModel + image sidecar so screen and PDF can't drift. Image-led per the
// approved north star (Direction A "image-led editorial"): landscape Letter
// sheets, two large native-aspect hero plates side by side, structured product
// captions, gender group headers, "Awaiting capture" frame for no-image shots.
//
// PDF typography differs from screen by design: @react-pdf only ships the
// Helvetica / Courier / Times built-ins, so the editorial Ivy Presto serif from
// the DOM renderer maps to Helvetica here (via the codebase font mapping). Red
// (#EB1400) does exactly one job on this surface: the shot number.

import type { JSX } from "react"
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer"
import type {
  ReportLayout,
  ReportModel,
  ReportGroup,
  ReportShot,
  ReportLook,
  ReportProduct,
} from "./reportTypes"
import { COLOR, FONT, PAGE, STATUS_LEGACY, has } from "./reportPdfShared"
import { ProductionSheetPdfDocument } from "./reportPdfProductionSheet"
import { BalancedRowsPdfDocument } from "./reportPdfBalancedRows"

// ---------------------------------------------------------------------------
// Image-led layout — tokens shared via reportPdfShared. Red's one job: shot number.
// ---------------------------------------------------------------------------

const PAD_X = 40
const PAD_TOP = 36
const PAD_BOTTOM = 34
const COLUMN_GAP = 36
// Two plates fill the content width; each plate's image is width-only so its
// height is the photo's native aspect (never cropped/squashed).
const CONTENT_WIDTH = PAGE.width - PAD_X * 2
const PLATE_WIDTH = (CONTENT_WIDTH - COLUMN_GAP) / 2
// Cap the hero so the caption always fits the sheet — width still drives aspect
// up to the cap; only an unusually tall portrait is bounded by maxHeight.
const HERO_MAX_HEIGHT = 300

const styles = StyleSheet.create({
  page: {
    paddingTop: PAD_TOP,
    paddingBottom: PAD_BOTTOM,
    paddingHorizontal: PAD_X,
    fontFamily: FONT.body,
    fontSize: 9,
    color: COLOR.text,
    backgroundColor: COLOR.surface,
  },

  // Running header
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.ruleStrong,
  },
  headerTitle: {
    fontFamily: FONT.display,
    fontSize: 13,
    color: COLOR.text,
    letterSpacing: -0.1,
  },
  headerProject: {
    fontFamily: FONT.ui,
    fontSize: 8,
    color: COLOR.textSubtle,
    marginTop: 2,
  },
  headerGroup: {
    fontFamily: FONT.uiBold,
    fontSize: 8,
    color: COLOR.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "right",
  },

  // Footer (page number)
  footer: {
    position: "absolute",
    bottom: 16,
    left: PAD_X,
    right: PAD_X,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: FONT.ui,
    fontSize: 7,
    color: COLOR.textDisabled,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.rule,
    paddingTop: 6,
  },

  // Body: two plate columns
  body: {
    flexDirection: "row",
    gap: COLUMN_GAP,
  },
  plate: {
    width: PLATE_WIDTH,
  },

  // Figure (image + overprinted red number)
  figure: {
    position: "relative",
    borderTopWidth: 1,
    borderTopColor: COLOR.ruleStrong,
    paddingTop: 12,
  },
  heroImage: {
    // WIDTH ONLY drives the native aspect; maxHeight only bounds tall portraits.
    width: PLATE_WIDTH,
    maxHeight: HERO_MAX_HEIGHT,
    objectFit: "contain",
  },
  plateNumber: {
    position: "absolute",
    top: 18,
    left: 8,
    fontFamily: FONT.display,
    fontSize: 22,
    color: COLOR.accent, // << red's one job
    letterSpacing: -0.5,
  },

  // No-image frame
  noImage: {
    width: PLATE_WIDTH,
    height: 230,
    backgroundColor: COLOR.surfaceSubtle,
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  noImageNumber: {
    fontFamily: FONT.display,
    fontSize: 24,
    color: COLOR.accent, // still red, the one job
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  noImageLabel: {
    fontFamily: FONT.ui,
    fontSize: 9,
    color: COLOR.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  noImageSub: {
    fontFamily: FONT.bodyItalic,
    fontSize: 7.5,
    color: COLOR.textSubtle,
    marginTop: 4,
    textAlign: "center",
  },

  // Caption
  caption: {
    paddingTop: 12,
  },
  shotTitle: {
    fontFamily: FONT.display,
    fontSize: 14,
    color: COLOR.text,
    letterSpacing: -0.2,
    lineHeight: 1.1,
  },
  colorway: {
    fontFamily: FONT.bodyItalic,
    fontSize: 9,
    color: COLOR.textSecondary,
    marginTop: 2,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: 8,
    paddingTop: 7,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.rule,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 14,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginRight: 5,
  },
  statusLabel: {
    fontFamily: FONT.uiBold,
    fontSize: 7,
    color: COLOR.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  talentText: {
    fontFamily: FONT.ui,
    fontSize: 7.5,
    color: COLOR.textSecondary,
  },
  talentEmpty: {
    fontFamily: FONT.bodyItalic,
    fontSize: 7.5,
    color: COLOR.textSubtle,
  },
  note: {
    fontFamily: FONT.bodyItalic,
    fontSize: 7.5,
    lineHeight: 1.4,
    color: COLOR.textSecondary,
    marginTop: 8,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: COLOR.ruleStrong,
  },

  // Looks
  looks: {
    marginTop: 12,
  },
  look: {
    marginTop: 10,
  },
  lookAlt: {
    marginTop: 10,
    backgroundColor: COLOR.surfaceSubtle,
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    padding: 8,
  },
  lookHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  lookLabel: {
    fontFamily: FONT.uiBold,
    fontSize: 7,
    color: COLOR.text,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  lookLabelAlt: {
    color: COLOR.textSecondary,
  },
  lookRule: {
    flex: 1,
    height: 0.5,
    backgroundColor: COLOR.rule,
    marginLeft: 8,
  },
  altThumb: {
    width: 90,
    maxHeight: 110,
    objectFit: "contain",
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    marginBottom: 8,
  },
  altNoImage: {
    width: 90,
    height: 110,
    backgroundColor: COLOR.surface,
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  altNoImageText: {
    fontFamily: FONT.bodyItalic,
    fontSize: 6.5,
    color: COLOR.textSubtle,
    textAlign: "center",
  },

  // Product grid
  prodColHead: {
    flexDirection: "row",
    paddingBottom: 5,
    marginBottom: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.rule,
  },
  prodRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 5,
  },
  // column widths inside a plate
  colHero: { width: 8 },
  colFamily: { flex: 1.55, paddingRight: 8 },
  colColour: { flex: 1, paddingRight: 8 },
  colStyle: { width: 60, paddingRight: 8 },
  colSize: { width: 42, textAlign: "right", paddingRight: 6 },
  colQty: { width: 26, textAlign: "right" },

  chText: {
    fontFamily: FONT.uiBold,
    fontSize: 6,
    color: COLOR.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLOR.text,
    marginTop: 3,
  },
  prodFamily: {
    fontFamily: FONT.ui,
    fontSize: 8,
    color: COLOR.text,
    lineHeight: 1.2,
  },
  prodFamilyHero: {
    fontFamily: FONT.uiBold,
  },
  prodStyle: {
    fontFamily: FONT.ui,
    fontSize: 7,
    color: COLOR.textSubtle,
  },
  prodColour: {
    fontFamily: FONT.ui,
    fontSize: 7.5,
    color: COLOR.textSecondary,
    lineHeight: 1.2,
  },
  prodColourMuted: {
    fontFamily: FONT.bodyItalic,
    color: COLOR.textSubtle,
  },
  prodSize: {
    fontFamily: FONT.ui,
    fontSize: 7.5,
    color: COLOR.textSecondary,
  },
  prodSizePending: {
    fontFamily: FONT.bodyItalic,
    color: COLOR.textSubtle,
  },
  prodQty: {
    fontFamily: FONT.ui,
    fontSize: 7.5,
    color: COLOR.textSubtle,
  },
})

// ---------------------------------------------------------------------------
// Pagination: two non-excluded plates per landscape sheet, never spanning a
// gender group (a new group starts a fresh sheet, mirroring the north star).
// ---------------------------------------------------------------------------

interface Sheet {
  readonly group: ReportGroup
  readonly groupShotCount: number
  /** 1-based index of the first shot on this sheet within its group. */
  readonly fromIndex: number
  readonly shots: readonly ReportShot[]
}

function paginate(model: ReportModel): readonly Sheet[] {
  const sheets: Sheet[] = []
  for (const group of model.groups) {
    const visible = group.shots.filter((s) => !s.excluded)
    if (visible.length === 0) continue
    for (let i = 0; i < visible.length; i += 2) {
      sheets.push({
        group,
        groupShotCount: visible.length,
        fromIndex: i + 1,
        shots: visible.slice(i, i + 2),
      })
    }
  }
  return sheets
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function ProductRow({ p }: { readonly p: ReportProduct }) {
  const sizePending = p.sizeScope === "pending" || !has(p.size)
  const sizeText = sizePending ? "Pending" : (p.size as string)
  return (
    <View style={styles.prodRow} wrap={false}>
      <View style={styles.colHero}>{p.isHero ? <View style={styles.heroDot} /> : null}</View>
      <View style={styles.colFamily}>
        <Text>
          <Text style={[styles.prodFamily, ...(p.isHero ? [styles.prodFamilyHero] : [])]}>
            {has(p.family) ? p.family : "Unnamed product"}
          </Text>
          {p.isHero ? <Text style={styles.prodStyle}>{"  Hero"}</Text> : null}
        </Text>
      </View>
      <Text style={styles.colColour}>
        {has(p.colour) ? (
          <Text style={styles.prodColour}>{p.colour}</Text>
        ) : (
          <Text style={[styles.prodColour, styles.prodColourMuted]}>Colour TBD</Text>
        )}
      </Text>
      <Text style={[styles.prodStyle, styles.colStyle]}>{has(p.style) ? p.style : "—"}</Text>
      <Text style={[styles.prodSize, styles.colSize, ...(sizePending ? [styles.prodSizePending] : [])]}>
        {sizeText}
      </Text>
      <Text style={[styles.prodQty, styles.colQty]}>{p.qty != null ? `×${p.qty}` : "×—"}</Text>
    </View>
  )
}

function ProductColHead() {
  return (
    <View style={styles.prodColHead}>
      <View style={styles.colHero} />
      <Text style={[styles.chText, styles.colFamily]}>Family</Text>
      <Text style={[styles.chText, styles.colColour]}>Colour</Text>
      <Text style={[styles.chText, styles.colStyle]}>Style</Text>
      <Text style={[styles.chText, styles.colSize]}>Size</Text>
      <Text style={[styles.chText, styles.colQty]}>Qty</Text>
    </View>
  )
}

function LookBlock({
  look,
  imageMap,
}: {
  readonly look: ReportLook
  readonly imageMap: ReadonlyMap<string, string>
}) {
  const altSrc = look.isAlt && look.image ? imageMap.get(look.image) : undefined
  return (
    <View style={look.isAlt ? styles.lookAlt : styles.look} wrap={false}>
      <View style={styles.lookHead}>
        <Text style={[styles.lookLabel, ...(look.isAlt ? [styles.lookLabelAlt] : [])]}>
          {has(look.label) ? look.label : look.isAlt ? "Alt" : "Primary"}
        </Text>
        <View style={styles.lookRule} />
      </View>

      {look.isAlt ? (
        altSrc ? (
          <Image src={altSrc} style={styles.altThumb} />
        ) : (
          <View style={styles.altNoImage}>
            <Text style={styles.altNoImageText}>Alt — no reference</Text>
          </View>
        )
      ) : null}

      <ProductColHead />
      {look.products.map((p, i) => (
        <ProductRow key={i} p={p} />
      ))}
    </View>
  )
}

function Plate({
  shot,
  imageMap,
}: {
  readonly shot: ReportShot
  readonly imageMap: ReadonlyMap<string, string>
}) {
  const primary = shot.looks[0]
  const heroCandidate = primary?.image ?? null
  const heroSrc = has(heroCandidate) ? imageMap.get(heroCandidate) : undefined
  const status = STATUS_LEGACY[shot.status]
  const talent = shot.talent.filter((t) => has(t.name))

  // Width + keep-together are owned by the column wrapper in the Page; this is
  // just the plate's vertical content stack.
  return (
    <View>
      {/* Figure */}
      {heroSrc ? (
        <View style={styles.figure}>
          <Image src={heroSrc} style={styles.heroImage} />
          <Text style={styles.plateNumber}>{shot.number}</Text>
        </View>
      ) : (
        <View style={styles.figure}>
          <View style={styles.noImage}>
            <Text style={styles.noImageNumber}>{shot.number}</Text>
            <Text style={styles.noImageLabel}>Awaiting capture</Text>
            <Text style={styles.noImageSub}>reference photo not yet shot</Text>
          </View>
        </View>
      )}

      {/* Caption */}
      <View style={styles.caption}>
        <Text style={styles.shotTitle}>{shot.title}</Text>
        {has(shot.colorway) ? <Text style={styles.colorway}>{shot.colorway}</Text> : null}

        <View style={styles.subRow}>
          <View style={styles.statusChip}>
            <View style={[styles.statusDot, { backgroundColor: status.color }]} />
            <Text style={styles.statusLabel}>{status.label}</Text>
          </View>
          {talent.length > 0 ? (
            <Text style={styles.talentText}>{talent.map((t) => t.name).join(" · ")}</Text>
          ) : (
            <Text style={styles.talentEmpty}>Talent TBD</Text>
          )}
        </View>

        {has(shot.notes) ? <Text style={styles.note}>{shot.notes}</Text> : null}

        <View style={styles.looks}>
          {shot.looks.map((look) => (
            <LookBlock key={look.id} look={look} imageMap={imageMap} />
          ))}
        </View>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function ShotReportPdfDocument(props: {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const { model, imageMap } = props
  const sheets = paginate(model)
  const projectLine = has(model.project.client)
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name

  return (
    <Document
      title="Comprehensive Shot Report"
      author={model.project.client || ""}
      producer="Shot Builder"
    >
      {sheets.map((sheet, i) => {
        const toIndex = sheet.fromIndex + sheet.shots.length - 1
        return (
          <Page key={i} size={{ width: PAGE.width, height: PAGE.height }} style={styles.page} wrap>
            {/* Running header */}
            <View style={styles.header} fixed>
              <View>
                <Text style={styles.headerTitle}>Comprehensive Shot Report</Text>
                <Text style={styles.headerProject}>{projectLine}</Text>
              </View>
              <Text style={styles.headerGroup}>
                {`${sheet.group.label} · ${sheet.fromIndex}–${toIndex} of ${sheet.groupShotCount}`}
              </Text>
            </View>

            {/* Two plates, each in its own column — wrap=false keeps a plate intact */}
            <View style={styles.body}>
              {sheet.shots.map((shot) => (
                <View key={shot.id} style={styles.plate} wrap={false}>
                  <Plate shot={shot} imageMap={imageMap} />
                </View>
              ))}
            </View>

            {/* Footer with page number */}
            <View style={styles.footer} fixed>
              <Text>{projectLine}</Text>
              <Text
                render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
              />
            </View>
          </Page>
        )
      })}
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Layout dispatch — one resolved model, the chosen recipe's Document.
// ---------------------------------------------------------------------------

function reportPdfDocument(
  model: ReportModel,
  imageMap: ReadonlyMap<string, string>,
  layout: ReportLayout,
): JSX.Element {
  if (layout === "production-sheet") return <ProductionSheetPdfDocument model={model} imageMap={imageMap} />
  if (layout === "balanced-rows") return <BalancedRowsPdfDocument model={model} imageMap={imageMap} />
  return <ShotReportPdfDocument model={model} imageMap={imageMap} />
}

// ---------------------------------------------------------------------------
// Generate + download — mirrors generateExportPdf (lazy import, toBlob, anchor).
// ---------------------------------------------------------------------------

export async function generateShotReportPdf(
  model: ReportModel,
  imageMap: ReadonlyMap<string, string>,
  filename = "comprehensive-shot-report.pdf",
  layout: ReportLayout = "image-led",
): Promise<void> {
  const { pdf } = await import("@react-pdf/renderer")
  const element = reportPdfDocument(model, imageMap, layout)
  const blob = await pdf(element).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
