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
  ReportFilterCondition,
  ReportFilterField,
  ReportFilterOperator,
  ReportGroup,
  ReportGroupBy,
  ReportLayout,
  ReportLooksMode,
  ReportLook,
  ReportModel,
  ReportProduct,
  ReportShot,
  ReportSortField,
  ReportTalent,
} from "../../lib/report/reportTypes"
import {
  DEFAULT_REPORT_CONFIG,
  REPORT_LAYOUT_OPTIONS,
  REPORT_SORT_FIELD_OPTIONS,
  REPORT_STATUS_OPTIONS,
  resolveReportFilters,
  resolveReportLayout,
} from "../../lib/report/reportTypes"
import type { SortDir } from "../../lib/report/reportSort"
import { hasAnyIncludedShot, sizeLabel } from "../../lib/report/reportModel"
import { packShotSheets } from "../../lib/report/reportPdfHeights"
import { REPORT_STYLES } from "./reportStyles"
import { resolveSrc, statusMeta } from "./reportShared"
import { GroupSortControls } from "./GroupSortControls"
import { ProductionSheetReport } from "./ProductionSheetReport"
import { BalancedRowsReport } from "./BalancedRowsReport"

/** A tag filter option: id actually present on a shot + its label. Deliberately
 *  narrower than useAvailableTags' `AvailableTag` (no usageCount/isDefault) —
 *  see computeUsedTagOptions (tagDedup.ts) for why the report's Filters
 *  control needs a different source than the tag-ASSIGNMENT UI. */
export interface ReportTagOption {
  readonly id: string
  readonly label: string
}

export interface ReportViewProps {
  readonly model: ReportModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly config: ReportConfig
  readonly onConfigChange: (next: ReportConfig) => void
  readonly onExportPdf: () => void
  readonly exporting?: boolean
  /** Tag options for the Filters control — the SAME source and semantics the
   *  shot list's own tag FILTER uses (useShotListState.ts's tagLabelById /
   *  tagOptions, mirrored by computeUsedTagOptions in tagDedup.ts): one option
   *  per id actually present on a shot, no default-tag seeding, no
   *  cross-shot label collapsing. Passed down rather than fetched here so
   *  this stays a pure, data-fetching-free component (existing tests render
   *  it directly with no Firestore/auth providers mounted). */
  readonly availableTags: readonly ReportTagOption[]
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
  const st = statusMeta(shot.status)
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

// Mirror the PDF's height-aware pagination (reportPdfHeights.packShotSheets) so the
// on-screen print preview and the downloaded PDF agree shot-for-shot (WYSIWYG): a
// too-tall shot solos in both, rather than pairing here but soloing in the PDF.
function buildSheets(model: ReportModel): readonly Sheet[] {
  return packShotSheets(model).map((s) => ({
    groupLabel: s.group.label,
    rangeFrom: s.firstPosition,
    rangeTo: s.lastPosition,
    groupTotal: s.groupShotCount,
    shots: [...s.leftColumn, ...s.rightColumn],
  }))
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
              {sheet.groupLabel} · Shots {sheet.rangeFrom}
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
// Filters control (replaces the old standalone "Hide statuses" toggle set) —
// ONE unified vocabulary for status + tag, each with its own include/exclude
// mode and a multi-select value seg. Two small local components (mirrors the
// mode+values pairing in GroupSortControls' "Order by"/"Direction") rather
// than one combined group, so each keeps its own role="group" + label, same
// a11y shape as every other control in this bar.
// ---------------------------------------------------------------------------
const FILTER_OPERATOR_OPTIONS: ReadonlyArray<{ readonly value: ReportFilterOperator; readonly label: string }> = [
  { value: "in", label: "Include" },
  { value: "notIn", label: "Exclude" },
]

function FilterModeGroup({
  label,
  operator,
  onSetOperator,
}: {
  readonly label: string
  readonly operator: ReportFilterOperator
  readonly onSetOperator: (op: ReportFilterOperator) => void
}): JSX.Element {
  const labelId = useId()
  return (
    <div className="sb-control-group" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="sb-control-label">
        {label} mode
      </span>
      <div className="sb-seg">
        {FILTER_OPERATOR_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className="sb-seg-btn"
            aria-pressed={operator === opt.value}
            onClick={() => onSetOperator(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function FilterValuesGroup({
  label,
  options,
  selected,
  onToggleValue,
}: {
  readonly label: string
  readonly options: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly selected: ReadonlySet<string>
  readonly onToggleValue: (value: string) => void
}): JSX.Element {
  const labelId = useId()
  return (
    <div className="sb-control-group" role="group" aria-labelledby={labelId}>
      <span id={labelId} className="sb-control-label">
        {label}
      </span>
      {options.length === 0 ? (
        <span className="sb-muted">None yet</span>
      ) : (
        <div className="sb-seg">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className="sb-seg-btn"
              aria-pressed={selected.has(opt.value)}
              onClick={() => onToggleValue(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
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
  showFilters,
  showSort,
  sortBy,
  onSetSortBy,
  sortDir,
  onSetSortDir,
  statusFilter,
  tagFilter,
  availableTagOptions,
  onSetFilterOperator,
  onToggleFilterValue,
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
  readonly showFilters: boolean
  // showSort gates BOTH the flag-on "Status"/"Set" group-by options and the
  // order-by/direction controls (== featureReportConfig). Flag-off → neither appears.
  readonly showSort: boolean
  readonly sortBy: ReportSortField
  readonly onSetSortBy: (v: ReportSortField) => void
  readonly sortDir: SortDir
  readonly onSetSortDir: (v: SortDir) => void
  readonly statusFilter: ReportFilterCondition | undefined
  readonly tagFilter: ReportFilterCondition | undefined
  readonly availableTagOptions: ReadonlyArray<{ readonly value: string; readonly label: string }>
  readonly onSetFilterOperator: (field: ReportFilterField, op: ReportFilterOperator) => void
  readonly onToggleFilterValue: (field: ReportFilterField, value: string) => void
  readonly onExportPdf: () => void
  readonly exporting: boolean
  readonly canExport: boolean
  readonly exportHint?: string
}): JSX.Element {
  const viewLabelId = useId()
  const groupLabelId = useId()
  const looksLabelId = useId()
  const recipeLabelId = useId()
  const statusSelected = useMemo(() => new Set(statusFilter?.value ?? []), [statusFilter])
  const tagSelected = useMemo(() => new Set(tagFilter?.value ?? []), [tagFilter])
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
          {showSort && (
            <button
              type="button"
              className="sb-seg-btn"
              aria-pressed={groupBy === "status"}
              onClick={() => onSetGroupBy("status")}
            >
              Status
            </button>
          )}
          {showSort && (
            <button
              type="button"
              className="sb-seg-btn"
              aria-pressed={groupBy === "scene"}
              onClick={() => onSetGroupBy("scene")}
            >
              Set
            </button>
          )}
        </div>
      </div>

      {showSort && (
        <GroupSortControls
          classes={{ group: "sb-control-group", label: "sb-control-label", seg: "sb-seg", segBtn: "sb-seg-btn" }}
          sortOptions={REPORT_SORT_FIELD_OPTIONS}
          sortBy={sortBy}
          onSortBy={onSetSortBy}
          sortDir={sortDir}
          onSortDir={onSetSortDir}
        />
      )}

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

      {showFilters && (
        <>
          <FilterModeGroup
            label="Status"
            operator={statusFilter?.operator ?? "notIn"}
            onSetOperator={(op) => onSetFilterOperator("status", op)}
          />
          <FilterValuesGroup
            label="Status"
            options={REPORT_STATUS_OPTIONS}
            selected={statusSelected}
            onToggleValue={(v) => onToggleFilterValue("status", v)}
          />
          <FilterModeGroup
            label="Tags"
            operator={tagFilter?.operator ?? "in"}
            onSetOperator={(op) => onSetFilterOperator("tag", op)}
          />
          <FilterValuesGroup
            label="Tags"
            options={availableTagOptions}
            selected={tagSelected}
            onToggleValue={(v) => onToggleFilterValue("tag", v)}
          />
        </>
      )}

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
  const { model, imageMap, config, onConfigChange, onExportPdf, exporting = false, availableTags } = props
  const [printMode, setPrintMode] = useState(false)

  // Recipes ride their own flag; flag-off forces image-led so prod is byte-identical
  // to the live R1/R2 report regardless of any persisted config.layout (or of
  // DEFAULT_REPORT_CONFIG.layout — resolveReportLayout ignores both when off).
  const recipesEnabled = isFeatureEnabled("featureShotReportRecipes")
  const reportConfigEnabled = isFeatureEnabled("featureReportConfig")
  const layout: ReportLayout = resolveReportLayout(config, recipesEnabled)

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

  // Unified filters (status + tag) — replaces the old standalone "Hide
  // statuses" toggle set. resolveReportFilters reads the migrated view (so a
  // legacy hiddenStatuses-only config still shows its prior selection as
  // pre-checked "Exclude" chips) without requiring hydrateReportConfig to
  // have run first. Every write here clears hiddenStatuses — once the user
  // touches the new control, filters is authoritative and the legacy field
  // stops being written (still tolerated on READ — see reportTypes.ts).
  const filters = resolveReportFilters(config)
  const statusFilter = filters.find((f) => f.field === "status")
  const tagFilter = filters.find((f) => f.field === "tag")

  const setFieldFilter = (
    field: ReportFilterField,
    operator: ReportFilterOperator,
    value: readonly string[],
  ): void => {
    const rest = filters.filter((f) => f.field !== field)
    onConfigChange({
      ...config,
      filters: [...rest, { id: field, field, operator, value }],
      hiddenStatuses: [],
    })
  }

  const setFilterOperator = (field: ReportFilterField, operator: ReportFilterOperator): void => {
    const existing = filters.find((f) => f.field === field)
    setFieldFilter(field, operator, existing?.value ?? [])
  }

  // "Status" defaults to Exclude (matches the pre-existing "Hide statuses"
  // behavior); "Tags" defaults to Include (the more natural "show only these"
  // reading for a fresh tag pick) — only applied the FIRST time a value is
  // toggled for that field, before any operator has been chosen.
  const toggleFilterValue = (field: ReportFilterField, value: string): void => {
    const existing = filters.find((f) => f.field === field)
    const operator = existing?.operator ?? (field === "status" ? "notIn" : "in")
    const currentValues = existing?.value ?? []
    const nextValues = currentValues.includes(value)
      ? currentValues.filter((v) => v !== value)
      : [...currentValues, value]
    setFieldFilter(field, operator, nextValues)
  }

  const availableTagOptions = useMemo(
    () => availableTags.map((t) => ({ value: t.id, label: t.label })),
    [availableTags],
  )

  // R2 order-by — absent fields default-merge to the shipped legacy order.
  const sortBy: ReportSortField = config.sortBy ?? DEFAULT_REPORT_CONFIG.sortBy ?? "shot-number"
  const sortDir: SortDir = config.sortDir ?? "asc"
  const setSortBy = (next: ReportSortField): void => {
    if (next === sortBy) return
    onConfigChange({ ...config, sortBy: next })
  }
  const setSortDir = (next: SortDir): void => {
    if (next === sortDir) return
    onConfigChange({ ...config, sortDir: next })
  }

  const isEmpty = model.groups.length === 0 || model.project.shotCount === 0
  // Export is blocked when every shot is excluded — a PDF with zero pages is corrupt.
  const canExport = hasAnyIncludedShot(model)
  // Use isEmpty (not groups.length): with groupBy:"none" a zero-shot report still
  // emits one empty group, so the shotCount===0 arm of isEmpty is what catches it.
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
        showFilters={reportConfigEnabled}
        showSort={reportConfigEnabled}
        sortBy={sortBy}
        onSetSortBy={setSortBy}
        sortDir={sortDir}
        onSetSortDir={setSortDir}
        statusFilter={statusFilter}
        tagFilter={tagFilter}
        availableTagOptions={availableTagOptions}
        onSetFilterOperator={setFilterOperator}
        onToggleFilterValue={toggleFilterValue}
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
