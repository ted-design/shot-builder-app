// Balanced-rows layout (comp-c) — one shot per full-width horizontal band:
// native-aspect hero letterboxed on the LEFT, structured data panel on the
// RIGHT, subtle zebra rhythm. Consumes the SAME resolved ReportModel + image
// sidecar as the other two layouts (no second model). Red does exactly ONE job
// here: the HERO-PRODUCT MARKER (rail + "HERO" tag) inside each look.

import { useMemo } from "react"
import type { JSX } from "react"
import type {
  GenderKey,
  ReportGroup,
  ReportLook,
  ReportModel,
  ReportProduct,
  ReportShot,
} from "../../lib/report/reportTypes"
import { formatOrderNote } from "../../lib/report/reportTypes"
import {
  present,
  primaryLookImage,
  resolveAdditionalImageSrcs,
  resolveSrc,
  statusMeta,
} from "./reportShared"
import { sizeLabel } from "../../lib/report/reportModel"
import { TagChipView } from "./primitives/TagChip"

interface BodyProps {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (shotId: string) => void
  /** WS-C additional-images toggle. Absent/false renders byte-identical to
   *  pre-WS-C output — AdditionalImagesRow is never invoked. */
  readonly showAdditionalImages?: boolean
  /** Tag-chip toggle (2026-08-17). Absent/false renders byte-identical to
   *  pre-tag-chips output — TagChipRow is never invoked. */
  readonly showTags?: boolean
}

const GENDER_LABEL: Record<GenderKey, string> = { W: "Women", M: "Men", Mixed: "Mixed", "?": "Unresolved" }

// product row: hero-rail(RED) · family(+HERO tag) · style# · colour · size · qty
function ProductRow({ p }: { readonly p: ReportProduct }): JSX.Element {
  const { text: sizeText, pending: sizePending } = sizeLabel(p.sizeScope, p.size)
  return (
    <div className={"sb-br-prow" + (p.isHero ? " sb-br-prow--hero" : "")}>
      <div className="sb-br-pr-mark" aria-hidden="true" />
      <div className="sb-br-pr-fam">
        {present(p.family) ? p.family : "Unnamed product"}
        {p.isHero ? <span className="sb-br-hero-tag"> HERO</span> : null}
      </div>
      <div className={"sb-br-pr-style sb-tabular" + (present(p.style) ? "" : " sb-muted")}>
        {present(p.style) ? p.style : "—"}
      </div>
      <div className={"sb-br-pr-colour" + (present(p.colour) ? "" : " sb-muted")}>
        {present(p.colour) ? p.colour : "—"}
      </div>
      <div className={"sb-br-pr-size sb-tabular" + (sizePending ? " sb-pending" : "")}>
        {sizeText}
      </div>
      <div className={"sb-br-pr-qty sb-tabular" + (p.qty != null ? "" : " sb-muted")}>
        {p.qty != null ? `×${p.qty}` : "—"}
      </div>
    </div>
  )
}

function LookBlock({ look }: { readonly look: ReportLook }): JSX.Element {
  const n = look.products.length
  return (
    <div className={"sb-br-look" + (look.isAlt ? " sb-br-look--alt" : "")}>
      <div className="sb-br-look-label">
        {look.label}
        <span className="sb-br-lk-tag">{n === 1 ? "1 piece" : `${n} pieces`}</span>
      </div>
      <div className="sb-br-prows">
        <div className="sb-br-prow--head">
          <span />
          <span>Product family</span>
          <span>Style #</span>
          <span>Colour</span>
          <span>Size</span>
          <span>Qty</span>
        </div>
        {look.products.map((p, i) => (
          <ProductRow key={`${look.id}-p-${i}`} p={p} />
        ))}
      </div>
    </div>
  )
}

/** Additional-images row (WS-C): renders nothing when there's nothing extra
 *  to show — the toggle is off, the shot has no additionalImages, or every
 *  candidate failed to resolve. */
function AdditionalImagesRow({
  shot,
  imageMap,
}: {
  readonly shot: ReportShot
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element | null {
  const srcs = resolveAdditionalImageSrcs(imageMap, shot.additionalImages)
  if (srcs.length === 0) return null
  return (
    <div className="sb-br-extra">
      <span className="sb-br-extra-label">Additional references</span>
      <div className="sb-br-extra-row">
        {srcs.map((src, i) => (
          <div className="sb-br-extra-thumb" key={`${shot.id}-extra-${i}`}>
            <img
              className="sb-img-native"
              src={src}
              alt={`${shot.title} — additional reference ${i + 1}`}
              loading="lazy"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Tag-chip row (2026-08-17): renders nothing when the shot has no chips, so a
 *  tagless shot's markup is byte-identical toggle on or off. The model already
 *  de-duped, dropped gender, and ordered them (resolveReportTagChips) — this is
 *  presentation only. */
function TagChipRow({ shot }: { readonly shot: ReportShot }): JSX.Element | null {
  const tags = shot.tags ?? []
  if (tags.length === 0) return null
  return (
    <div className="sb-tag-row" role="group" aria-label="Tags">
      {tags.map((t) => (
        <TagChipView key={t.id} label={t.label} />
      ))}
    </div>
  )
}

function Band({
  shot,
  imageMap,
  zebra,
  onToggleExclude,
  showAdditionalImages,
  showTags,
}: {
  readonly shot: ReportShot
  readonly imageMap: ReadonlyMap<string, string>
  readonly zebra: boolean
  readonly onToggleExclude: (shotId: string) => void
  readonly showAdditionalImages: boolean
  readonly showTags: boolean
}): JSX.Element {
  const imgSrc = resolveSrc(imageMap, primaryLookImage(shot))
  const st = statusMeta(shot.status)
  const talent = shot.talent.map((t) => t.name).filter((n) => present(n))
  return (
    <div className={"sb-br-band" + (zebra ? " sb-br-zebra" : "") + (shot.excluded ? " sb-excluded" : "")}>
      <div className="sb-br-img">
        {imgSrc ? (
          <img className="sb-img-native sb-br-img-native" src={imgSrc} alt={`${shot.title} — ${shot.colorway ?? ""}`} loading="lazy" />
        ) : (
          <div className="sb-no-image sb-br-noimg">No image yet</div>
        )}
      </div>

      <div className="sb-br-panel">
        <button
          type="button"
          className="sb-exclude-toggle no-print"
          aria-pressed={shot.excluded}
          onClick={() => onToggleExclude(shot.id)}
          title={shot.excluded ? "Restore this shot to the report" : "Exclude this shot from the report"}
        >
          {shot.excluded ? "Restore shot" : "Exclude shot"}
        </button>
        <div className="sb-br-panel-head">
          <div className="sb-br-shot-no sb-tabular">{shot.number}</div>
          <div className="sb-br-head-main">
            <h3 className="sb-shot-name sb-br-title">{shot.title}</h3>
            <div className="sb-br-sub">
              {present(shot.colorway) ? (
                <>
                  <span className="sb-br-colorway">{shot.colorway}</span>
                  <span className="sb-br-subdot" />
                </>
              ) : null}
              {shot.gender === "?" ? (
                <span className="sb-badge-unresolved">Gender ?</span>
              ) : (
                <span className="sb-br-gender-chip">{GENDER_LABEL[shot.gender]}</span>
              )}
              <span className="sb-br-subdot" />
              {talent.length ? (
                <span className="sb-br-talent">
                  Talent <span className="sb-br-tname">{talent.join(" · ")}</span>
                </span>
              ) : (
                <span className="sb-br-talent">Talent TBD</span>
              )}
            </div>
          </div>
          <div className="sb-br-status">
            <span className={"sb-status-dot " + st.dotClass} />
            {st.label}
          </div>
        </div>

        {showTags ? <TagChipRow shot={shot} /> : null}

        {present(shot.notes) ? (
          <p className="sb-br-note">
            <span className="sb-br-note-k">Note</span>
            {shot.notes}
          </p>
        ) : null}

        <div className="sb-br-looks">
          {shot.looks.map((lk) => (
            <LookBlock key={lk.id} look={lk} />
          ))}
        </div>
        {showAdditionalImages ? <AdditionalImagesRow shot={shot} imageMap={imageMap} /> : null}
      </div>
    </div>
  )
}

function GroupHead({ group, note }: { readonly group: ReportGroup; readonly note: string }): JSX.Element {
  return (
    <div className="sb-br-group-head">
      <h2 className="sb-masthead sb-br-group-title">{group.label}</h2>
      <span className="sb-br-group-count">{group.count === 1 ? "1 shot" : `${group.count} shots`}</span>
      <span className="sb-br-group-note">{note}</span>
    </div>
  )
}

function Masthead({ model }: { readonly model: ReportModel }): JSX.Element {
  // Printable count (excluded shots are struck on screen + omitted from the PDF).
  const all = useMemo(
    () => model.groups.flatMap((g) => g.shots).filter((s) => !s.excluded),
    [model.groups],
  )
  const withImg = all.filter((s) => s.hasImage).length
  const total = all.length
  return (
    <header className="sb-br-masthead">
      <div className="sb-br-lede">
        <p className="sb-eyebrow">Production · Comprehensive shot report</p>
        <h1 className="sb-masthead sb-br-mast-title">Comprehensive Shot Report</h1>
        <p className="sb-br-proj">
          <strong>{model.project.name}</strong>
          {model.project.client ? `  ·  ${model.project.client}` : ""}
        </p>
      </div>
      <div className="sb-br-facts">
        <div className="sb-br-fact">
          <div className="sb-br-fact-k">Shots</div>
          <div className="sb-br-fact-v sb-tabular">{total}</div>
        </div>
        <div className="sb-br-fact">
          <div className="sb-br-fact-k">Captured</div>
          <div className="sb-br-fact-v sb-tabular">
            {withImg}
            <small> / {total} shot</small>
          </div>
        </div>
        {model.project.dateRange ? (
          <div className="sb-br-fact">
            <div className="sb-br-fact-k">Window</div>
            <div className="sb-br-fact-v">{model.project.dateRange}</div>
          </div>
        ) : null}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Print pagination — ~4 single-look bands per landscape sheet (multi-look
// weighs more). Masthead + first group head ride page 1.
// ---------------------------------------------------------------------------
type Item =
  | { readonly kind: "mast"; readonly h: number }
  | { readonly kind: "group"; readonly group: ReportGroup; readonly h: number }
  | { readonly kind: "band"; readonly shot: ReportShot; readonly zebra: boolean; readonly h: number }

const PAGE_CAP = 4.0

// Additional-images row weight (WS-C) — SCALES with thumb count, same fix and
// same rationale as ProductionSheetReport.tsx's extraImagesWeight (a flat
// per-shot bump under-charges a shot with many references far worse than one
// with few, and `.sb-br-page` growing past its `min-height` under `@media
// print { break-after: page }` produces a mis-placed footer / part-blank
// physical page rather than a silent clip — still a pagination-fidelity bug).
// Calibrated against reportStyles.ts, safety margin over the measured figure:
//   - 1 weight unit = 177.6px (PAGE_CAP 4.0 over .sb-br-page's 7.4in content
//     box: width 11in n/a here, padding 0.5in top / 0.55in sides / 0.6in
//     bottom -> 8.5in - 0.5in - 0.6in = 7.4in)
//   - thumbs per PRINT-mode line = 6 (panel width: page content 9.9in minus
//     .sb-br-page 4px*2 print-mode band padding minus print --br-img-col 250px
//     minus print .sb-br-band gap 22px ≈ 670px usable; .sb-br-extra-thumb 90px
//     + .sb-br-extra-row gap 8px = 98px/thumb)
//   - one line ≈ .sb-br-extra margin-top 14 + label (9px * 1.5 line-height) +
//     margin-bottom 7 + thumb height 64px ≈ 98.5px ≈ 0.55 units — charged 0.6
//   - each further wrapped line ≈ gap 8 + thumb 64 ≈ 72px ≈ 0.41 units —
//     charged 0.45 for margin
const EXTRA_THUMBS_PER_LINE = 6
const EXTRA_FIRST_LINE_UNITS = 0.6
const EXTRA_WRAP_LINE_UNITS = 0.45

export function extraImagesWeight(count: number): number {
  if (count <= 0) return 0
  const lines = Math.ceil(count / EXTRA_THUMBS_PER_LINE)
  return EXTRA_FIRST_LINE_UNITS + (lines - 1) * EXTRA_WRAP_LINE_UNITS
}

// Tag-chip row weight (2026-08-17) — SCALES with chip count, same reasoning as
// extraImagesWeight above (`.sb-br-page` growing past its `min-height` under
// `@media print { break-after: page }` produces a mis-placed footer / part-blank
// physical page — a pagination-fidelity bug, not a silent clip, but a bug).
// Calibrated against reportStyles.ts (`.sb-tag-row` / `.sb-tag-chip`):
//   - 1 weight unit = 177.6px (see extraImagesWeight's derivation above)
//   - chips per PRINT-mode line = 6 (panel ≈ 670px usable — same derivation as
//     the extras row; a 12-char chip ≈ 84px, so ~7 fit; charged 6 to bias
//     toward over-counting lines, which can only over-estimate)
//   - one line ≈ .sb-tag-row margin-top 8 + chip height ≈ 15px = 23px ≈ 0.13
//     units — charged 0.15
//   - each further wrapped line ≈ gap 5 + chip 15 = 20px ≈ 0.11 units —
//     charged 0.13
const TAG_CHIPS_PER_LINE = 6
const TAG_FIRST_LINE_UNITS = 0.15
const TAG_WRAP_LINE_UNITS = 0.13

export function tagRowWeight(count: number): number {
  if (count <= 0) return 0
  const lines = Math.ceil(count / TAG_CHIPS_PER_LINE)
  return TAG_FIRST_LINE_UNITS + (lines - 1) * TAG_WRAP_LINE_UNITS
}

// Base band height. A WS-C-1 hotfix nudged this 1.0/1.7 -> 1.05/1.75 for the
// same reason as ProductionSheetReport's THUMBNAIL_FLOOR. Reverted on review
// (PR #519 finding dom-preview-nudge-hits-the-wrong-branch) — see that
// file's THUMBNAIL_FLOOR for the full writeup: the nudge applied to every
// band unconditionally (extras on OR off), the removed Band
// minPresenceAhead={60} turned out to be the actual source of PDF-side page
// cost, and with it gone a real render of the PR's own boundary fixture
// pages IDENTICALLY to origin/main (14 -> 14 at 20 shots, 4 -> 4 at the
// 50-product+10-refs fixture). 1.0/1.7 are the measured-correct values again.
const BASE_H_SINGLE = 1.0
const BASE_H_MULTI = 1.7

function buildStream(
  model: ReportModel,
  showAdditionalImages: boolean,
  showTags: boolean,
): readonly Item[] {
  const stream: Item[] = [{ kind: "mast", h: 1.6 }]
  let z = 0
  for (const group of model.groups) {
    const printable = group.shots.filter((s) => !s.excluded)
    if (printable.length === 0) continue
    stream.push({ kind: "group", group: { ...group, count: printable.length }, h: 0.8 })
    for (const shot of printable) {
      const multi = shot.looks.length > 1
      let h = multi ? BASE_H_MULTI : BASE_H_SINGLE
      // Additional-images row (WS-C): see extraImagesWeight above. No-op when
      // the toggle is off or the shot has nothing extra, so default-off
      // pagination stays byte-identical to pre-WS-C.
      if (showAdditionalImages) h += extraImagesWeight(shot.additionalImages?.length ?? 0)
      // Tag-chip row (2026-08-17): same shape — no-op when the toggle is off or
      // the shot has no chips.
      if (showTags) h += tagRowWeight(shot.tags?.length ?? 0)
      stream.push({ kind: "band", shot, zebra: z % 2 === 1, h })
      z += 1
    }
  }
  return stream
}

function paginate(
  model: ReportModel,
  showAdditionalImages: boolean,
  showTags: boolean,
): readonly (readonly Item[])[] {
  const stream = buildStream(model, showAdditionalImages, showTags)
  const pages: Item[][] = [[]]
  let curH = 0
  stream.forEach((item, i) => {
    const cur = pages[pages.length - 1]!
    if (item.kind !== "band" && i < 2) {
      cur.push(item)
      curH += item.h
      return
    }
    if (item.kind === "group" && curH > PAGE_CAP - 1.3) {
      pages.push([])
      curH = 0
    }
    if (item.kind === "band" && curH + item.h > PAGE_CAP && curH > 0) {
      pages.push([])
      curH = 0
    }
    pages[pages.length - 1]!.push(item)
    curH += item.h
  })
  return pages
}

function PagedView({
  model,
  imageMap,
  onToggleExclude,
  showAdditionalImages = false,
  showTags = false,
}: BodyProps): JSX.Element {
  const pages = useMemo(
    () => paginate(model, showAdditionalImages, showTags),
    [model, showAdditionalImages, showTags],
  )
  const projLine = model.project.client
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name
  return (
    <div className="sb-br-paged">
      {pages.map((items, pi) => (
        <section className="sb-br-page" key={`br-page-${pi}`}>
          {items.map((item, ii) => {
            if (item.kind === "mast") return <Masthead key={`m-${pi}`} model={model} />
            if (item.kind === "group")
              return <GroupHead key={`g-${pi}-${ii}`} group={item.group} note={formatOrderNote(model.order)} />
            return (
              <Band
                key={item.shot.id}
                shot={item.shot}
                imageMap={imageMap}
                zebra={item.zebra}
                onToggleExclude={onToggleExclude}
                showAdditionalImages={showAdditionalImages}
                showTags={showTags}
              />
            )
          })}
          <div className="sb-br-foot">
            <span>Comprehensive Shot Report · {projLine}</span>
            <span>
              Page {pi + 1} of {pages.length}
            </span>
          </div>
        </section>
      ))}
    </div>
  )
}

export function BalancedRowsReport({
  model,
  imageMap,
  onToggleExclude,
  showAdditionalImages = false,
  showTags = false,
}: BodyProps): JSX.Element {
  // Continuous zebra across groups (matches comp-c rhythm) — precomputed so the
  // render body stays pure. Counts printable shots only, so the screen rhythm
  // matches the paged/PDF stream (which filters excluded). Excluded (struck) rows
  // fall through to false.
  const zebraById = useMemo(() => {
    const m = new Map<string, boolean>()
    let i = 0
    for (const g of model.groups)
      for (const s of g.shots) {
        if (s.excluded) continue
        m.set(s.id, i % 2 === 1)
        i += 1
      }
    return m
  }, [model.groups])

  const isEmpty = model.groups.length === 0 || model.project.shotCount === 0
  if (isEmpty) return <p className="sb-empty">No shots to report yet.</p>
  return (
    <div className="sb-br">
      <div className="sb-br-fluid">
        <Masthead model={model} />
        {model.groups.map((group) => (
          <div className="sb-br-group" key={group.key}>
            {/* count = printable; excluded bands still shown struck below */}
            <GroupHead
              group={{ ...group, count: group.shots.filter((s) => !s.excluded).length }}
              note={formatOrderNote(model.order)}
            />
            {group.shots.map((shot) => (
              <Band
                key={shot.id}
                shot={shot}
                imageMap={imageMap}
                zebra={zebraById.get(shot.id) ?? false}
                onToggleExclude={onToggleExclude}
                showAdditionalImages={showAdditionalImages}
                showTags={showTags}
              />
            ))}
          </div>
        ))}
      </div>
      <PagedView
        model={model}
        imageMap={imageMap}
        onToggleExclude={onToggleExclude}
        showAdditionalImages={showAdditionalImages}
        showTags={showTags}
      />
    </div>
  )
}
