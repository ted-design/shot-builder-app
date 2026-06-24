// Comprehensive Shot Report — DOM renderer (screen + paged print preview).
// Image-led editorial per the approved north star (Direction A): the photograph
// leads, product/look info reads as a quiet caption beneath each plate. Pure
// presentational + interaction callbacks; no data fetching. Consumes the resolved
// ReportModel (already grouped Women→Men and ordered) and an image *sidecar* map
// (candidate -> data URL). Red does exactly one job here: the shot number.

import { useId, useMemo, useState } from "react"
import type { JSX } from "react"
import { Loader2 } from "lucide-react"
import { isFeatureEnabled } from "@/shared/lib/flags"
import type {
  ReportConfig,
  ReportGroup,
  ReportGroupBy,
  ReportLayout,
  ReportLooksMode,
  ReportLook,
  ReportModel,
  ReportProduct,
  ReportShot,
  ReportTalent,
} from "../../lib/report/reportTypes"
import { REPORT_LAYOUT_OPTIONS } from "../../lib/report/reportTypes"
import { sizeLabel } from "../../lib/report/reportModel"
import { REPORT_STYLES } from "./reportStyles"
import { resolveSrc, statusMetaLegacy } from "./reportShared"
import { ProductionSheetReport } from "./ProductionSheetReport"
import { BalancedRowsReport } from "./BalancedRowsReport"

export interface ReportViewProps {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly config: ReportConfig
  readonly onConfigChange: (next: ReportConfig) => void
  readonly onExportPdf: () => void
  readonly exporting?: boolean
}

/** Primary look = first (image-led's whole-look accessor; distinct from the
 *  shared primaryLookImage which returns just the image candidate). */
function primaryLookOf(shot: ReportShot): ReportLook | undefined {
  return shot.looks[0]
}

// ---------------------------------------------------------------------------
// Product row — aligned tabular caption (family · style# · colour · size · qty)
// ---------------------------------------------------------------------------
function ProductRow({ product }: { readonly product: ReportProduct }): JSX.Element {
  const { text: sizeText, pending: sizePending } = sizeLabel(product.sizeScope, product.size)
  const colourText = product.colour && product.colour.trim() !== "" ? product.colour : "Colour TBD"
  const colourMuted = !(product.colour && product.colour.trim() !== "")
  const qtyText = product.qty != null ? `×${product.qty}` : "×—"
  const styleText = product.style && product.style.trim() !== "" ? product.style : "no style #"

  return (
    <div className={"sb-prod" + (product.isHero ? " sb-prod--hero" : "")}>
      <span className="sb-prod-hero-mark" aria-hidden="true" />
      <div className="sb-prod-fam">
        {product.family && product.family.trim() !== "" ? product.family : "Unnamed product"}
        {product.isHero ? <span className="sb-prod-hero-tag"> Hero</span> : null}
      </div>
      <div className={"sb-prod-colour" + (colourMuted ? " sb-muted" : "")}>{colourText}</div>
      <div className={"sb-prod-size sb-tabular" + (sizePending ? " sb-pending" : "")}>{sizeText}</div>
      <div className="sb-prod-qty sb-tabular">{qtyText}</div>
      <div className="sb-prod-meta">
        <span className="sb-prod-style sb-tabular">{styleText}</span>
      </div>
    </div>
  )
}

function ProductColHead(): JSX.Element {
  return (
    <div className="sb-prod-colhead" aria-hidden="true">
      <span />
      <span>Family</span>
      <span>Colour</span>
      <span className="sb-ch-size">Size</span>
      <span className="sb-ch-qty">Qty</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// A single look (Primary or Alt) — visually separated + labeled, never a blob.
// Alt looks carry a small clearly-labeled secondary image.
// ---------------------------------------------------------------------------
function LookBlock({
  look,
  imageMap,
}: {
  readonly look: ReportLook
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const altSrc = look.isAlt ? resolveSrc(imageMap, look.image) : null
  return (
    <div className={"sb-look" + (look.isAlt ? " sb-look--alt" : "")}>
      <div className="sb-look-head">
        <span className="sb-look-label">{look.label}</span>
        <span className="sb-look-rule" aria-hidden="true" />
      </div>

      {look.isAlt ? (
        <div className="sb-alt-thumb-wrap">
          {altSrc ? (
            <img
              className="sb-alt-thumb sb-img-native"
              src={altSrc}
              alt={`${look.label} look reference`}
              loading="lazy"
            />
          ) : (
            <div className="sb-alt-noimg sb-no-image" role="img" aria-label="Alt look — no reference">
              Alt — no reference
            </div>
          )}
        </div>
      ) : null}

      <ProductColHead />
      <div className="sb-prod-list">
        {look.products.map((p, i) => (
          <ProductRow key={`${look.id}-p-${i}`} product={p} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The photo figure — native aspect, never cropped. No-image => labeled frame.
// ---------------------------------------------------------------------------
function PlateFigure({
  shot,
  primarySrc,
}: {
  readonly shot: ReportShot
  readonly primarySrc: string | null
}): JSX.Element {
  return (
    <figure className="sb-plate-figure">
      <div className="sb-plate-frame">
        {primarySrc ? (
          <>
            <img
              className="sb-plate-img sb-img-native"
              src={primarySrc}
              alt={shot.title + (shot.colorway ? ` — ${shot.colorway}` : "")}
              loading="lazy"
            />
            {/* red shot number overprints the image — red's one job */}
            <div className="sb-plate-no">{shot.number}</div>
          </>
        ) : (
          <div className="sb-plate-img sb-plate-noimg sb-no-image">
            <div className="sb-plate-no-inline">{shot.number}</div>
            <div>Awaiting capture</div>
            <div className="sb-ni-sub">reference photo not yet shot</div>
          </div>
        )}
      </div>
    </figure>
  )
}

// ---------------------------------------------------------------------------
// Talent micro-row — name(s), optional headshot via sidecar.
// ---------------------------------------------------------------------------
function TalentRow({
  talent,
  imageMap,
}: {
  readonly talent: readonly ReportTalent[]
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const named = talent.filter((t) => t.name && t.name.trim() !== "")
  if (named.length === 0) {
    return <span className="sb-talent-empty">Talent TBD</span>
  }
  const firstSrc = resolveSrc(imageMap, named[0]?.img ?? null)
  return (
    <span className="sb-talent-row">
      {firstSrc ? (
        <img className="sb-talent-av" src={firstSrc} alt={named[0]?.name ?? ""} loading="lazy" />
      ) : null}
      {named.map((t) => (
        <span key={t.id} className="sb-talent-name">
          {t.name}
        </span>
      ))}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Caption block under the photo (title, colorway, status+talent, note, looks).
// ---------------------------------------------------------------------------
function PlateCaption({
  shot,
  imageMap,
}: {
  readonly shot: ReportShot
  readonly imageMap: ReadonlyMap<string, string>
}): JSX.Element {
  const st = statusMetaLegacy(shot.status)
  return (
    <div className="sb-plate-caption">
      <div className="sb-caption-topline">
        <h3 className="sb-shot-name sb-shot-title">{shot.title}</h3>
        {shot.gender === "?" ? (
          <span className="sb-badge-unresolved">Unresolved</span>
        ) : shot.gender === "Mixed" ? (
          <span className="sb-badge-unresolved">Mixed</span>
        ) : null}
      </div>

      {shot.colorway ? <p className="sb-colorway">{shot.colorway}</p> : null}

      <div className="sb-caption-sub">
        <span className="sb-status-chip">
          <span className={"sb-status-dot " + st.dotClass} aria-hidden="true" />
          {st.label}
        </span>
        <TalentRow talent={shot.talent} imageMap={imageMap} />
      </div>

      {shot.notes ? <p className="sb-shot-note">{shot.notes}</p> : null}

      <div className="sb-looks">
        {shot.looks.map((look) => (
          <LookBlock key={look.id} look={look} imageMap={imageMap} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One plate (figure + caption) with the per-shot exclude toggle.
// Excluded shots stay visible but struck + dimmed (reversible).
// ---------------------------------------------------------------------------
function Plate({
  shot,
  imageMap,
  onToggleExclude,
}: {
  readonly shot: ReportShot
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (shotId: string) => void
}): JSX.Element {
  const primarySrc = resolveSrc(imageMap, primaryLookOf(shot)?.image ?? null)
  return (
    <article className={"sb-plate" + (shot.excluded ? " sb-excluded" : "")}>
      <button
        type="button"
        className="sb-exclude-toggle no-print"
        aria-pressed={shot.excluded}
        onClick={() => onToggleExclude(shot.id)}
        title={shot.excluded ? "Restore this shot to the report" : "Exclude this shot from the report"}
      >
        {shot.excluded ? "Restore shot" : "Exclude shot"}
      </button>
      <PlateFigure shot={shot} primarySrc={primarySrc} />
      <PlateCaption shot={shot} imageMap={imageMap} />
    </article>
  )
}

// ---------------------------------------------------------------------------
// Fluid (screen) group section — Women / Men header + counts, lookbook flow.
// ---------------------------------------------------------------------------
function GroupSection({
  group,
  imageMap,
  onToggleExclude,
}: {
  readonly group: ReportGroup
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (shotId: string) => void
}): JSX.Element {
  const withRef = group.shots.filter((s) => s.hasImage).length
  return (
    <section className="sb-group" aria-label={group.label}>
      <div className="sb-group-head">
        <h2 className="sb-group-name">{group.label}</h2>
        <span className="sb-group-count">
          <span className="sb-tnum">{group.count}</span>
          {group.count === 1 ? " look · " : " looks · "}
          <span className="sb-tnum">{withRef}</span> with reference
        </span>
      </div>
      <div className="sb-plates">
        {group.shots.map((shot) => (
          <Plate key={shot.id} shot={shot} imageMap={imageMap} onToggleExclude={onToggleExclude} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Masthead band.
// ---------------------------------------------------------------------------
function Masthead({ model }: { readonly model: ReportModel }): JSX.Element {
  const imaged = useMemo(
    () =>
      model.groups.reduce((acc, g) => acc + g.shots.filter((s) => s.hasImage).length, 0),
    [model.groups],
  )
  const total = model.project.shotCount
  const projName =
    model.project.name + (model.project.client ? ` · ${model.project.client}` : "")
  return (
    <header className="sb-masthead-band">
      <div className="sb-masthead-eyebrow">
        <span className="sb-eyebrow">Shot Builder</span>
        <span className="sb-eyebrow sb-lede">Look Approval Deck</span>
      </div>
      <h1 className="sb-masthead sb-masthead-title">Comprehensive Shot Report</h1>
      <div className="sb-masthead-meta">
        <div className="sb-meta-cell">
          <span className="sb-meta-k">Project</span>
          <span className="sb-meta-v sb-display">{projName}</span>
        </div>
        <div className="sb-meta-cell">
          <span className="sb-meta-k">Client</span>
          <span className="sb-meta-v">{model.project.client || "—"}</span>
        </div>
        <div className="sb-meta-cell">
          <span className="sb-meta-k">Shots</span>
          <span className="sb-meta-v sb-tabular">{total}</span>
        </div>
        <div className="sb-meta-cell">
          <span className="sb-meta-k">References ready</span>
          <span className="sb-meta-v sb-tabular">
            {imaged} of {total}
          </span>
        </div>
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Paged (print preview) — US-Letter LANDSCAPE sheets, two plates per sheet,
// running header + footer. Only PDF-bound (non-excluded) shots are paginated.
// ---------------------------------------------------------------------------
interface Sheet {
  readonly groupLabel: string
  readonly rangeFrom: number
  readonly rangeTo: number
  readonly groupTotal: number
  readonly shots: readonly ReportShot[]
}

function buildSheets(model: ReportModel): readonly Sheet[] {
  const sheets: Sheet[] = []
  for (const group of model.groups) {
    const printable = group.shots.filter((s) => !s.excluded)
    for (let i = 0; i < printable.length; i += 2) {
      sheets.push({
        groupLabel: group.label,
        rangeFrom: i + 1,
        rangeTo: Math.min(i + 2, printable.length),
        groupTotal: printable.length,
        shots: printable.slice(i, i + 2),
      })
    }
  }
  return sheets
}

function PagedView({
  model,
  imageMap,
  onToggleExclude,
}: {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (shotId: string) => void
}): JSX.Element {
  const sheets = useMemo(() => buildSheets(model), [model])
  const projLine =
    model.project.name + (model.project.client ? ` · ${model.project.client}` : "")
  const totalPages = sheets.length

  return (
    <div className="sb-paged">
      {sheets.map((sheet, idx) => (
        <section className="sb-sheet" key={`sheet-${idx}`}>
          <div className="sb-sheet-head">
            <div>
              <div className="sb-sh-title">Comprehensive Shot Report</div>
              <div className="sb-sh-proj">{projLine}</div>
            </div>
            <div className="sb-sh-group">
              {sheet.groupLabel} · {sheet.rangeFrom}
              {sheet.rangeTo > sheet.rangeFrom ? `–${sheet.rangeTo}` : ""} of {sheet.groupTotal}
            </div>
          </div>
          <div className="sb-sheet-body">
            {sheet.shots.map((shot) => (
              <Plate
                key={shot.id}
                shot={shot}
                imageMap={imageMap}
                onToggleExclude={onToggleExclude}
              />
            ))}
          </div>
          <div className="sb-sheet-foot">
            <span>{projLine}</span>
            <span>
              Page {idx + 1} / {totalPages}
            </span>
          </div>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sticky control bar (never prints): Screen/Print toggle, Group-by switch,
// Export PDF button.
// ---------------------------------------------------------------------------
function ControlBar({
  printMode,
  onSetPrintMode,
  groupBy,
  onSetGroupBy,
  looksMode,
  onSetLooksMode,
  layout,
  onSetLayout,
  showLayout,
  onExportPdf,
  exporting,
  canExport,
  exportHint,
}: {
  readonly printMode: boolean
  readonly onSetPrintMode: (v: boolean) => void
  readonly groupBy: ReportGroupBy
  readonly onSetGroupBy: (v: ReportGroupBy) => void
  readonly looksMode: ReportLooksMode
  readonly onSetLooksMode: (v: ReportLooksMode) => void
  readonly layout: ReportLayout
  readonly onSetLayout: (v: ReportLayout) => void
  readonly showLayout: boolean
  readonly onExportPdf: () => void
  readonly exporting: boolean
  readonly canExport: boolean
  readonly exportHint?: string
}): JSX.Element {
  const viewLabelId = useId()
  const groupLabelId = useId()
  const looksLabelId = useId()
  const recipeLabelId = useId()
  return (
    <div className="sb-controlbar no-print" role="region" aria-label="Report controls">
      {showLayout ? (
        <div className="sb-control-group" role="group" aria-labelledby={recipeLabelId}>
          <span id={recipeLabelId} className="sb-control-label">
            Recipe
          </span>
          <div className="sb-seg">
            {REPORT_LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="sb-seg-btn"
                aria-pressed={layout === opt.value}
                onClick={() => onSetLayout(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="sb-control-group" role="group" aria-labelledby={viewLabelId}>
        <span id={viewLabelId} className="sb-control-label">
          View
        </span>
        <div className="sb-seg">
          <button
            type="button"
            className="sb-seg-btn"
            aria-pressed={!printMode}
            onClick={() => onSetPrintMode(false)}
          >
            Screen
          </button>
          <button
            type="button"
            className="sb-seg-btn"
            aria-pressed={printMode}
            onClick={() => onSetPrintMode(true)}
          >
            Print preview
          </button>
        </div>
      </div>

      <div className="sb-control-group" role="group" aria-labelledby={groupLabelId}>
        <span id={groupLabelId} className="sb-control-label">
          Group by
        </span>
        <div className="sb-seg">
          <button
            type="button"
            className="sb-seg-btn"
            aria-pressed={groupBy === "gender"}
            onClick={() => onSetGroupBy("gender")}
          >
            Gender
          </button>
          <button
            type="button"
            className="sb-seg-btn"
            aria-pressed={groupBy === "none"}
            onClick={() => onSetGroupBy("none")}
          >
            None
          </button>
        </div>
      </div>

      <div className="sb-control-group" role="group" aria-labelledby={looksLabelId}>
        <span id={looksLabelId} className="sb-control-label">
          Looks
        </span>
        <div className="sb-seg">
          <button
            type="button"
            className="sb-seg-btn"
            aria-pressed={looksMode === "all"}
            onClick={() => onSetLooksMode("all")}
          >
            All
          </button>
          <button
            type="button"
            className="sb-seg-btn"
            aria-pressed={looksMode === "primary-only"}
            onClick={() => onSetLooksMode("primary-only")}
          >
            Primary only
          </button>
        </div>
      </div>

      <button
        type="button"
        className="sb-export-btn"
        onClick={onExportPdf}
        disabled={exporting || !canExport}
        aria-busy={exporting}
        title={exportHint}
      >
        {exporting ? (
          <>
            <Loader2 className="sb-spin" size={15} aria-hidden="true" />
            Exporting…
          </>
        ) : (
          "Export PDF"
        )}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Root.
// ---------------------------------------------------------------------------
export function ReportView(props: ReportViewProps): JSX.Element {
  const { model, imageMap, config, onConfigChange, onExportPdf, exporting = false } = props
  const [printMode, setPrintMode] = useState(false)

  // Recipes ride their own flag; flag-off forces image-led so prod is byte-identical
  // to the live R1/R2 report regardless of any persisted config.layout.
  const recipesEnabled = isFeatureEnabled("featureShotReportRecipes")
  const layout: ReportLayout = recipesEnabled ? (config.layout ?? "image-led") : "image-led"

  const toggleExclude = (shotId: string): void => {
    const set = new Set(config.excludedShotIds)
    if (set.has(shotId)) {
      set.delete(shotId)
    } else {
      set.add(shotId)
    }
    onConfigChange({ ...config, excludedShotIds: [...set] })
  }

  const setGroupBy = (groupBy: ReportGroupBy): void => {
    if (groupBy === config.groupBy) return
    onConfigChange({ ...config, groupBy })
  }

  const looksMode: ReportLooksMode = config.looksMode ?? "all"
  const setLooksMode = (next: ReportLooksMode): void => {
    if (next === looksMode) return
    onConfigChange({ ...config, looksMode: next })
  }

  const setLayout = (next: ReportLayout): void => {
    if (next === layout) return
    onConfigChange({ ...config, layout: next })
  }

  const isEmpty = model.groups.length === 0 || model.project.shotCount === 0
  // Export is blocked when every shot is excluded — a PDF with zero pages is corrupt.
  const canExport = model.groups.some((g) => g.shots.some((s) => !s.excluded))
  // isEmpty covers both groupBy modes (groupBy:"none" emits one empty group when
  // there are zero shots, so groups.length alone misses it).
  const exportHint = canExport
    ? undefined
    : isEmpty
      ? "No shots in this report yet"
      : "Every shot is excluded"

  return (
    <div className={"sb-report-root" + (printMode ? " sb-print-mode" : "")} data-layout={layout}>
      <style>{REPORT_STYLES}</style>

      <ControlBar
        printMode={printMode}
        onSetPrintMode={setPrintMode}
        groupBy={config.groupBy}
        onSetGroupBy={setGroupBy}
        looksMode={looksMode}
        onSetLooksMode={setLooksMode}
        layout={layout}
        onSetLayout={setLayout}
        showLayout={recipesEnabled}
        onExportPdf={onExportPdf}
        exporting={exporting}
        canExport={canExport}
        exportHint={exportHint}
      />

      <main className="sb-report">
        {layout === "production-sheet" ? (
          <ProductionSheetReport model={model} imageMap={imageMap} onToggleExclude={toggleExclude} />
        ) : layout === "balanced-rows" ? (
          <BalancedRowsReport model={model} imageMap={imageMap} onToggleExclude={toggleExclude} />
        ) : (
          <>
            <Masthead model={model} />

            {isEmpty ? (
              <p className="sb-empty">No shots to report yet.</p>
            ) : (
              <>
                {/* Fluid lookbook flow (screen) */}
                <div className="sb-fluid">
                  {model.groups.map((group) => (
                    <GroupSection
                      key={group.key}
                      group={group}
                      imageMap={imageMap}
                      onToggleExclude={toggleExclude}
                    />
                  ))}
                </div>

                {/* Paged landscape preview (print mode + @media print) */}
                <PagedView model={model} imageMap={imageMap} onToggleExclude={toggleExclude} />
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
