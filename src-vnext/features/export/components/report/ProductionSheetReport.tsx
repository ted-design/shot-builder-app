// Production-sheet layout (comp-b) — dense, columnar spec sheet for on-set crew
// + warehouse. Each shot is a row [status-spine | thumbnail | body w/ look
// mini-tables]. Consumes the SAME resolved ReportModel + image sidecar as the
// image-led + balanced-rows layouts (no second model). Red does exactly ONE job
// here: the on-hold FLAG spine; the hero product carries a neutral triangle.

import { useMemo } from "react"
import type { JSX } from "react"
import type {
  ReportGroup,
  ReportLook,
  ReportModel,
  ReportProduct,
  ReportShot,
} from "../../lib/report/reportTypes"
import { isFlagged, present, primaryLookImage, resolveSrc, statusMeta } from "./reportShared"

interface BodyProps {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (shotId: string) => void
}

// --- product mini-table row: hero(neutral ▲) · family · style# · colour · size · qty
function ProductRow({ p }: { readonly p: ReportProduct }): JSX.Element {
  const sizePending = p.sizeScope === "pending" || !present(p.size)
  return (
    <div className={"sb-ps-pt" + (p.isHero ? " sb-ps-pt--hero" : "")}>
      <div className="sb-ps-pt-hero">{p.isHero ? <span aria-label="Hero product">▲</span> : null}</div>
      <div className="sb-ps-pt-fam">{present(p.family) ? p.family : "Unnamed product"}</div>
      <div className={"sb-ps-pt-style sb-tabular" + (present(p.style) ? "" : " sb-muted")}>
        {present(p.style) ? p.style : "no style #"}
      </div>
      <div className={"sb-ps-pt-colour" + (present(p.colour) ? "" : " sb-muted")}>
        {present(p.colour) ? p.colour : "Unspecified"}
      </div>
      <div className={"sb-ps-pt-size sb-tabular" + (sizePending ? " sb-pending" : "")}>
        {sizePending ? "Pending" : p.size}
      </div>
      <div className={"sb-ps-pt-qty sb-tabular" + (p.qty != null ? "" : " sb-muted")}>
        {p.qty != null ? `×${p.qty}` : "—"}
      </div>
    </div>
  )
}

function LookBlock({ look }: { readonly look: ReportLook }): JSX.Element {
  const n = look.products.length
  return (
    <div className={"sb-ps-look" + (look.isAlt ? " sb-ps-look--alt" : "")}>
      <div className="sb-ps-look-label">
        <span className="sb-ps-ll-tag">{look.label.toUpperCase()}</span>
        <span className="sb-ps-ll-count">{n === 1 ? "1 piece" : `${n} pieces`}</span>
      </div>
      {look.products.map((p, i) => (
        <ProductRow key={`${look.id}-p-${i}`} p={p} />
      ))}
    </div>
  )
}

function ShotRow({
  shot,
  imageMap,
  onToggleExclude,
}: {
  readonly shot: ReportShot
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (shotId: string) => void
}): JSX.Element {
  const flagged = isFlagged(shot.status)
  const st = statusMeta(shot.status)
  const imgSrc = resolveSrc(imageMap, primaryLookImage(shot))
  const talent = shot.talent.filter((t) => present(t.name))

  return (
    <div className={"sb-ps-row" + (shot.excluded ? " sb-excluded" : "")}>
      {/* status spine — RED's ONE JOB (on-hold flag) */}
      <div className={"sb-ps-spine" + (flagged ? " sb-ps-spine--flagged" : "")}>
        <span className={"sb-status-dot " + st.dotClass} title={st.label} />
        {flagged ? <span className="sb-ps-spine-flag">Hold</span> : null}
      </div>

      {/* thumbnail + talent */}
      <div className="sb-ps-thumb-col">
        <div className={"sb-ps-thumb-frame" + (imgSrc ? "" : " sb-no-image sb-ps-noimg")}>
          {imgSrc ? (
            <img className="sb-img-native" src={imgSrc} alt={`${shot.title} — reference`} loading="lazy" />
          ) : (
            "No reference"
          )}
        </div>
        <div className="sb-ps-talent">
          <span className="sb-ps-talent-label">Talent</span>
          {talent.length ? talent.map((t) => t.name).join(", ") : "Unassigned"}
        </div>
      </div>

      {/* body */}
      <div className="sb-ps-body">
        <button
          type="button"
          className="sb-exclude-toggle no-print"
          aria-pressed={shot.excluded}
          onClick={() => onToggleExclude(shot.id)}
          title={shot.excluded ? "Restore this shot to the report" : "Exclude this shot from the report"}
        >
          {shot.excluded ? "Restore shot" : "Exclude shot"}
        </button>
        <div className="sb-ps-ident">
          <span className="sb-ps-num sb-tabular">{shot.number}</span>
          <h3 className="sb-shot-name sb-ps-name">{shot.title}</h3>
          {present(shot.colorway) ? <span className="sb-ps-colorway">{shot.colorway}</span> : null}
          <span className="sb-ps-status">
            <span className={"sb-status-dot " + st.dotClass} />
            {st.label}
            {shot.gender === "?" ? <span className="sb-badge-unresolved">Gender ?</span> : null}
          </span>
        </div>
        {present(shot.notes) ? <p className="sb-ps-note">{shot.notes}</p> : null}
        <div className="sb-ps-looks">
          {shot.looks.map((lk) => (
            <LookBlock key={lk.id} look={lk} />
          ))}
        </div>
      </div>
    </div>
  )
}

function ColumnRuler(): JSX.Element {
  return (
    <div className="sb-ps-ruler">
      <div className="sb-ps-ruler-spacer" />
      <div className="sb-ps-ruler-shot">Shot / Reference</div>
      <div className="sb-ps-ruler-prod">
        <span />
        <span>Product family</span>
        <span>Style #</span>
        <span>Colour</span>
        <span className="sb-ps-num-h">Size</span>
        <span className="sb-ps-num-h">Qty</span>
      </div>
    </div>
  )
}

function GroupBand({
  group,
  cont,
}: {
  readonly group: ReportGroup
  readonly cont?: boolean
}): JSX.Element {
  return (
    <>
      <div className="sb-ps-group-head">
        <span className="sb-ps-g-name">{cont ? `${group.label} (cont.)` : group.label}</span>
        <span className="sb-ps-g-rule" aria-hidden="true" />
        <span className="sb-ps-g-count">{group.count === 1 ? "1 shot" : `${group.count} shots`}</span>
      </div>
      <ColumnRuler />
    </>
  )
}

function Masthead({ model }: { readonly model: ReportModel }): JSX.Element {
  const all = useMemo(() => model.groups.flatMap((g) => g.shots), [model.groups])
  const women = all.filter((s) => s.gender === "W").length
  const men = all.filter((s) => s.gender === "M").length
  const holds = all.filter((s) => isFlagged(s.status)).length
  const projSub = model.project.client
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name

  const cell = (num: string | number, label: string) => (
    <div className="sb-ps-meta-cell" key={label}>
      <span className="sb-ps-meta-num sb-tabular">{num}</span>
      <span className="sb-ps-meta-label">{label}</span>
    </div>
  )

  return (
    <header className="sb-ps-head-band">
      <div className="sb-ps-head-left">
        <div className="sb-eyebrow">Production Pull Sheet · For Crew &amp; Warehouse</div>
        <h1 className="sb-masthead sb-ps-title">Comprehensive Shot Report</h1>
        <p className="sb-ps-sub">{projSub}</p>
      </div>
      <div className="sb-ps-meta">
        {cell(model.project.shotCount, "Shots")}
        {women > 0 ? cell(women, "Women") : null}
        {men > 0 ? cell(men, "Men") : null}
        {holds > 0 ? cell(holds, "On Hold") : null}
        {model.project.dateRange ? cell(model.project.dateRange, "Window") : null}
      </div>
    </header>
  )
}

function Legend(): JSX.Element {
  return (
    <div className="sb-ps-legend">
      <span className="sb-ps-lg">
        <span className="sb-ps-lg-tri">▲</span> Hero product
      </span>
      <span className="sb-ps-lg">
        <span className="sb-ps-flag-chip">Hold</span> Flagged — not cleared to shoot
      </span>
      <span className="sb-ps-lg">
        <span className="sb-pending">Pending</span> Size to be confirmed
      </span>
      <span className="sb-ps-lg">Looks separated: Primary, then Alt sub-rows</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Print pagination — weight-pack rows into landscape sheets, re-emit a
// continuation group band/ruler so columns stay labeled across a page break.
// ---------------------------------------------------------------------------
type Block =
  | { readonly type: "group"; readonly group: ReportGroup; readonly cont?: boolean }
  | { readonly type: "shot"; readonly shot: ReportShot; readonly group: ReportGroup }

interface PsPage {
  readonly blocks: readonly Block[]
}

const PAGE_CAP_FIRST = 13.0
const PAGE_CAP_FULL = 15.2
const GROUP_W = 1.4 + 0.9 // band + ruler

function shotWeight(shot: ReportShot): number {
  let prodRows = 0
  for (const l of shot.looks) prodRows += l.products.length
  let w = 1.7 + shot.looks.length * 0.55 + prodRows * 0.42
  if (present(shot.notes)) w += 0.6
  return Math.max(w, 2.4) // thumbnail floor
}

function paginate(model: ReportModel): readonly PsPage[] {
  const pages: Block[][] = []
  let cur: Block[] = []
  let used = 0
  let cap = PAGE_CAP_FIRST
  const flush = () => {
    pages.push(cur)
    cur = []
    used = 0
    cap = PAGE_CAP_FULL
  }

  for (const group of model.groups) {
    const printable = group.shots.filter((s) => !s.excluded)
    if (printable.length === 0) continue
    // Never strand a group band: start fresh if it + its first shot won't fit.
    const firstW = printable[0] ? shotWeight(printable[0]) : 2.4
    if (used > 0 && used + GROUP_W + firstW > cap) flush()
    cur.push({ type: "group", group })
    used += GROUP_W
    for (const shot of printable) {
      const w = shotWeight(shot)
      if (used + w > cap && cur.length > 0) {
        flush()
        cur.push({ type: "group", group, cont: true }) // continuation ruler
        used += GROUP_W
      }
      cur.push({ type: "shot", shot, group })
      used += w
    }
  }
  if (cur.length > 0) pages.push(cur)
  return pages.map((blocks) => ({ blocks }))
}

function PagedView({ model, imageMap, onToggleExclude }: BodyProps): JSX.Element {
  const pages = useMemo(() => paginate(model), [model])
  const projLine = model.project.client
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name
  return (
    <div className="sb-ps-paged">
      {pages.map((page, pi) => (
        <section className="sb-ps-page" key={`ps-page-${pi}`}>
          {pi === 0 ? (
            <>
              <Masthead model={model} />
              <Legend />
            </>
          ) : null}
          {page.blocks.map((blk, bi) =>
            blk.type === "group" ? (
              <GroupBand key={`g-${pi}-${bi}`} group={blk.group} cont={blk.cont} />
            ) : (
              <ShotRow
                key={blk.shot.id}
                shot={blk.shot}
                imageMap={imageMap}
                onToggleExclude={onToggleExclude}
              />
            ),
          )}
          <div className="sb-ps-foot">
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

export function ProductionSheetReport({ model, imageMap, onToggleExclude }: BodyProps): JSX.Element {
  const isEmpty = model.groups.length === 0 || model.project.shotCount === 0
  if (isEmpty) return <p className="sb-empty">No shots to report yet.</p>
  return (
    <div className="sb-ps">
      {/* Fluid (screen) */}
      <div className="sb-ps-fluid">
        <Masthead model={model} />
        <Legend />
        {model.groups.map((group) => (
          <div className="sb-ps-group" key={group.key}>
            <GroupBand group={group} />
            {group.shots.map((shot) => (
              <ShotRow key={shot.id} shot={shot} imageMap={imageMap} onToggleExclude={onToggleExclude} />
            ))}
          </div>
        ))}
      </div>
      {/* Paged (print preview + @media print) */}
      <PagedView model={model} imageMap={imageMap} onToggleExclude={onToggleExclude} />
    </div>
  )
}
