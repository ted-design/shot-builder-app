// Production-sheet PDF (comp-b) — dense landscape spec sheet. Consumes the same
// ReportModel + image sidecar as the other layouts. Red's ONE job here: the
// on-hold flag (left bar + "HOLD"); the hero product carries a neutral triangle.

import type { JSX } from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type { ReportGroup, ReportLook, ReportModel, ReportProduct, ReportShot } from "./reportTypes"
import { COLOR, FONT, PAGE, STATUS, has, primaryLookImage } from "./reportPdfShared"

const PAD_X = 30
const PAD_Y = 30

const s = StyleSheet.create({
  page: { paddingTop: PAD_Y, paddingBottom: 30, paddingHorizontal: PAD_X, fontFamily: FONT.body, fontSize: 8, color: COLOR.text, backgroundColor: COLOR.surface },

  // masthead (page 1)
  head: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", borderBottomWidth: 1.5, borderBottomColor: COLOR.text, paddingBottom: 8, marginBottom: 4 },
  eyebrow: { fontFamily: FONT.uiBold, fontSize: 6.5, letterSpacing: 1, textTransform: "uppercase", color: COLOR.textSecondary },
  title: { fontFamily: FONT.display, fontSize: 20, color: COLOR.text, marginTop: 4 },
  sub: { fontFamily: FONT.ui, fontSize: 9, color: COLOR.textSecondary, marginTop: 3 },
  metaRow: { flexDirection: "row" },
  metaCell: { paddingHorizontal: 10, borderLeftWidth: 0.5, borderLeftColor: COLOR.rule, alignItems: "flex-end" },
  metaNum: { fontFamily: FONT.display, fontSize: 15, color: COLOR.text },
  metaLabel: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.8, textTransform: "uppercase", color: COLOR.textSubtle, marginTop: 1 },

  legend: { flexDirection: "row", flexWrap: "wrap", marginTop: 6, marginBottom: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  legendTxt: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSecondary },
  flagChip: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.6, textTransform: "uppercase", color: COLOR.accent, borderWidth: 0.5, borderColor: COLOR.accent, borderRadius: 1, paddingHorizontal: 2, marginRight: 4 },

  // group band (dark)
  groupBand: { flexDirection: "row", alignItems: "center", backgroundColor: COLOR.text, paddingVertical: 4, paddingHorizontal: 8, marginTop: 10 },
  groupName: { fontFamily: FONT.uiBold, fontSize: 7.5, letterSpacing: 1.6, textTransform: "uppercase", color: COLOR.surface },
  groupCount: { fontFamily: FONT.ui, fontSize: 6.5, letterSpacing: 0.8, textTransform: "uppercase", color: "#C9C9C9", marginLeft: "auto" },
  // column ruler
  ruler: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.ruleStrong, backgroundColor: COLOR.surfaceSubtle, paddingVertical: 3 },
  rulerSpine: { width: 26 },
  rulerThumb: { width: 92, paddingLeft: 6, fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.8, textTransform: "uppercase", color: COLOR.textSubtle },
  rulerProd: { flex: 1, flexDirection: "row", paddingLeft: 8 },

  // shot row
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.rule },
  rowFlag: { borderLeftWidth: 3, borderLeftColor: COLOR.accent },
  spine: { width: 26, borderRightWidth: 0.5, borderRightColor: COLOR.rule, alignItems: "center", paddingVertical: 8 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginBottom: 4 },
  holdTxt: { fontFamily: FONT.uiBold, fontSize: 5, letterSpacing: 0.5, textTransform: "uppercase", color: COLOR.accent },

  thumbCol: { width: 92, borderRightWidth: 0.5, borderRightColor: COLOR.rule, padding: 6 },
  thumbBox: { width: 80, height: 96, backgroundColor: COLOR.surfaceSubtle, borderWidth: 0.5, borderColor: COLOR.rule, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { maxWidth: 80, maxHeight: 96, objectFit: "contain" },
  thumbNoImg: { fontFamily: FONT.ui, fontSize: 5.5, color: COLOR.textSubtle, textTransform: "uppercase" },
  talent: { fontFamily: FONT.ui, fontSize: 5.5, color: COLOR.textSubtle, marginTop: 4 },
  talentLabel: { fontFamily: FONT.uiBold, fontSize: 5, letterSpacing: 0.6, textTransform: "uppercase", color: COLOR.textDisabled },

  body: { flex: 1, paddingHorizontal: 8, paddingVertical: 7 },
  ident: { flexDirection: "row", alignItems: "baseline", marginBottom: 2 },
  num: { fontFamily: FONT.uiBold, fontSize: 8, color: COLOR.textSecondary, marginRight: 6 },
  name: { fontFamily: FONT.display, fontSize: 11, color: COLOR.text, marginRight: 6 },
  colorway: { fontFamily: FONT.ui, fontSize: 7, color: COLOR.textSecondary },
  statusInline: { flexDirection: "row", alignItems: "center", marginLeft: "auto" },
  statusInlineTxt: { fontFamily: FONT.uiBold, fontSize: 6, letterSpacing: 0.5, textTransform: "uppercase", color: COLOR.textSubtle, marginLeft: 4 },
  unresolved: { fontFamily: FONT.uiBold, fontSize: 5.5, letterSpacing: 0.4, textTransform: "uppercase", color: COLOR.accentInk, borderWidth: 0.5, borderColor: COLOR.accentInk, borderRadius: 1, paddingHorizontal: 2, marginLeft: 5 },
  note: { fontFamily: FONT.bodyItalic, fontSize: 6.5, color: COLOR.textSecondary, marginTop: 3, paddingLeft: 6, borderLeftWidth: 1, borderLeftColor: COLOR.ruleStrong, lineHeight: 1.4 },

  look: { marginTop: 6, borderWidth: 0.5, borderColor: COLOR.rule },
  lookAlt: { marginLeft: 14, borderStyle: "dashed", backgroundColor: COLOR.surfaceSubtle },
  lookHead: { flexDirection: "row", alignItems: "center", backgroundColor: COLOR.surfaceSubtle, borderBottomWidth: 0.5, borderBottomColor: COLOR.rule, paddingVertical: 2.5, paddingHorizontal: 7 },
  lookTag: { fontFamily: FONT.uiBold, fontSize: 6, letterSpacing: 0.8, textTransform: "uppercase", color: COLOR.text },
  lookCount: { fontFamily: FONT.ui, fontSize: 5.5, letterSpacing: 0.5, textTransform: "uppercase", color: COLOR.textDisabled, marginLeft: "auto" },

  // product row
  ph: { fontFamily: FONT.uiBold, fontSize: 5, letterSpacing: 0.6, textTransform: "uppercase", color: COLOR.textSubtle },
  prod: { flexDirection: "row", alignItems: "baseline", paddingVertical: 3, paddingHorizontal: 7, borderBottomWidth: 0.5, borderBottomColor: COLOR.rule },
  prodHero: { backgroundColor: "#FBFAF7" },
  cHero: { width: 12, alignItems: "center", justifyContent: "center" },
  // neutral hero mark — a drawn dot (the ▲ glyph is absent from built-in Helvetica)
  heroDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLOR.text },
  cFam: { flex: 1.7, paddingRight: 6 },
  cStyle: { width: 64, paddingRight: 6 },
  cColour: { flex: 1, paddingRight: 6 },
  cSize: { width: 40, textAlign: "right", paddingRight: 4 },
  cQty: { width: 24, textAlign: "right" },
  fam: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text, lineHeight: 1.2 },
  famHero: { fontFamily: FONT.uiBold },
  style: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSecondary },
  colour: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.text },
  size: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.text },
  qty: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSecondary },
  muted: { fontFamily: FONT.bodyItalic, color: COLOR.textSubtle },

  footer: { position: "absolute", bottom: 14, left: PAD_X, right: PAD_X, flexDirection: "row", justifyContent: "space-between", fontFamily: FONT.ui, fontSize: 6, color: COLOR.textDisabled, textTransform: "uppercase", letterSpacing: 0.5, borderTopWidth: 0.5, borderTopColor: COLOR.rule, paddingTop: 4 },
})

function ProductRow({ p }: { readonly p: ReportProduct }): JSX.Element {
  const sizePending = p.sizeScope === "pending" || !has(p.size)
  return (
    <View style={[s.prod, ...(p.isHero ? [s.prodHero] : [])]} wrap={false}>
      <View style={s.cHero}>{p.isHero ? <View style={s.heroDot} /> : null}</View>
      <Text style={[s.fam, s.cFam, ...(p.isHero ? [s.famHero] : [])]}>{has(p.family) ? p.family : "Unnamed product"}</Text>
      <Text style={[s.style, s.cStyle, ...(has(p.style) ? [] : [s.muted])]}>{has(p.style) ? p.style : "no style #"}</Text>
      <Text style={[s.colour, s.cColour, ...(has(p.colour) ? [] : [s.muted])]}>{has(p.colour) ? p.colour : "Unspecified"}</Text>
      <Text style={[s.size, s.cSize, ...(sizePending ? [s.muted] : [])]}>{sizePending ? "Pending" : p.size}</Text>
      <Text style={[s.qty, s.cQty]}>{p.qty != null ? `×${p.qty}` : "—"}</Text>
    </View>
  )
}

function LookBlock({ look }: { readonly look: ReportLook }): JSX.Element {
  const n = look.products.length
  return (
    <View style={[s.look, ...(look.isAlt ? [s.lookAlt] : [])]} wrap={false}>
      <View style={s.lookHead}>
        <Text style={s.lookTag}>{look.label.toUpperCase()}</Text>
        <Text style={s.lookCount}>{n === 1 ? "1 piece" : `${n} pieces`}</Text>
      </View>
      {look.products.map((p, i) => (
        <ProductRow key={`${look.id}-p-${i}`} p={p} />
      ))}
    </View>
  )
}

function Row({ shot, imageMap }: { readonly shot: ReportShot; readonly imageMap: ReadonlyMap<string, string> }): JSX.Element {
  const flagged = shot.status === "on_hold"
  const st = STATUS[shot.status]
  const cand = primaryLookImage(shot)
  const src = has(cand) ? imageMap.get(cand) : undefined
  const talent = shot.talent.filter((t) => has(t.name))
  return (
    <View style={[s.row, ...(flagged ? [s.rowFlag] : [])]} wrap={false}>
      <View style={s.spine}>
        <View style={[s.statusDot, { backgroundColor: st.color }]} />
        {flagged ? <Text style={s.holdTxt}>HOLD</Text> : null}
      </View>
      <View style={s.thumbCol}>
        <View style={s.thumbBox}>
          {src ? <Image src={src} style={s.thumbImg} /> : <Text style={s.thumbNoImg}>No ref</Text>}
        </View>
        <Text style={s.talent}>
          <Text style={s.talentLabel}>Talent </Text>
          {talent.length ? talent.map((t) => t.name).join(", ") : "Unassigned"}
        </Text>
      </View>
      <View style={s.body}>
        <View style={s.ident}>
          <Text style={s.num}>{shot.number}</Text>
          <Text style={s.name}>{shot.title}</Text>
          {has(shot.colorway) ? <Text style={s.colorway}>{shot.colorway}</Text> : null}
          <View style={s.statusInline}>
            <View style={[s.statusDot, { backgroundColor: st.color, marginBottom: 0 }]} />
            <Text style={s.statusInlineTxt}>{st.label}</Text>
            {shot.gender === "?" ? <Text style={s.unresolved}>Gender ?</Text> : null}
          </View>
        </View>
        {has(shot.notes) ? <Text style={s.note}>{shot.notes}</Text> : null}
        {shot.looks.map((lk) => (
          <LookBlock key={lk.id} look={lk} />
        ))}
      </View>
    </View>
  )
}

function GroupBand({ group }: { readonly group: ReportGroup }): JSX.Element {
  return (
    // minPresenceAhead pushes the band to the next page rather than stranding it
    // above a page break, away from its first row.
    <View wrap={false} minPresenceAhead={100}>
      <View style={s.groupBand}>
        <Text style={s.groupName}>{group.label}</Text>
        <Text style={s.groupCount}>{group.count === 1 ? "1 shot" : `${group.count} shots`}</Text>
      </View>
      <View style={s.ruler}>
        <View style={s.rulerSpine} />
        <Text style={s.rulerThumb}>Shot / Reference</Text>
        <View style={s.rulerProd}>
          <View style={s.cHero} />
          <Text style={[s.ph, s.cFam]}>Product family</Text>
          <Text style={[s.ph, s.cStyle]}>Style #</Text>
          <Text style={[s.ph, s.cColour]}>Colour</Text>
          <Text style={[s.ph, s.cSize]}>Size</Text>
          <Text style={[s.ph, s.cQty]}>Qty</Text>
        </View>
      </View>
    </View>
  )
}

export function ProductionSheetPdfDocument(props: {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const { model, imageMap } = props
  // Count only printable shots — the rows omit excluded, so the masthead must too.
  const all = model.groups.flatMap((g) => g.shots).filter((x) => !x.excluded)
  const women = all.filter((x) => x.gender === "W").length
  const men = all.filter((x) => x.gender === "M").length
  const holds = all.filter((x) => x.status === "on_hold").length
  const projLine = has(model.project.client) ? `${model.project.name} · ${model.project.client}` : model.project.name

  const cell = (num: string | number, label: string) => (
    <View style={s.metaCell} key={label}>
      <Text style={s.metaNum}>{num}</Text>
      <Text style={s.metaLabel}>{label}</Text>
    </View>
  )

  return (
    <Document title="Comprehensive Shot Report" author={model.project.client || ""} producer="Shot Builder">
      <Page size={{ width: PAGE.width, height: PAGE.height }} style={s.page} wrap>
        {/* masthead (page 1 only — flows once at start) */}
        <View style={s.head}>
          <View>
            <Text style={s.eyebrow}>Production Pull Sheet · For Crew &amp; Warehouse</Text>
            <Text style={s.title}>Comprehensive Shot Report</Text>
            <Text style={s.sub}>{projLine}</Text>
          </View>
          <View style={s.metaRow}>
            {cell(all.length, "Shots")}
            {women > 0 ? cell(women, "Women") : null}
            {men > 0 ? cell(men, "Men") : null}
            {holds > 0 ? cell(holds, "On Hold") : null}
            {model.project.dateRange ? cell(model.project.dateRange, "Window") : null}
          </View>
        </View>
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.heroDot, { marginRight: 5 }]} />
            <Text style={s.legendTxt}>Hero product</Text>
          </View>
          <View style={s.legendItem}>
            <Text style={s.flagChip}>Hold</Text>
            <Text style={s.legendTxt}>Flagged — not cleared to shoot</Text>
          </View>
        </View>

        {model.groups.map((group) => {
          const printable = group.shots.filter((sh) => !sh.excluded)
          if (printable.length === 0) return null
          return (
            <View key={group.key}>
              <GroupBand group={{ ...group, count: printable.length }} />
              {printable.map((shot) => (
                <Row key={shot.id} shot={shot} imageMap={imageMap} />
              ))}
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
