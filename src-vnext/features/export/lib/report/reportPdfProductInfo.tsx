// @react-pdf landscape renderer for the Product Info report (R4 PR1).
// Parity sibling of the DOM ProductInfoReportView — both consume the same
// resolved ProductInfoModel + image sidecar so screen and PDF can't drift. A
// card per in-use product family, grouped (gender / product-type / none),
// native-aspect product image, identity + colours + sizes + an "appears in"
// shot list. Red (#EB1400) does exactly ONE job here: the hero product mark.
//
// PDF typography differs from screen by design: @react-pdf ships only the
// Helvetica / Courier / Times built-ins, so the Ivy Presto serif maps to
// Helvetica (via reportPdfShared's FONT map). Pagination is explicit — the
// gallery packs 2 large cards (2×1, a showcase spread) per landscape sheet, never
// spanning a group, each card wrap={false} so a card NEVER straddles or clips a
// page break. (2-up, issue #505 2026-08-05: the prior 4×3=12 stranded partial
// pages on real product data — 2 rows never fit; see IMAGE_MAX_HEIGHT below.)

import type { JSX } from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type {
  ProductInfoAppearance,
  ProductInfoEntry,
  ProductInfoGroup,
  ProductInfoLayout,
  ProductInfoModel,
} from "./productInfoTypes"
import { PRODUCT_INFO_LAYOUT_GEOMETRY } from "./productInfoTypes"
import { COLOR, FONT, PAGE, STATUS, has } from "./reportPdfShared"

const PAD_X = 36
const PAD_TOP = 34
const PAD_BOTTOM = 30
const COL_GAP = 22
const ROW_GAP = 18
// Gallery packing derives from the SHARED geometry so screen + PDF can't drift.
const PRINT_COLS = PRODUCT_INFO_LAYOUT_GEOMETRY.gallery.printCols
const CONTENT_WIDTH = PAGE.width - PAD_X * 2
// Card width derives from the COLUMN count (not cards-per-sheet): a 2-up card is
// (content - 1 col gap) / 2. Matches the on-screen PagedView's --sb-pir-print-cols grid.
const CARD_WIDTH = (CONTENT_WIDTH - COL_GAP * (PRINT_COLS - 1)) / PRINT_COLS
// Image is width-only so its height follows the photo's native aspect; the cap
// bounds an unusually tall portrait so the card body always fits the sheet.
// 2-up SHOWCASE (issue #505, real-render calibrated 2026-08-05): only ONE card row
// fits a landscape sheet, so with 2 big cards the cap can be large — a real render
// holds 2 cards on one page up to ~340 (360 overflows); 330 fills the page with a
// stress-case (5 colours / 6 sizes / 3 appearances) margin. EYEBALL-GATE this number.
const IMAGE_MAX_HEIGHT = 330

// INDEX density (R4): compact 2-up spec-sheet rows, ~20 per landscape sheet. A
// small fixed thumb + name + one meta line + shot count. RED-FREE (ink hero mark).
// EYEBALL-GATE the row height: 10 rows × 2 cols must fit the usable landscape body.
const IDX_COLS = PRODUCT_INFO_LAYOUT_GEOMETRY.index.printCols
const IDX_CARD_WIDTH = (CONTENT_WIDTH - COL_GAP * (IDX_COLS - 1)) / IDX_COLS
const IDX_THUMB_W = 26
const IDX_THUMB_H = 33

const s = StyleSheet.create({
  page: {
    paddingTop: PAD_TOP,
    paddingBottom: PAD_BOTTOM,
    paddingHorizontal: PAD_X,
    fontFamily: FONT.body,
    fontSize: 8,
    color: COLOR.text,
    backgroundColor: COLOR.surface,
  },

  // Running header
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingBottom: 8,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.ruleStrong,
  },
  headerTitle: { fontFamily: FONT.display, fontSize: 13, color: COLOR.text, letterSpacing: -0.1 },
  headerProject: { fontFamily: FONT.ui, fontSize: 8, color: COLOR.textSubtle, marginTop: 2 },
  headerGroup: {
    fontFamily: FONT.uiBold,
    fontSize: 8,
    color: COLOR.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
    textAlign: "right",
  },

  // Group band — starts each group's first sheet
  groupBand: {
    flexDirection: "row",
    alignItems: "baseline",
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.rule,
    paddingBottom: 6,
    marginBottom: 12,
  },
  groupName: { fontFamily: FONT.display, fontSize: 15, color: COLOR.text },
  groupCount: {
    fontFamily: FONT.uiBold,
    fontSize: 6.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: COLOR.textSecondary,
    marginLeft: 10,
  },

  // Card grid + card
  cards: { flexDirection: "row", flexWrap: "wrap", columnGap: COL_GAP, rowGap: ROW_GAP },
  card: { width: CARD_WIDTH },
  frame: {
    width: CARD_WIDTH,
    backgroundColor: COLOR.surface,
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    overflow: "hidden",
  },
  image: { width: CARD_WIDTH, maxHeight: IMAGE_MAX_HEIGHT, objectFit: "contain" },
  noImage: {
    width: CARD_WIDTH,
    // Match the image cap so a missing-image card is no taller than an imaged one
    // (else the 2-up showcase row could overflow on incomplete libraries).
    height: IMAGE_MAX_HEIGHT,
    backgroundColor: COLOR.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  noImageText: {
    fontFamily: FONT.ui,
    fontSize: 6.5,
    color: COLOR.textSubtle,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },

  body: { paddingTop: 10 },
  name: { fontFamily: FONT.display, fontSize: 13, color: COLOR.text, lineHeight: 1.12, letterSpacing: -0.1 },
  ident: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 4 },
  identText: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.textSecondary },
  identSep: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.textDisabled, marginHorizontal: 4 },

  // HERO — the ONE red on this surface (a drawn red dot + label, not a glyph)
  heroTag: { flexDirection: "row", alignItems: "center", marginLeft: 4 },
  heroMark: { width: 6, height: 6, backgroundColor: COLOR.accent, borderRadius: 3, marginRight: 3 },
  heroLabel: {
    fontFamily: FONT.uiBold,
    fontSize: 6.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: COLOR.accent,
  },

  row: { flexDirection: "row", alignItems: "baseline", marginTop: 8 },
  rowKey: {
    fontFamily: FONT.uiBold,
    fontSize: 6,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLOR.textSubtle,
    width: 42,
    paddingTop: 1,
  },
  rowValue: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    fontFamily: FONT.ui,
    fontSize: 6.5,
    color: COLOR.textSecondary,
    borderWidth: 0.5,
    borderColor: COLOR.ruleStrong,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginRight: 4,
    marginBottom: 4,
  },
  sizes: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text },
  pending: { fontFamily: FONT.bodyItalic, fontSize: 7.5, color: COLOR.textSubtle },

  appears: { marginTop: 10, paddingTop: 8, borderTopWidth: 0.5, borderTopColor: COLOR.rule },
  appearsKey: {
    fontFamily: FONT.uiBold,
    fontSize: 6,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLOR.textSubtle,
    marginBottom: 5,
  },
  appearsList: { flexDirection: "row", flexWrap: "wrap" },
  appearItem: { flexDirection: "row", alignItems: "center", marginRight: 10, marginBottom: 4 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
  appearNum: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text },
  appearLook: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSubtle, marginLeft: 3 },
  appearEmpty: { fontFamily: FONT.bodyItalic, fontSize: 7, color: COLOR.textSubtle },

  footer: {
    position: "absolute",
    bottom: 14,
    left: PAD_X,
    right: PAD_X,
    flexDirection: "row",
    justifyContent: "space-between",
    fontFamily: FONT.ui,
    fontSize: 6,
    color: COLOR.textDisabled,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.rule,
    paddingTop: 4,
  },
})

// INDEX layout styles — compact rows, RED-FREE (locked design system: RED owns
// HOLD; Product Info index paints no red). Hero mark = canonical INK dot +
// uppercase INK tag (weight, not colour) — NOT the gallery's red hero mark
// (frozen by byte-identity) and NOT the comp's boxed tag (carried critic fix).
const si = StyleSheet.create({
  cards: { flexDirection: "row", flexWrap: "wrap", columnGap: COL_GAP, rowGap: 4 },
  row: {
    width: IDX_CARD_WIDTH,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.rule,
  },
  thumb: {
    width: IDX_THUMB_W,
    height: IDX_THUMB_H,
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    backgroundColor: COLOR.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginRight: 8,
  },
  thumbImage: { width: IDX_THUMB_W, height: IDX_THUMB_H, objectFit: "contain" },
  thumbNo: { fontFamily: FONT.ui, fontSize: 6, color: COLOR.textDisabled },
  main: { flex: 1 },
  nameLine: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  name: { fontFamily: FONT.display, fontSize: 9, color: COLOR.text, letterSpacing: -0.1 },
  meta: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary, marginTop: 1.5 },

  // canonical INK hero mark (dot + uppercase tag by weight)
  heroMark: { flexDirection: "row", alignItems: "center", marginLeft: 5 },
  heroDot: { width: 5, height: 5, backgroundColor: COLOR.text, borderRadius: 2.5, marginRight: 3 },
  heroLabel: {
    fontFamily: FONT.uiBold,
    fontSize: 6,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: COLOR.text,
  },

  shots: { flexDirection: "row", alignItems: "center", marginLeft: 8 },
  shotsNum: { fontFamily: FONT.uiBold, fontSize: 7.5, color: COLOR.text, marginRight: 4 },
  shotsDots: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 4.5, height: 4.5, borderRadius: 2.25, marginRight: 2.5 },
})

// ---------------------------------------------------------------------------
// Pagination: up to CARDS_PER_SHEET printable cards per landscape sheet, never
// spanning a group (a new group starts a fresh sheet, mirroring the shot-report
// PagedView discipline so a card never straddles or clips a page break).
// ---------------------------------------------------------------------------

interface Sheet {
  readonly group: ProductInfoGroup
  readonly groupItemCount: number
  readonly fromIndex: number
  readonly items: readonly ProductInfoEntry[]
}

function paginate(model: ProductInfoModel): readonly Sheet[] {
  // Layout-aware from the SHARED geometry so the on-screen paged preview and this
  // PDF pack identically (parity is falsifiable — see productInfoLayouts.parity).
  const perSheet = PRODUCT_INFO_LAYOUT_GEOMETRY[model.layout].cardsPerSheet
  const sheets: Sheet[] = []
  for (const group of model.groups) {
    const visible = group.items.filter((i) => !i.excluded)
    if (visible.length === 0) continue
    for (let i = 0; i < visible.length; i += perSheet) {
      sheets.push({
        group,
        groupItemCount: visible.length,
        fromIndex: i + 1,
        items: visible.slice(i, i + perSheet),
      })
    }
  }
  return sheets
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function AppearRow({ a }: { readonly a: ProductInfoAppearance }): JSX.Element {
  const st = STATUS[a.status]
  return (
    <View style={s.appearItem}>
      <View style={[s.statusDot, { backgroundColor: st.color }]} />
      <Text style={s.appearNum}>{has(a.number) ? a.number : "—"}</Text>
      {a.looks.length ? <Text style={s.appearLook}>{a.looks.join(", ")}</Text> : null}
    </View>
  )
}

function Card({
  entry,
  imageMap,
}: {
  readonly entry: ProductInfoEntry
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const src = has(entry.image) ? imageMap.get(entry.image) : undefined
  const n = entry.appears.length
  return (
    <View style={s.card} wrap={false}>
      <View style={s.frame}>
        {src ? (
          <Image src={src} style={s.image} />
        ) : (
          <View style={s.noImage}>
            <Text style={s.noImageText}>No product image</Text>
          </View>
        )}
      </View>

      <View style={s.body}>
        <Text style={s.name}>{has(entry.styleName) ? entry.styleName : "Unnamed product"}</Text>

        <View style={s.ident}>
          {has(entry.styleNumber) ? <Text style={s.identText}>{entry.styleNumber}</Text> : null}
          {has(entry.styleNumber) && entry.genderLabel ? <Text style={s.identSep}>·</Text> : null}
          {entry.genderLabel ? <Text style={s.identText}>{entry.genderLabel}</Text> : null}
          {entry.isHero ? (
            <View style={s.heroTag}>
              <View style={s.heroMark} />
              <Text style={s.heroLabel}>Hero</Text>
            </View>
          ) : null}
        </View>

        <View style={s.row}>
          <Text style={s.rowKey}>Colours</Text>
          <View style={s.rowValue}>
            {entry.colours.length > 0 ? (
              <View style={s.chips}>
                {entry.colours.map((c, i) => (
                  <Text key={i} style={s.chip}>
                    {c}
                  </Text>
                ))}
              </View>
            ) : (
              <Text style={s.pending}>TBD</Text>
            )}
          </View>
        </View>

        <View style={s.row}>
          <Text style={s.rowKey}>Sizes</Text>
          <View style={s.rowValue}>
            {entry.sizes.length > 0 ? (
              <Text style={s.sizes}>{entry.sizes.join(" · ")}</Text>
            ) : entry.sizePending ? (
              <Text style={s.pending}>Size pending</Text>
            ) : (
              <Text style={s.pending}>—</Text>
            )}
          </View>
        </View>

        <View style={s.appears}>
          <Text style={s.appearsKey}>{`Appears in ${n} ${n === 1 ? "shot" : "shots"}`}</Text>
          {n > 0 ? (
            <View style={s.appearsList}>
              {entry.appears.map((a, i) => (
                <AppearRow key={i} a={a} />
              ))}
            </View>
          ) : (
            <Text style={s.appearEmpty}>Not yet styled into a shot</Text>
          )}
        </View>
      </View>
    </View>
  )
}

// INDEX card — one compact spec-sheet row (thumb · name+meta · shots). Mirrors
// the DOM ProductIndexRow: no per-shot "Appears in" block, RED-FREE ink hero mark.
function IndexCard({
  entry,
  imageMap,
}: {
  readonly entry: ProductInfoEntry
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const src = has(entry.image) ? imageMap.get(entry.image) : undefined
  const n = entry.appears.length
  const styleNo = has(entry.styleNumber) ? entry.styleNumber : null
  const coloursStr = entry.colours.length > 0 ? entry.colours.join(", ") : "TBD"
  const sizesStr =
    entry.sizes.length > 0 ? entry.sizes.join(" · ") : entry.sizePending ? "Size pending" : "—"
  const meta = [styleNo, coloursStr, sizesStr].filter((x): x is string => x != null).join("   ·   ")
  const dots = entry.appears.slice(0, 6)

  return (
    <View style={si.row} wrap={false}>
      <View style={si.thumb}>
        {src ? <Image src={src} style={si.thumbImage} /> : <Text style={si.thumbNo}>—</Text>}
      </View>

      <View style={si.main}>
        <View style={si.nameLine}>
          <Text style={si.name}>{has(entry.styleName) ? entry.styleName : "Unnamed product"}</Text>
          {entry.isHero ? (
            <View style={si.heroMark}>
              <View style={si.heroDot} />
              <Text style={si.heroLabel}>Hero</Text>
            </View>
          ) : null}
        </View>
        <Text style={si.meta}>{meta}</Text>
      </View>

      <View style={si.shots}>
        <Text style={si.shotsNum}>{String(n)}</Text>
        <View style={si.shotsDots}>
          {dots.map((a, i) => (
            <View key={i} style={[si.statusDot, { backgroundColor: STATUS[a.status].color }]} />
          ))}
        </View>
      </View>
    </View>
  )
}

// Pick the per-family renderer for a layout (gallery card vs. compact index row).
function FamilyItem({
  entry,
  imageMap,
  layout,
}: {
  readonly entry: ProductInfoEntry
  readonly imageMap: ReadonlyMap<string, string>
  readonly layout: ProductInfoLayout
}): JSX.Element {
  return layout === "index" ? (
    <IndexCard entry={entry} imageMap={imageMap} />
  ) : (
    <Card entry={entry} imageMap={imageMap} />
  )
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function ProductInfoPdfDocument(props: {
  readonly model: ProductInfoModel
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const { model, imageMap } = props
  const sheets = paginate(model)
  const projectLine = has(model.project.client)
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name

  // Guarantee at least one page so a direct call with an all-excluded model can't
  // hand @react-pdf a zero-page Document (which throws). The UI also disables Export.
  if (sheets.length === 0) {
    return (
      <Document title="Product Info Report" author={model.project.client || ""} producer="Shot Builder">
        <Page size={{ width: PAGE.width, height: PAGE.height }} style={s.page}>
          <Text style={{ fontFamily: FONT.body, fontSize: 11, color: COLOR.textSecondary }}>
            No products to report.
          </Text>
        </Page>
      </Document>
    )
  }

  return (
    <Document title="Product Info Report" author={model.project.client || ""} producer="Shot Builder">
      {sheets.map((sheet, i) => {
        const firstOfGroup = sheet.fromIndex === 1
        return (
          <Page key={i} size={{ width: PAGE.width, height: PAGE.height }} style={s.page} wrap>
            {/* Running header — group label stays correct on any overflow page; the
                per-sheet count lives in the group band + footer, never a stale fixed range. */}
            <View style={s.header} fixed>
              <View>
                <Text style={s.headerTitle}>Product Info</Text>
                <Text style={s.headerProject}>{projectLine}</Text>
              </View>
              <Text style={s.headerGroup}>{sheet.group.label}</Text>
            </View>

            {firstOfGroup ? (
              <View style={s.groupBand} minPresenceAhead={140}>
                <Text style={s.groupName}>{sheet.group.label}</Text>
                <Text style={s.groupCount}>
                  {sheet.groupItemCount === 1 ? "1 product" : `${sheet.groupItemCount} products`}
                </Text>
              </View>
            ) : null}

            <View style={model.layout === "index" ? si.cards : s.cards}>
              {sheet.items.map((entry) => (
                <FamilyItem key={entry.id} entry={entry} imageMap={imageMap} layout={model.layout} />
              ))}
            </View>

            <View style={s.footer} fixed>
              <Text>Product Info · {projectLine}</Text>
              <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
            </View>
          </Page>
        )
      })}
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Generate + download — mirrors generateShotReportPdf (lazy import, toBlob, anchor).
// ---------------------------------------------------------------------------

export async function generateProductInfoPdf(
  model: ProductInfoModel,
  imageMap: ReadonlyMap<string, string>,
  filename = "product-info-report.pdf",
): Promise<void> {
  const { pdf } = await import("@react-pdf/renderer")
  const blob = await pdf(<ProductInfoPdfDocument model={model} imageMap={imageMap} />).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
