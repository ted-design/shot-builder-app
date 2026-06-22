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
import { present, primaryLookImage, resolveSrc, statusMeta } from "./reportShared"

interface BodyProps {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (shotId: string) => void
}

const GENDER_LABEL: Record<GenderKey, string> = { W: "Women", M: "Men", Mixed: "Mixed", "?": "Unresolved" }

// product row: hero-rail(RED) · family(+HERO tag) · style# · colour · size · qty
function ProductRow({ p }: { readonly p: ReportProduct }): JSX.Element {
  const sizePending = p.sizeScope === "pending" || !present(p.size)
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
        {sizePending ? "Pending" : p.size}
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

function Band({
  shot,
  imageMap,
  zebra,
  onToggleExclude,
}: {
  readonly shot: ReportShot
  readonly imageMap: ReadonlyMap<string, string>
  readonly zebra: boolean
  readonly onToggleExclude: (shotId: string) => void
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
      </div>
    </div>
  )
}

function GroupHead({ group }: { readonly group: ReportGroup }): JSX.Element {
  return (
    <div className="sb-br-group-head">
      <h2 className="sb-masthead sb-br-group-title">{group.label}</h2>
      <span className="sb-br-group-count">{group.count === 1 ? "1 shot" : `${group.count} shots`}</span>
      <span className="sb-br-group-note">Grouped · sorted by shot no.</span>
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

function buildStream(model: ReportModel): readonly Item[] {
  const stream: Item[] = [{ kind: "mast", h: 1.6 }]
  let z = 0
  for (const group of model.groups) {
    const printable = group.shots.filter((s) => !s.excluded)
    if (printable.length === 0) continue
    stream.push({ kind: "group", group: { ...group, count: printable.length }, h: 0.8 })
    for (const shot of printable) {
      const multi = shot.looks.length > 1
      stream.push({ kind: "band", shot, zebra: z % 2 === 1, h: multi ? 1.7 : 1.0 })
      z += 1
    }
  }
  return stream
}

function paginate(model: ReportModel): readonly (readonly Item[])[] {
  const stream = buildStream(model)
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

function PagedView({ model, imageMap, onToggleExclude }: BodyProps): JSX.Element {
  const pages = useMemo(() => paginate(model), [model])
  const projLine = model.project.client
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name
  return (
    <div className="sb-br-paged">
      {pages.map((items, pi) => (
        <section className="sb-br-page" key={`br-page-${pi}`}>
          {items.map((item, ii) => {
            if (item.kind === "mast") return <Masthead key={`m-${pi}`} model={model} />
            if (item.kind === "group") return <GroupHead key={`g-${pi}-${ii}`} group={item.group} />
            return (
              <Band
                key={item.shot.id}
                shot={item.shot}
                imageMap={imageMap}
                zebra={item.zebra}
                onToggleExclude={onToggleExclude}
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

export function BalancedRowsReport({ model, imageMap, onToggleExclude }: BodyProps): JSX.Element {
  const isEmpty = model.groups.length === 0 || model.project.shotCount === 0
  if (isEmpty) return <p className="sb-empty">No shots to report yet.</p>
  // Continuous zebra across groups on screen (matches comp-c rhythm).
  let z = 0
  return (
    <div className="sb-br">
      <div className="sb-br-fluid">
        <Masthead model={model} />
        {model.groups.map((group) => (
          <div className="sb-br-group" key={group.key}>
            {/* count = printable; excluded bands still shown struck below */}
            <GroupHead group={{ ...group, count: group.shots.filter((s) => !s.excluded).length }} />
            {group.shots.map((shot) => {
              const zebra = z % 2 === 1
              z += 1
              return (
                <Band
                  key={shot.id}
                  shot={shot}
                  imageMap={imageMap}
                  zebra={zebra}
                  onToggleExclude={onToggleExclude}
                />
              )
            })}
          </div>
        ))}
      </div>
      <PagedView model={model} imageMap={imageMap} onToggleExclude={onToggleExclude} />
    </div>
  )
}
