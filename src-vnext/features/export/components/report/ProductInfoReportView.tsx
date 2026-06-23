// Product Info report — DOM renderer (screen + paged print preview). A NEW report
// TYPE (product-centric): one card per ProductFamily in use, grouped per config.
// Pure presentational + interaction callbacks; no data fetching. Consumes the
// resolved ProductInfoModel + an image *sidecar* map (candidate -> data URL). Red
// does exactly one job here: the HERO mark. Ported from comp-product-info.html.

import { useId, useMemo, useState } from "react"
import type { JSX } from "react"
import { Loader2 } from "lucide-react"
import { resolveSrc, statusMeta } from "./reportShared"
import { PRODUCT_INFO_STYLES } from "./productInfoStyles"
import type {
  ProductInfoConfig,
  ProductInfoEntry,
  ProductInfoGroup,
  ProductInfoGroupBy,
  ProductInfoImageSize,
  ProductInfoModel,
  ProductInfoScope,
} from "../../lib/report/productInfoTypes"

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
}: {
  readonly group: ProductInfoGroup
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (familyId: string) => void
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
          <ProductCard key={entry.id} entry={entry} imageMap={imageMap} onToggleExclude={onToggleExclude} />
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
const PRINT_COLS = 4
const PRINT_ROWS = 3
const CARDS_PER_SHEET = PRINT_COLS * PRINT_ROWS

interface Sheet {
  readonly groupLabel: string
  readonly cont: boolean
  readonly items: readonly ProductInfoEntry[]
}

function buildSheets(model: ProductInfoModel): readonly Sheet[] {
  const sheets: Sheet[] = []
  for (const group of model.groups) {
    const printable = group.items.filter((e) => !e.excluded)
    for (let i = 0; i < printable.length; i += CARDS_PER_SHEET) {
      sheets.push({
        groupLabel: group.label,
        cont: i > 0,
        items: printable.slice(i, i + CARDS_PER_SHEET),
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
  const projLine = model.project.client
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name
  const totalPages = sheets.length

  return (
    <div className="sb-pir-paged" style={{ ["--sb-pir-print-cols" as string]: PRINT_COLS }}>
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
              <ProductCard key={entry.id} entry={entry} imageMap={imageMap} onToggleExclude={onToggleExclude} />
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
  imageSize,
  onSetImageSize,
  printMode,
  onSetPrintMode,
  onExportPdf,
  exporting,
  imagesLoading,
}: {
  readonly scope: ProductInfoScope
  readonly onSetScope: (v: ProductInfoScope) => void
  readonly groupBy: ProductInfoGroupBy
  readonly onSetGroupBy: (v: ProductInfoGroupBy) => void
  readonly imageSize: ProductInfoImageSize
  readonly onSetImageSize: (v: ProductInfoImageSize) => void
  readonly printMode: boolean
  readonly onSetPrintMode: (v: boolean) => void
  readonly onExportPdf: () => void
  readonly exporting: boolean
  readonly imagesLoading: boolean
}): JSX.Element {
  const scopeLabelId = useId()
  const groupLabelId = useId()
  const sizeLabelId = useId()
  const viewLabelId = useId()

  const scopeOpts: ReadonlyArray<readonly [ProductInfoScope, string]> = [
    ["in-use", "In use"],
    ["library", "Library"],
  ]
  const groupOpts: ReadonlyArray<readonly [ProductInfoGroupBy, string]> = [
    ["gender", "Gender"],
    ["product-type", "Type"],
    ["none", "None"],
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

      <button
        type="button"
        className="sb-pir-export-btn"
        onClick={onExportPdf}
        disabled={exporting || imagesLoading}
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

  const isEmpty = model.groups.length === 0 || model.project.familyCount === 0

  return (
    <div className={"sb-pir-root" + (printMode ? " sb-pir-print-mode" : "")} data-size={config.imageSize}>
      <style>{PRODUCT_INFO_STYLES}</style>

      <ControlBar
        scope={config.productScope}
        onSetScope={setScope}
        groupBy={config.groupBy}
        onSetGroupBy={setGroupBy}
        imageSize={config.imageSize}
        onSetImageSize={setImageSize}
        printMode={printMode}
        onSetPrintMode={setPrintMode}
        onExportPdf={onExportPdf}
        exporting={exporting}
        imagesLoading={imagesLoading}
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
