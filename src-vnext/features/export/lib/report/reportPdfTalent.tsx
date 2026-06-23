// @react-pdf landscape renderer for the Talent report (R4 PR2).
// Parity sibling of the DOM TalentReportView — both consume the same resolved
// TalentModel + image sidecar so screen and PDF can't drift. A card per talent
// (grouped none / gender / agency): a native-aspect headshot column + an info
// column (name, gender badge + agency, contact, fit measurements, an "in shots"
// list). Red (#EB1400) does exactly ONE job here: the HOLD flag (a talent with
// any on-hold shot — "confirm before locking the call").
//
// PDF typography differs from screen by design: @react-pdf ships only the
// Helvetica / Courier / Times built-ins, so the Ivy Presto serif maps to
// Helvetica (via reportPdfShared's FONT map). Pagination is explicit — three
// cards per landscape sheet, never spanning a group, each card wrap={false} so
// a card NEVER straddles or clips a page break.

import type { JSX } from "react"
import { Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer"
import type {
  TalentAppearance,
  TalentEntry,
  TalentGroup,
  TalentModel,
} from "./talentTypes"
import { initials } from "@/features/library/components/talentUtils"
import { COLOR, FONT, PAGE, STATUS, has } from "./reportPdfShared"

const PAD_X = 36
const PAD_TOP = 34
const PAD_BOTTOM = 30
const CARD_GAP = 22
const CARDS_PER_SHEET = 3
const CONTENT_WIDTH = PAGE.width - PAD_X * 2
const CARD_WIDTH = (CONTENT_WIDTH - CARD_GAP * (CARDS_PER_SHEET - 1)) / CARDS_PER_SHEET
// Headshot is width-only so its height follows the photo's native aspect; the
// cap bounds an unusually tall portrait so the card body always fits the sheet.
const HEADSHOT_MAX_HEIGHT = 168

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

  // Card row + card
  cards: { flexDirection: "row", gap: CARD_GAP },
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLOR.surface,
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    padding: 12,
  },

  // Headshot column
  headshot: { marginBottom: 10 },
  headshotFrame: {
    width: "100%",
    backgroundColor: COLOR.surfaceSubtle,
    borderWidth: 0.5,
    borderColor: COLOR.rule,
    overflow: "hidden",
  },
  headshotImage: { width: "100%", maxHeight: HEADSHOT_MAX_HEIGHT, objectFit: "contain" },
  initials: {
    width: "100%",
    height: 132,
    backgroundColor: COLOR.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: { fontFamily: FONT.display, fontSize: 30, color: COLOR.textSubtle },
  appearCount: {
    fontFamily: FONT.ui,
    fontSize: 6.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLOR.textSubtle,
    textAlign: "center",
    marginTop: 6,
  },

  // Info column
  nameRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 4 },
  name: { fontFamily: FONT.display, fontSize: 13, color: COLOR.text, lineHeight: 1.1, letterSpacing: -0.1 },

  // HOLD — the ONE red on this surface (a drawn red square + label, not a glyph)
  holdTag: { flexDirection: "row", alignItems: "center", marginLeft: 6 },
  holdMark: { width: 6, height: 6, backgroundColor: COLOR.accent, borderRadius: 1, marginRight: 3 },
  holdLabel: {
    fontFamily: FONT.uiBold,
    fontSize: 6.5,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: COLOR.accent,
  },

  badges: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 8 },
  genderBadge: {
    fontFamily: FONT.uiBold,
    fontSize: 6,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLOR.textSecondary,
    borderWidth: 0.5,
    borderColor: COLOR.ruleStrong,
    borderRadius: 2,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginRight: 6,
  },
  agency: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.textSecondary },

  contact: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.rule,
  },
  contactItem: { flexDirection: "row", alignItems: "baseline", marginRight: 12, marginBottom: 2 },
  contactKey: {
    fontFamily: FONT.uiBold,
    fontSize: 5.5,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLOR.textSubtle,
    marginRight: 3,
  },
  contactValue: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text },

  measures: { flexDirection: "row", flexWrap: "wrap", marginBottom: 10 },
  measure: { width: "33%", marginBottom: 6 },
  measureKey: {
    fontFamily: FONT.uiBold,
    fontSize: 5.5,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: COLOR.textSubtle,
    marginBottom: 1,
  },
  measureValue: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text },

  shotsKey: {
    fontFamily: FONT.uiBold,
    fontSize: 6,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: COLOR.textSubtle,
    marginBottom: 5,
  },
  shotsList: { flexDirection: "column" },
  shotLine: { flexDirection: "row", alignItems: "center", marginBottom: 3 },
  statusDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 4 },
  shotNum: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.text, minWidth: 16 },
  shotTitle: { fontFamily: FONT.ui, fontSize: 7.5, color: COLOR.textSecondary, marginLeft: 4, flexShrink: 1 },
  shotLooks: { fontFamily: FONT.ui, fontSize: 6.5, color: COLOR.textSubtle, marginLeft: 4 },
  shotsEmpty: { fontFamily: FONT.bodyItalic, fontSize: 7, color: COLOR.textSubtle },

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

// ---------------------------------------------------------------------------
// Pagination: up to CARDS_PER_SHEET printable cards per landscape sheet, never
// spanning a group (a new group starts a fresh sheet, mirroring the product-info
// + shot-report PagedView discipline so a card never straddles or clips a break).
// ---------------------------------------------------------------------------

interface Sheet {
  readonly group: TalentGroup
  readonly groupItemCount: number
  readonly fromIndex: number
  readonly items: readonly TalentEntry[]
}

function paginate(model: TalentModel): readonly Sheet[] {
  const sheets: Sheet[] = []
  for (const group of model.groups) {
    const visible = group.items.filter((i) => !i.excluded)
    if (visible.length === 0) continue
    for (let i = 0; i < visible.length; i += CARDS_PER_SHEET) {
      sheets.push({
        group,
        groupItemCount: visible.length,
        fromIndex: i + 1,
        items: visible.slice(i, i + CARDS_PER_SHEET),
      })
    }
  }
  return sheets
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function ShotLine({ a }: { readonly a: TalentAppearance }): JSX.Element {
  const st = STATUS[a.status] ?? STATUS.todo // defensive: tolerate an out-of-enum status
  return (
    <View style={s.shotLine}>
      <View style={[s.statusDot, { backgroundColor: st.color }]} />
      <Text style={s.shotNum}>{has(a.number) ? a.number : "—"}</Text>
      <Text style={s.shotTitle}>{a.title}</Text>
      {a.looks.length ? <Text style={s.shotLooks}>{a.looks.join(" · ")}</Text> : null}
    </View>
  )
}

function ContactItem({ k, value }: { readonly k: string; readonly value: string }): JSX.Element {
  return (
    <View style={s.contactItem}>
      <Text style={s.contactKey}>{k}</Text>
      <Text style={s.contactValue}>{value}</Text>
    </View>
  )
}

function Card({
  entry,
  imageMap,
}: {
  readonly entry: TalentEntry
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const src = has(entry.headshot) ? imageMap.get(entry.headshot) : undefined
  const n = entry.appears.length
  const hasContact = has(entry.email) || has(entry.phone) || has(entry.web)
  return (
    <View style={s.card} wrap={false}>
      <View style={s.headshot}>
        <View style={s.headshotFrame}>
          {src ? (
            <Image src={src} style={s.headshotImage} />
          ) : (
            <View style={s.initials}>
              <Text style={s.initialsText}>{initials(entry.name)}</Text>
            </View>
          )}
        </View>
        <Text style={s.appearCount}>{`${n} ${n === 1 ? "shot" : "shots"}`}</Text>
      </View>

      <View style={s.nameRow}>
        <Text style={s.name}>{has(entry.name) ? entry.name : "Unnamed talent"}</Text>
        {entry.onHold ? (
          <View style={s.holdTag}>
            <View style={s.holdMark} />
            <Text style={s.holdLabel}>Hold</Text>
          </View>
        ) : null}
      </View>

      {entry.genderLabel || has(entry.agency) ? (
        <View style={s.badges}>
          {entry.genderLabel ? <Text style={s.genderBadge}>{entry.genderLabel}</Text> : null}
          {has(entry.agency) ? <Text style={s.agency}>{entry.agency}</Text> : null}
        </View>
      ) : null}

      {hasContact ? (
        <View style={s.contact}>
          {has(entry.email) ? <ContactItem k="Email" value={entry.email} /> : null}
          {has(entry.phone) ? <ContactItem k="Phone" value={entry.phone} /> : null}
          {has(entry.web) ? <ContactItem k="Web" value={entry.web} /> : null}
        </View>
      ) : null}

      {entry.measurements.length > 0 ? (
        <View style={s.measures}>
          {entry.measurements.map((m, i) => (
            <View key={i} style={s.measure}>
              <Text style={s.measureKey}>{m.label}</Text>
              <Text style={s.measureValue}>{m.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={s.shotsKey}>In shots</Text>
      {n > 0 ? (
        <View style={s.shotsList}>
          {entry.appears.map((a, i) => (
            <ShotLine key={i} a={a} />
          ))}
        </View>
      ) : (
        <Text style={s.shotsEmpty}>Not yet slotted into a shot</Text>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export function TalentPdfDocument(props: {
  readonly model: TalentModel
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
      <Document title="Talent Report" author={model.project.client || ""} producer="Shot Builder">
        <Page size={{ width: PAGE.width, height: PAGE.height }} style={s.page}>
          <Text style={{ fontFamily: FONT.body, fontSize: 11, color: COLOR.textSecondary }}>
            No talent to report.
          </Text>
        </Page>
      </Document>
    )
  }

  return (
    <Document title="Talent Report" author={model.project.client || ""} producer="Shot Builder">
      {sheets.map((sheet, i) => {
        const firstOfGroup = sheet.fromIndex === 1
        return (
          <Page key={i} size={{ width: PAGE.width, height: PAGE.height }} style={s.page} wrap>
            {/* Running header — group label stays correct on any overflow page; the
                per-sheet count lives in the group band + footer, never a stale fixed range. */}
            <View style={s.header} fixed>
              <View>
                <Text style={s.headerTitle}>Talent</Text>
                <Text style={s.headerProject}>{projectLine}</Text>
              </View>
              <Text style={s.headerGroup}>{sheet.group.label}</Text>
            </View>

            {firstOfGroup ? (
              <View style={s.groupBand} minPresenceAhead={140}>
                <Text style={s.groupName}>{sheet.group.label}</Text>
                <Text style={s.groupCount}>
                  {sheet.groupItemCount === 1 ? "1 talent" : `${sheet.groupItemCount} talent`}
                </Text>
              </View>
            ) : null}

            <View style={s.cards}>
              {sheet.items.map((entry) => (
                <Card key={entry.id} entry={entry} imageMap={imageMap} />
              ))}
            </View>

            <View style={s.footer} fixed>
              <Text>Talent · {projectLine}</Text>
              <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
            </View>
          </Page>
        )
      })}
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Generate + download — mirrors generateProductInfoPdf (lazy import, toBlob, anchor).
// ---------------------------------------------------------------------------

export async function generateTalentPdf(
  model: TalentModel,
  imageMap: ReadonlyMap<string, string>,
  filename = "talent-report.pdf",
): Promise<void> {
  const { pdf } = await import("@react-pdf/renderer")
  const blob = await pdf(<TalentPdfDocument model={model} imageMap={imageMap} />).toBlob()

  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
