// Product Info report — DOM renderer (screen + paged print preview). A NEW report
// TYPE (product-centric): one card per ProductFamily in use, grouped per config.
// Pure presentational + interaction callbacks; no data fetching. Consumes the
// resolved ProductInfoModel + an image *sidecar* map (candidate -> data URL). Red
// does exactly one job here: the HERO mark. Ported from comp-product-info.html.

import { useId, useMemo, useState } from "react"
import type { JSX } from "react"
import { Loader2 } from "lucide-react"
import { isFeatureEnabled } from "@/shared/lib/flags"
import { resolveSrc, statusMeta } from "./reportShared"
import { PRODUCT_INFO_STYLES } from "./productInfoStyles"
import type {
  ProductInfoConfig,
  ProductInfoEntry,
  ProductInfoGroup,
  ProductInfoGroupBy,
  ProductInfoImageSize,
  ProductInfoLayout,
  ProductInfoModel,
  ProductInfoScope,
  ProductInfoSortField,
} from "../../lib/report/productInfoTypes"
import {
  DEFAULT_PRODUCT_INFO_CONFIG,
  PRODUCT_INFO_LAYOUT_GEOMETRY,
  PRODUCT_INFO_LAYOUT_OPTIONS,
  PRODUCT_INFO_SORT_FIELD_OPTIONS,
} from "../../lib/report/productInfoTypes"
import type { ReportShotStatus } from "../../lib/report/reportTypes"
import { REPORT_STATUS_OPTIONS } from "../../lib/report/reportTypes"
import type { SortDir } from "../../lib/report/reportSort"
import { GroupSortControls } from "./GroupSortControls"

export interface ProductInfoReportViewProps {
  readonly model: ProductInfoModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly config: ProductInfoConfig
  readonly onConfigChange: (next: ProductInfoConfig) => void
  readonly onExportPdf: () => void
  readonly exporting?: boolean
  readonly imagesLoading?: boolean
}


// ---------------------------------------------------------------------------
// One product card — image (native aspect), name, style#·gender·HERO, colours,
// sizes / "Size pending", "Appears in N shots" with status dots + look labels.
// ---------------------------------------------------------------------------
function ProductCard({
  entry,
  imageMap,
  onToggleExclude,
}: {
  readonly entry: ProductInfoEntry
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (familyId: string) => void
}): JSX.Element {
  const src = resolveSrc(imageMap, entry.image)
  const appears = entry.appears
  const styleNo = entry.styleNumber && entry.styleNumber.trim() !== "" ? entry.styleNumber : null

  return (
    <article className={"sb-pir-card" + (entry.excluded ? " sb-pir-excluded" : "")}>
      <button
        type="button"
        className="sb-pir-exclude-toggle no-print"
        aria-pressed={entry.excluded}
        onClick={() => onToggleExclude(entry.id)}
        title={entry.excluded ? "Restore this product to the report" : "Exclude this product from the report"}
      >
        {entry.excluded ? "Restore" : "Exclude"}
      </button>

      <div className="sb-pir-card-frame">
        {src ? (
          <img src={src} alt={`${entry.styleName} — product image`} loading="lazy" />
        ) : (
          <div className="sb-pir-noimg">No product image</div>
        )}
      </div>

      <div className="sb-pir-card-body">
        <h3 className="sb-pir-card-name">{entry.styleName}</h3>

        <div className="sb-pir-card-ident">
          {styleNo ? <span className="sb-pir-style-no">{styleNo}</span> : null}
          {styleNo && entry.genderLabel ? <span className="sb-pir-dot-sep">·</span> : null}
          {entry.genderLabel ? <span>{entry.genderLabel}</span> : null}
          {entry.isHero ? (
            <>
              {styleNo || entry.genderLabel ? <span className="sb-pir-dot-sep">·</span> : null}
              <span className="sb-pir-hero-tag">Hero</span>
            </>
          ) : null}
        </div>

        <div className="sb-pir-row">
          <span className="sb-pir-k">Colours</span>
          {entry.colours.length ? (
            <div className="sb-pir-chips">
              {entry.colours.map((c) => (
                <span className="sb-pir-chip" key={c}>
                  {c}
                </span>
              ))}
            </div>
          ) : (
            <span className="sb-pir-v sb-pending">TBD</span>
          )}
        </div>

        <div className="sb-pir-row">
          <span className="sb-pir-k">Sizes</span>
          {entry.sizes.length ? (
            <span className="sb-pir-v sb-tabular">{entry.sizes.join(" · ")}</span>
          ) : entry.sizePending ? (
            <span className="sb-pir-v sb-pending">Size pending</span>
          ) : (
            <span className="sb-pir-v sb-pending">—</span>
          )}
        </div>

        <div className="sb-pir-appears">
          <span className="sb-pir-k">
            Appears in {appears.length} {appears.length === 1 ? "shot" : "shots"}
          </span>
          {appears.length ? (
            <div className="sb-pir-appears-list">
              {appears.map((a, i) => {
                const st = statusMeta(a.status)
                return (
                  <span className="sb-pir-appears-item" key={`${entry.id}-a-${i}`}>
                    <span className={"sb-status-dot " + st.dotClass} title={st.label} aria-hidden="true" />
                    <span>{a.number && a.number.trim() !== "" ? a.number : "—"}</span>
                    {a.looks.length ? <span className="sb-pir-look">{a.looks.join(", ")}</span> : null}
                  </span>
                )
              })}
            </div>
          ) : (
            <span className="sb-pir-v sb-pending">Not yet styled into a shot</span>
          )}
        </div>
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// INDEX layout — one compact spec-sheet row per family: small thumb + name +
// meta line (style# · colours · sizes) + shot count with status dots. The dense
// pole that reaches print/PDF. RED-FREE per the locked design system: the hero
// mark is the canonical INK dot + uppercase INK tag (weight, not colour) — NOT
// the gallery's shipped red hero tag (frozen by byte-identity) and NOT the comp's
// boxed outlined tag (the carried critic fix).
// ---------------------------------------------------------------------------
function ProductIndexRow({
  entry,
  imageMap,
  onToggleExclude,
}: {
  readonly entry: ProductInfoEntry
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (familyId: string) => void
}): JSX.Element {
  const src = resolveSrc(imageMap, entry.image)
  const appears = entry.appears
  const styleNo = entry.styleNumber && entry.styleNumber.trim() !== "" ? entry.styleNumber : null
  const dots = appears.slice(0, 6)

  return (
    <article className={"sb-pir-irow" + (entry.isHero ? " sb-pir-is-hero" : "") + (entry.excluded ? " sb-pir-excluded" : "")}>
      <button
        type="button"
        className="sb-pir-exclude-toggle no-print"
        aria-pressed={entry.excluded}
        onClick={() => onToggleExclude(entry.id)}
        title={entry.excluded ? "Restore this product to the report" : "Exclude this product from the report"}
      >
        {entry.excluded ? "Restore" : "Exclude"}
      </button>

      <div className="sb-pir-ithumb">
        {src ? (
          <img src={src} alt={`${entry.styleName} — product image`} loading="lazy" />
        ) : (
          <div className="sb-pir-ithumb-noimg" aria-hidden="true">
            —
          </div>
        )}
      </div>

      <div className="sb-pir-imain">
        <div className="sb-pir-iname-line">
          <span className="sb-pir-iname">{entry.styleName}</span>
          {entry.isHero ? (
            <span className="sb-pir-index-hero">
              <span className="sb-pir-index-hero-dot" aria-hidden="true" />
              <span className="sb-pir-index-hero-tag">Hero</span>
            </span>
          ) : null}
        </div>
        <div className="sb-pir-imeta">
          {styleNo ? <span className="sb-pir-style-no">{styleNo}</span> : null}
          {styleNo ? <span className="sb-pir-imeta-sep">·</span> : null}
          {entry.colours.length ? (
            <span>{entry.colours.join(", ")}</span>
          ) : (
            <span className="sb-pending">TBD</span>
          )}
          <span className="sb-pir-imeta-sep">·</span>
          {entry.sizes.length ? (
            <span className="sb-tabular">{entry.sizes.join(" · ")}</span>
          ) : entry.sizePending ? (
            <span className="sb-pending">Size pending</span>
          ) : (
            <span className="sb-pending">—</span>
          )}
        </div>
      </div>

      <div className="sb-pir-ishots">
        <span className="sb-pir-ishots-n">{appears.length}</span>
        {dots.length ? (
          <span className="sb-pir-ishots-dots">
            {dots.map((a, i) => {
              const st = statusMeta(a.status)
              return (
                <span
                  className={"sb-status-dot " + st.dotClass}
                  title={st.label}
                  aria-hidden="true"
                  key={`${entry.id}-d-${i}`}
                />
              )
            })}
          </span>
        ) : null}
      </div>
    </article>
  )
}

// Pick the per-family renderer for a layout (gallery card vs. compact index row).
function FamilyItem({
  entry,
  imageMap,
  onToggleExclude,
  layout,
}: {
  readonly entry: ProductInfoEntry
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (familyId: string) => void
  readonly layout: ProductInfoLayout
}): JSX.Element {
  return layout === "index" ? (
    <ProductIndexRow entry={entry} imageMap={imageMap} onToggleExclude={onToggleExclude} />
  ) : (
    <ProductCard entry={entry} imageMap={imageMap} onToggleExclude={onToggleExclude} />
  )
}

// ---------------------------------------------------------------------------
// Masthead band — Products / Women / Men / Heroes / Window.
// ---------------------------------------------------------------------------
function Masthead({ model }: { readonly model: ProductInfoModel }): JSX.Element {
  const stats = useMemo(() => {
    let women = 0
    let men = 0
    let heroes = 0
    for (const g of model.groups) {
      for (const e of g.items) {
        if (e.excluded) continue
        if (e.gender === "W") women += 1
        else if (e.gender === "M") men += 1
        if (e.isHero) heroes += 1
      }
    }
    const total = model.groups.reduce((acc, g) => acc + g.items.filter((e) => !e.excluded).length, 0)
    return { women, men, heroes, total }
  }, [model.groups])

  const cells: ReadonlyArray<readonly [string, string | number]> = [
    ["Products", stats.total],
    ["Women", stats.women],
    ["Men", stats.men],
    ["Heroes", stats.heroes],
    ["Window", model.project.dateRange ?? "—"],
  ]

  return (
    <header className="sb-pir-masthead-band">
      <div className="sb-pir-eyebrow-row">
        <span className="sb-pir-eyebrow">
          Product Info{model.project.name ? ` · ${model.project.name}` : ""}
        </span>
        {model.project.client ? <span className="sb-pir-eyebrow sb-pir-lede">{model.project.client}</span> : null}
      </div>
      <h1 className="sb-pir-masthead-title">Product Info</h1>
      <div className="sb-pir-masthead-meta">
        {cells.map(([k, v]) => (
          <div className="sb-pir-meta-cell" key={k}>
            <span className="sb-pir-meta-k">{k}</span>
            <span className="sb-pir-meta-v">{String(v)}</span>
          </div>
        ))}
      </div>
    </header>
  )
}

// ---------------------------------------------------------------------------
// Fluid (screen) group section — header + count, responsive card grid.
// ---------------------------------------------------------------------------
function GroupSection({
  group,
  imageMap,
  onToggleExclude,
  layout,
}: {
  readonly group: ProductInfoGroup
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (familyId: string) => void
  readonly layout: ProductInfoLayout
}): JSX.Element {
  const shown = group.items.filter((e) => !e.excluded).length
  return (
    <section className="sb-pir-group" aria-label={group.label}>
      <div className="sb-pir-group-head">
        <span className="sb-pir-group-name">{group.label}</span>
        <span className="sb-pir-group-count">
          {shown} {shown === 1 ? "product" : "products"}
        </span>
      </div>
      <div className="sb-pir-grid">
        {group.items.map((entry) => (
          <FamilyItem
            key={entry.id}
            entry={entry}
            imageMap={imageMap}
            onToggleExclude={onToggleExclude}
            layout={layout}
          />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Paged (print preview) — US-Letter LANDSCAPE sheets. Explicit pagination packs
// whole cards onto a fixed N-column grid per sheet so a card NEVER straddles or
// clips a page break (mirrors the shipped report PagedView discipline at DOM
// scope; the comp's CSS-only print clipping must NOT recur). Only PDF-bound
// (non-excluded) entries are paginated.
// ---------------------------------------------------------------------------
interface Sheet {
  readonly groupLabel: string
  readonly cont: boolean
  readonly items: readonly ProductInfoEntry[]
}

// Layout-aware pagination from the SHARED geometry (PRODUCT_INFO_LAYOUT_GEOMETRY)
// so the on-screen paged preview and the @react-pdf export pack identically.
function buildSheets(model: ProductInfoModel): readonly Sheet[] {
  const perSheet = PRODUCT_INFO_LAYOUT_GEOMETRY[model.layout].cardsPerSheet
  const sheets: Sheet[] = []
  for (const group of model.groups) {
    const printable = group.items.filter((e) => !e.excluded)
    for (let i = 0; i < printable.length; i += perSheet) {
      sheets.push({
        groupLabel: group.label,
        cont: i > 0,
        items: printable.slice(i, i + perSheet),
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
  readonly model: ProductInfoModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (familyId: string) => void
}): JSX.Element {
  const sheets = useMemo(() => buildSheets(model), [model])
  const printCols = PRODUCT_INFO_LAYOUT_GEOMETRY[model.layout].printCols
  const projLine = model.project.client
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name
  const totalPages = sheets.length

  return (
    <div className="sb-pir-paged" style={{ ["--sb-pir-print-cols" as string]: printCols }}>
      {sheets.map((sheet, idx) => (
        <section className="sb-pir-sheet" key={`pir-sheet-${idx}`}>
          <div className="sb-pir-sheet-head">
            <div>
              <div className="sb-pir-sh-title">Product Info Report</div>
              <div className="sb-pir-sh-proj">{projLine}</div>
            </div>
            <div className="sb-pir-sh-group">
              {sheet.groupLabel}
              {sheet.cont ? " (cont.)" : ""}
            </div>
          </div>
          <div className="sb-pir-sheet-body">
            {sheet.items.map((entry) => (
              <FamilyItem
                key={entry.id}
                entry={entry}
                imageMap={imageMap}
                onToggleExclude={onToggleExclude}
                layout={model.layout}
              />
            ))}
          </div>
          <div className="sb-pir-sheet-foot">
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
// Control bar (never prints): scope (in-use/library), group-by (gender/
// product-type/none), image size (S/M/L — column density only), Screen/Print,
// Export PDF.
// ---------------------------------------------------------------------------
function ControlBar({
  scope,
  onSetScope,
  groupBy,
  onSetGroupBy,
  layout,
  onSetLayout,
  showLayout,
  imageSize,
  onSetImageSize,
  showImageSize,
  printMode,
  onSetPrintMode,
  showStatusFilter,
  showSort,
  sortBy,
  onSetSortBy,
  sortDir,
  onSetSortDir,
  hiddenStatuses,
  onToggleStatus,
  onExportPdf,
  exporting,
  imagesLoading,
  canExport,
}: {
  readonly scope: ProductInfoScope
  readonly onSetScope: (v: ProductInfoScope) => void
  readonly groupBy: ProductInfoGroupBy
  readonly onSetGroupBy: (v: ProductInfoGroupBy) => void
  readonly layout: ProductInfoLayout
  readonly onSetLayout: (v: ProductInfoLayout) => void
  readonly showLayout: boolean
  readonly imageSize: ProductInfoImageSize
  readonly onSetImageSize: (v: ProductInfoImageSize) => void
  readonly showImageSize: boolean
  readonly printMode: boolean
  readonly onSetPrintMode: (v: boolean) => void
  readonly showStatusFilter: boolean
  readonly showSort: boolean
  readonly sortBy: ProductInfoSortField
  readonly onSetSortBy: (v: ProductInfoSortField) => void
  readonly sortDir: SortDir
  readonly onSetSortDir: (v: SortDir) => void
  readonly hiddenStatuses: readonly ReportShotStatus[]
  readonly onToggleStatus: (v: ReportShotStatus) => void
  readonly onExportPdf: () => void
  readonly exporting: boolean
  readonly imagesLoading: boolean
  readonly canExport: boolean
}): JSX.Element {
  const scopeLabelId = useId()
  const groupLabelId = useId()
  const layoutLabelId = useId()
  const sizeLabelId = useId()
  const viewLabelId = useId()
  const statusLabelId = useId()

  const scopeOpts: ReadonlyArray<readonly [ProductInfoScope, string]> = [
    ["in-use", "In use"],
    ["library", "Library"],
  ]
  const groupOpts: ReadonlyArray<readonly [ProductInfoGroupBy, string]> = [
    ["gender", "Gender"],
    ["product-type", "Type"],
    ["none", "None"],
    // O2 status grouping rides the same flag as the sort controls.
    ...(showSort ? [["status", "Status"] as const] : []),
  ]
  const sizeOpts: ReadonlyArray<readonly [ProductInfoImageSize, string]> = [
    ["s", "S"],
    ["m", "M"],
    ["l", "L"],
  ]

  return (
    <div className="sb-pir-controlbar no-print" role="region" aria-label="Product info report controls">
      <div className="sb-pir-control-group" role="group" aria-labelledby={scopeLabelId}>
        <span id={scopeLabelId} className="sb-pir-control-label">
          Scope
        </span>
        <div className="sb-pir-seg">
          {scopeOpts.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="sb-pir-seg-btn"
              aria-pressed={scope === v}
              onClick={() => onSetScope(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="sb-pir-control-group" role="group" aria-labelledby={groupLabelId}>
        <span id={groupLabelId} className="sb-pir-control-label">
          Group by
        </span>
        <div className="sb-pir-seg">
          {groupOpts.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="sb-pir-seg-btn"
              aria-pressed={groupBy === v}
              onClick={() => onSetGroupBy(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {showSort && (
        <GroupSortControls
          classes={{ group: "sb-pir-control-group", label: "sb-pir-control-label", seg: "sb-pir-seg", segBtn: "sb-pir-seg-btn" }}
          sortOptions={PRODUCT_INFO_SORT_FIELD_OPTIONS}
          sortBy={sortBy}
          onSortBy={onSetSortBy}
          sortDir={sortDir}
          onSortDir={onSetSortDir}
        />
      )}

      {showLayout && (
        <div className="sb-pir-control-group" role="group" aria-labelledby={layoutLabelId}>
          <span id={layoutLabelId} className="sb-pir-control-label">
            Layout
          </span>
          <div className="sb-pir-seg">
            {PRODUCT_INFO_LAYOUT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="sb-pir-seg-btn"
                aria-pressed={layout === opt.value}
                onClick={() => onSetLayout(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {showImageSize && (
        <div className="sb-pir-control-group" role="group" aria-labelledby={sizeLabelId}>
          <span id={sizeLabelId} className="sb-pir-control-label">
            Image size
          </span>
          <div className="sb-pir-seg">
            {sizeOpts.map(([v, label]) => (
              <button
                key={v}
                type="button"
                className="sb-pir-seg-btn"
                aria-pressed={imageSize === v}
                onClick={() => onSetImageSize(v)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sb-pir-control-group" role="group" aria-labelledby={viewLabelId}>
        <span id={viewLabelId} className="sb-pir-control-label">
          View
        </span>
        <div className="sb-pir-seg">
          <button
            type="button"
            className="sb-pir-seg-btn"
            aria-pressed={!printMode}
            onClick={() => onSetPrintMode(false)}
          >
            Screen
          </button>
          <button
            type="button"
            className="sb-pir-seg-btn"
            aria-pressed={printMode}
            onClick={() => onSetPrintMode(true)}
          >
            Print preview
          </button>
        </div>
      </div>

      {showStatusFilter && (
        <div className="sb-pir-control-group" role="group" aria-labelledby={statusLabelId}>
          <span id={statusLabelId} className="sb-pir-control-label">
            Hide statuses
          </span>
          <div className="sb-pir-seg">
            {REPORT_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="sb-pir-seg-btn"
                aria-pressed={hiddenStatuses.includes(opt.value)}
                onClick={() => onToggleStatus(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        type="button"
        className="sb-pir-export-btn"
        onClick={onExportPdf}
        disabled={exporting || imagesLoading || !canExport}
        aria-busy={exporting}
      >
        {exporting ? (
          <>
            <Loader2 className="sb-pir-spin" size={15} aria-hidden="true" />
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
export function ProductInfoReportView(props: ProductInfoReportViewProps): JSX.Element {
  const { model, imageMap, config, onConfigChange, onExportPdf, exporting = false, imagesLoading = false } = props
  const [printMode, setPrintMode] = useState(false)
  const reportConfigEnabled = isFeatureEnabled("featureReportConfig")

  // No non-excluded product => the PDF would have zero pages (@react-pdf throws); gate Export.
  const canExport = model.groups.some((g) => g.items.some((i) => !i.excluded))

  const toggleExclude = (familyId: string): void => {
    const set = new Set(config.excludedFamilyIds)
    if (set.has(familyId)) set.delete(familyId)
    else set.add(familyId)
    onConfigChange({ ...config, excludedFamilyIds: [...set] })
  }

  const setScope = (productScope: ProductInfoScope): void => {
    if (productScope === config.productScope) return
    onConfigChange({ ...config, productScope })
  }

  const setGroupBy = (groupBy: ProductInfoGroupBy): void => {
    if (groupBy === config.groupBy) return
    onConfigChange({ ...config, groupBy })
  }

  const setImageSize = (imageSize: ProductInfoImageSize): void => {
    if (imageSize === config.imageSize) return
    onConfigChange({ ...config, imageSize })
  }

  // R4 density — the report body reads the RESOLVED (neutralized) model.layout so
  // screen + PDF can't drift; the picker writes raw config.layout.
  const layout = model.layout
  const setLayout = (next: ProductInfoLayout): void => {
    if (next === (config.layout ?? "gallery")) return
    onConfigChange({ ...config, layout: next })
  }

  // R3 status filter — multi-select toggle set; an absent field default-merges to [].
  const hiddenStatuses = config.hiddenStatuses ?? []
  const toggleStatus = (status: ReportShotStatus): void => {
    const set = new Set(hiddenStatuses)
    if (set.has(status)) set.delete(status)
    else set.add(status)
    onConfigChange({ ...config, hiddenStatuses: [...set] })
  }

  // R5 order-by — absent fields default-merge to the shipped legacy order.
  const sortBy: ProductInfoSortField = config.sortBy ?? DEFAULT_PRODUCT_INFO_CONFIG.sortBy ?? "style"
  const sortDir: SortDir = config.sortDir ?? "asc"
  const setSortBy = (next: ProductInfoSortField): void => {
    if (next === sortBy) return
    onConfigChange({ ...config, sortBy: next })
  }
  const setSortDir = (next: SortDir): void => {
    if (next === sortDir) return
    onConfigChange({ ...config, sortDir: next })
  }

  const isEmpty = model.groups.length === 0 || model.project.familyCount === 0

  return (
    <div
      className={"sb-pir-root" + (printMode ? " sb-pir-print-mode" : "")}
      data-size={config.imageSize}
      data-layout={layout}
    >
      <style>{PRODUCT_INFO_STYLES}</style>

      <ControlBar
        scope={config.productScope}
        onSetScope={setScope}
        groupBy={config.groupBy}
        onSetGroupBy={setGroupBy}
        layout={layout}
        onSetLayout={setLayout}
        showLayout={reportConfigEnabled}
        imageSize={config.imageSize}
        onSetImageSize={setImageSize}
        showImageSize={layout === "gallery"}
        printMode={printMode}
        onSetPrintMode={setPrintMode}
        showStatusFilter={reportConfigEnabled}
        showSort={reportConfigEnabled}
        sortBy={sortBy}
        onSetSortBy={setSortBy}
        sortDir={sortDir}
        onSetSortDir={setSortDir}
        hiddenStatuses={hiddenStatuses}
        onToggleStatus={toggleStatus}
        onExportPdf={onExportPdf}
        exporting={exporting}
        imagesLoading={imagesLoading}
        canExport={canExport}
      />

      <main className="sb-pir-report">
        <Masthead model={model} />

        {isEmpty ? (
          <p className="sb-pir-empty">No products to report yet.</p>
        ) : (
          <>
            {/* Fluid grouped grid (screen) */}
            <div className="sb-pir-fluid">
              {model.groups.map((group) => (
                <GroupSection
                  key={group.key}
                  group={group}
                  imageMap={imageMap}
                  onToggleExclude={toggleExclude}
                  layout={layout}
                />
              ))}
            </div>

            {/* Paged landscape preview (print mode + @media print) */}
            <PagedView model={model} imageMap={imageMap} onToggleExclude={toggleExclude} />
          </>
        )}
      </main>
    </div>
  )
}
