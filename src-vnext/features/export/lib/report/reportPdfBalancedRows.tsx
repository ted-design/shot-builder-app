// Balanced-rows PDF (comp-c) — one full-width band per shot: native-aspect hero
// on the LEFT, structured data panel on the RIGHT. Consumes the same ReportModel
// + image sidecar as the other layouts. Red's ONE job here: the hero-product
// marker (rail + "HERO" tag) inside each look.

import type { JSX } from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type { ReportGroup, ReportLook, ReportModel, ReportProduct, ReportShot } from "./reportTypes"
import { COLOR, FONT, PAGE, STATUS, has, primaryLookImage } from "./reportPdfShared"
import { sizeLabel } from "./reportModel"

const PAD_X = 34
const PAD_Y = 32
const IMG_COL = 210
const BAND_H = 150

const GENDER_LABEL: Record<ReportShot["gender"], string> = { W: "Women", M: "Men", Mixed: "Mixed", "?": "Unresolved" }

const s = StyleSheet.create({
  page: { paddingTop: PAD_Y, paddingBottom: 32, paddingHorizontal: PAD_X, fontFamily: FONT.body, fontSize: 8, color: COLOR.text, backgroundColor: COLOR.surface },

  // masthead (page 1)
  mast: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1.5, borderBottomColor: COLOR.ruleStrong, paddingBottom: 10, marginBottom: 6 },
  eyebrow: { fontFamily: FONT.uiBold, fontSize: 6.5, letterSpacing: 1, textTransform: "uppercase", color: COLOR.textSecondary },
  title: { fontFamily: FONT.display, fontSize: 22, color: COLOR.text, marginTop: 5 },
  proj: { fontFamily: FONT.ui, fontSize: 9, color: COLOR.textSecondary, marginTop: 6 },
  facts: { flexDirection: "row" },
  fact: { marginLeft: 22, alignItems: "flex-end" },
  factK: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.8, textTransform: "uppercase", color: COLOR.textSubtle, marginBottom: 2 },
  factV: { fontFamily: FONT.display, fontSize: 15, color: COLOR.text },
  factVSmall: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary },

  // group head
  groupHead: { flexDirection: "row", alignItems: "baseline", borderBottomWidth: 0.5, borderBottomColor: COLOR.rule, paddingTop: 12, paddingBottom: 6, marginBottom: 4 },
  groupTitle: { fontFamily: FONT.display, fontSize: 16, color: COLOR.text },
  groupCount: { fontFamily: FONT.uiBold, fontSize: 7, letterSpacing: 0.8, textTransform: "uppercase", color: COLOR.textSecondary, marginLeft: 12 },
  groupNote: { fontFamily: FONT.ui, fontSize: 6, letterSpacing: 0.6, textTransform: "uppercase", color: COLOR.textSubtle, marginLeft: "auto" },

  // band
  band: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.rule, paddingVertical: 10 },
  bandZebra: { backgroundColor: COLOR.surfaceSubtle },
  imgCol: { width: IMG_COL, height: BAND_H, alignItems: "center", justifyContent: "center", overflow: "hidden", marginRight: 18 },
  img: { maxWidth: IMG_COL, maxHeight: BAND_H, objectFit: "contain" },
  noImg: { width: IMG_COL, height: BAND_H, backgroundColor: COLOR.surfaceSubtle, borderWidth: 0.5, borderColor: COLOR.rule, alignItems: "center", justifyContent: "center" },
  noImgTxt: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSubtle, textTransform: "uppercase" },

  panel: { flex: 1 },
  panelHead: { flexDirection: "row", alignItems: "baseline", borderBottomWidth: 0.5, borderBottomColor: COLOR.rule, paddingBottom: 8 },
  shotNo: { fontFamily: FONT.uiBold, fontSize: 8, color: COLOR.textSubtle, marginRight: 10 },
  headMain: { flex: 1 },
  shotTitle: { fontFamily: FONT.display, fontSize: 13, color: COLOR.text },
  sub: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 5 },
  colorway: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text, fontWeight: "bold", marginRight: 8 },
  genderChip: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.4, textTransform: "uppercase", color: COLOR.textSecondary, borderWidth: 0.5, borderColor: COLOR.ruleStrong, borderRadius: 1, paddingHorizontal: 3, marginRight: 8 },
  unresolved: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.4, textTransform: "uppercase", color: COLOR.accentInk, borderWidth: 0.5, borderColor: COLOR.accentInk, borderRadius: 1, paddingHorizontal: 3, marginRight: 8 },
  talent: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary },
  status: { flexDirection: "row", alignItems: "center", marginLeft: 10 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
  statusTxt: { fontFamily: FONT.uiBold, fontSize: 6, letterSpacing: 0.5, textTransform: "uppercase", color: COLOR.textSecondary },
  note: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary, marginTop: 7, lineHeight: 1.4 },
  noteK: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.6, textTransform: "uppercase", color: COLOR.textSubtle },

  looks: { marginTop: 8 },
  look: { marginTop: 8 },
  lookAlt: { marginLeft: 12, paddingLeft: 10, borderLeftWidth: 1, borderLeftColor: COLOR.ruleStrong },
  lookLabel: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  lookLabelTxt: { fontFamily: FONT.uiBold, fontSize: 6.5, letterSpacing: 0.8, textTransform: "uppercase", color: COLOR.textSecondary },
  lkTag: { fontFamily: FONT.ui, fontSize: 5.5, color: COLOR.textSubtle, borderWidth: 0.5, borderColor: COLOR.rule, borderRadius: 1, paddingHorizontal: 3, marginLeft: 6 },

  ph: { fontFamily: FONT.uiBold, fontSize: 5, letterSpacing: 0.6, textTransform: "uppercase", color: COLOR.textSubtle },
  prodHead: { flexDirection: "row", paddingBottom: 3, borderBottomWidth: 0.5, borderBottomColor: COLOR.rule, marginBottom: 1 },
  prod: { flexDirection: "row", alignItems: "baseline", paddingVertical: 3.5, borderBottomWidth: 0.5, borderBottomColor: COLOR.rule },
  cMark: { width: 8 },
  heroRail: { width: 3, height: 11, backgroundColor: COLOR.accent, borderRadius: 0.5 },
  cFam: { flex: 1.9, paddingRight: 6 },
  cStyle: { flex: 0.9, paddingRight: 6 },
  cColour: { flex: 0.7, paddingRight: 6 },
  cSize: { width: 52, paddingRight: 6 },
  cQty: { width: 30, textAlign: "right" },
  fam: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text },
  heroTag: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.8, color: COLOR.accent },
  style: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary },
  colour: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary },
  size: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.text },
  qty: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary, textAlign: "right" },
  muted: { fontFamily: FONT.bodyItalic, color: COLOR.textSubtle },

  footer: { position: "absolute", bottom: 16, left: PAD_X, right: PAD_X, flexDirection: "row", justifyContent: "space-between", fontFamily: FONT.ui, fontSize: 6, color: COLOR.textDisabled, textTransform: "uppercase", letterSpacing: 0.5, borderTopWidth: 0.5, borderTopColor: COLOR.rule, paddingTop: 4 },
})

function ProductRow({ p }: { readonly p: ReportProduct }): JSX.Element {
  const { text: sizeText, pending: sizePending } = sizeLabel(p.sizeScope, p.size)
  return (
    <View style={s.prod} wrap={false}>
      <View style={s.cMark}>{p.isHero ? <View style={s.heroRail} /> : null}</View>
      <View style={s.cFam}>
        <Text>
          <Text style={s.fam}>{has(p.family) ? p.family : "Unnamed product"}</Text>
          {p.isHero ? <Text style={s.heroTag}>{"  HERO"}</Text> : null}
        </Text>
      </View>
      <Text style={[s.style, s.cStyle, ...(has(p.style) ? [] : [s.muted])]}>{has(p.style) ? p.style : "—"}</Text>
      <Text style={[s.colour, s.cColour, ...(has(p.colour) ? [] : [s.muted])]}>{has(p.colour) ? p.colour : "—"}</Text>
      <Text style={[s.size, s.cSize, ...(sizePending ? [s.muted] : [])]}>{sizeText}</Text>
      <Text style={[s.qty, s.cQty]}>{p.qty != null ? `×${p.qty}` : "—"}</Text>
    </View>
  )
}

function LookBlock({ look }: { readonly look: ReportLook }): JSX.Element {
  const n = look.products.length
  return (
    <View style={[s.look, ...(look.isAlt ? [s.lookAlt] : [])]}>
      <View style={s.lookLabel}>
        <Text style={s.lookLabelTxt}>{look.label}</Text>
        <Text style={s.lkTag}>{n === 1 ? "1 piece" : `${n} pieces`}</Text>
      </View>
      <View style={s.prodHead}>
        <View style={s.cMark} />
        <Text style={[s.ph, s.cFam]}>Product family</Text>
        <Text style={[s.ph, s.cStyle]}>Style #</Text>
        <Text style={[s.ph, s.cColour]}>Colour</Text>
        <Text style={[s.ph, s.cSize]}>Size</Text>
        <Text style={[s.ph, s.cQty]}>Qty</Text>
      </View>
      {look.products.map((p, i) => (
        <ProductRow key={`${look.id}-p-${i}`} p={p} />
      ))}
    </View>
  )
}

function Band({ shot, imageMap, zebra }: { readonly shot: ReportShot; readonly imageMap: ReadonlyMap<string, string>; readonly zebra: boolean }): JSX.Element {
  const cand = primaryLookImage(shot)
  const src = has(cand) ? imageMap.get(cand) : undefined
  const st = STATUS[shot.status]
  const talent = shot.talent.map((t) => t.name).filter((n) => has(n))
  return (
    <View style={[s.band, ...(zebra ? [s.bandZebra] : [])]} wrap={false}>
      <View style={s.imgCol}>
        {src ? <Image src={src} style={s.img} /> : <View style={s.noImg}><Text style={s.noImgTxt}>No image yet</Text></View>}
      </View>
      <View style={s.panel}>
        <View style={s.panelHead}>
          <Text style={s.shotNo}>{shot.number}</Text>
          <View style={s.headMain}>
            <Text style={s.shotTitle}>{shot.title}</Text>
            <View style={s.sub}>
              {has(shot.colorway) ? <Text style={s.colorway}>{shot.colorway}</Text> : null}
              {shot.gender === "?" ? (
                <Text style={s.unresolved}>Gender ?</Text>
              ) : (
                <Text style={s.genderChip}>{GENDER_LABEL[shot.gender]}</Text>
              )}
              <Text style={s.talent}>{talent.length ? `Talent ${talent.join(" · ")}` : "Talent TBD"}</Text>
            </View>
          </View>
          <View style={s.status}>
            <View style={[s.statusDot, { backgroundColor: st.color }]} />
            <Text style={s.statusTxt}>{st.label}</Text>
          </View>
        </View>
        {has(shot.notes) ? (
          <Text style={s.note}>
            <Text style={s.noteK}>{"Note  "}</Text>
            {shot.notes}
          </Text>
        ) : null}
        <View style={s.looks}>
          {shot.looks.map((lk) => (
            <LookBlock key={lk.id} look={lk} />
          ))}
        </View>
      </View>
    </View>
  )
}

function GroupHead({ group }: { readonly group: ReportGroup }): JSX.Element {
  return (
    <View style={s.groupHead} wrap={false} minPresenceAhead={60}>
      <Text style={s.groupTitle}>{group.label}</Text>
      <Text style={s.groupCount}>{group.count === 1 ? "1 shot" : `${group.count} shots`}</Text>
      <Text style={s.groupNote}>Grouped · sorted by shot no.</Text>
    </View>
  )
}

export function BalancedRowsPdfDocument(props: {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const { model, imageMap } = props
  // Count only printable shots — excluded are omitted from the rendered bands.
  const all = model.groups.flatMap((g) => g.shots).filter((x) => !x.excluded)
  const withImg = all.filter((x) => x.hasImage).length
  const total = all.length
  const projLine = has(model.project.client) ? `${model.project.name} · ${model.project.client}` : model.project.name
  let z = 0

  return (
    <Document title="Comprehensive Shot Report" author={model.project.client || ""} producer="Shot Builder">
      <Page size={{ width: PAGE.width, height: PAGE.height }} style={s.page} wrap>
        <View style={s.mast}>
          <View>
            <Text style={s.eyebrow}>Production · Comprehensive shot report</Text>
            <Text style={s.title}>Comprehensive Shot Report</Text>
            <Text style={s.proj}>{projLine}</Text>
          </View>
          <View style={s.facts}>
            <View style={s.fact}>
              <Text style={s.factK}>Shots</Text>
              <Text style={s.factV}>{total}</Text>
            </View>
            <View style={s.fact}>
              <Text style={s.factK}>Captured</Text>
              <Text style={s.factV}>
                {withImg}
                <Text style={s.factVSmall}> / {total} shot</Text>
              </Text>
            </View>
            {model.project.dateRange ? (
              <View style={s.fact}>
                <Text style={s.factK}>Window</Text>
                <Text style={[s.factV, { fontSize: 11 }]}>{model.project.dateRange}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {model.groups.map((group) => {
          const printable = group.shots.filter((sh) => !sh.excluded)
          if (printable.length === 0) return null
          return (
            <View key={group.key}>
              <GroupHead group={{ ...group, count: printable.length }} />
              {printable.map((shot) => {
                const zebra = z % 2 === 1
                z += 1
                return <Band key={shot.id} shot={shot} imageMap={imageMap} zebra={zebra} />
              })}
            </View>
          )
        })}

        <View style={s.footer} fixed>
          <Text>Comprehensive Shot Report · {projLine}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
