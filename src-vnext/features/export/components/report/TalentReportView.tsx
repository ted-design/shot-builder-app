// Talent report — DOM renderer (screen + paged print preview). A NEW report TYPE
// (talent-centric, call-sheet-adjacent): one card per TalentRecord in the project,
// grouped per config. Pure presentational + interaction callbacks; no data fetching.
// Consumes the resolved TalentModel + an image *sidecar* map (candidate -> data URL).
// No red on this surface — status uses neutral/amber dots only. Ported from comp-talent.html.

import { useId, useMemo, useState } from "react"
import type { JSX } from "react"
import { Loader2 } from "lucide-react"
import { isFeatureEnabled } from "@/shared/lib/flags"
import { initials } from "@/features/library/components/talentUtils"
import { resolveSrc, statusMeta } from "./reportShared"
import { TALENT_STYLES } from "./talentStyles"
import type {
  TalentConfig,
  TalentEntry,
  TalentGroup,
  TalentGroupBy,
  TalentModel,
  TalentScope,
  TalentSortField,
} from "../../lib/report/talentTypes"
import {
  DEFAULT_TALENT_CONFIG,
  TALENT_SORT_FIELD_OPTIONS,
} from "../../lib/report/talentTypes"
import type { ReportShotStatus } from "../../lib/report/reportTypes"
import { REPORT_STATUS_OPTIONS } from "../../lib/report/reportTypes"
import type { SortDir } from "../../lib/report/reportSort"
import { GroupSortControls } from "./GroupSortControls"

export interface TalentReportViewProps {
  readonly model: TalentModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly config: TalentConfig
  readonly onConfigChange: (next: TalentConfig) => void
  readonly onExportPdf: () => void
  readonly exporting?: boolean
  readonly imagesLoading?: boolean
}

// Initials fallback — first letter of up to the first two name words.

// ---------------------------------------------------------------------------
// One talent card — headshot col (native-aspect or initials tile + shot count)
// + info col: name, gender badge + agency, contact,
// measurements grid, "In shots" list with status dots + shot number + title + looks.
// ---------------------------------------------------------------------------
function TalentCard({
  entry,
  imageMap,
  onToggleExclude,
}: {
  readonly entry: TalentEntry
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (talentId: string) => void
}): JSX.Element {
  const src = resolveSrc(imageMap, entry.headshot)
  const appears = entry.appears
  const contact: ReadonlyArray<readonly [string, string | null]> = [
    ["Email", entry.email],
    ["Phone", entry.phone],
    ["Web", entry.web],
  ]
  const shownContact = contact.filter(([, v]) => v && v.trim() !== "")

  return (
    <article className={"sb-tr-card" + (entry.excluded ? " sb-tr-excluded" : "")}>
      <button
        type="button"
        className="sb-tr-exclude-toggle no-print"
        aria-pressed={entry.excluded}
        onClick={() => onToggleExclude(entry.id)}
        title={entry.excluded ? "Restore this talent to the report" : "Exclude this talent from the report"}
      >
        {entry.excluded ? "Restore" : "Exclude"}
      </button>

      <div className="sb-tr-headshot">
        <div className="sb-tr-headshot-frame">
          {src ? (
            <img src={src} alt={`${entry.name} — headshot`} loading="lazy" />
          ) : (
            <div className="sb-tr-headshot-initials">{initials(entry.name)}</div>
          )}
        </div>
        <div className="sb-tr-appearances">
          {appears.length} {appears.length === 1 ? "shot" : "shots"}
        </div>
      </div>

      <div className="sb-tr-info">
        <div className="sb-tr-name-row">
          <span className="sb-tr-name">{entry.name}</span>
        </div>

        {entry.genderLabel || entry.agency ? (
          <div className="sb-tr-badges">
            {entry.genderLabel ? <span className="sb-tr-badge-gender">{entry.genderLabel}</span> : null}
            {entry.agency ? <span className="sb-tr-agency">{entry.agency}</span> : null}
          </div>
        ) : null}

        {shownContact.length ? (
          <div className="sb-tr-contact">
            {shownContact.map(([k, v]) => (
              <span className="sb-tr-c-item" key={k}>
                <span className="sb-tr-c-k">{k}</span>
                <span className="sb-tr-c-v">{v}</span>
              </span>
            ))}
          </div>
        ) : null}

        {entry.measurements.length ? (
          <div className="sb-tr-measures">
            {entry.measurements.map((m) => (
              <div className="sb-tr-measure" key={m.label}>
                <span className="sb-tr-m-k">{m.label}</span>
                <span className="sb-tr-m-v">{m.value}</span>
              </div>
            ))}
          </div>
        ) : null}

        <div className="sb-tr-shots-k">In shots</div>
        {appears.length ? (
          <div className="sb-tr-shots-list">
            {appears.map((a, i) => {
              const st = statusMeta(a.status)
              return (
                <div className="sb-tr-shot-line" key={`${entry.id}-a-${i}`}>
                  <span className="sb-tr-s-no">
                    <span className={"sb-status-dot " + st.dotClass} title={st.label} aria-hidden="true" />
                    <span>{a.number && a.number.trim() !== "" ? a.number : "—"}</span>
                  </span>
                  <span className="sb-tr-s-title">{a.title && a.title.trim() !== "" ? a.title : "Untitled shot"}</span>
                  {a.looks.length ? <span className="sb-tr-s-looks">{a.looks.join(" · ")}</span> : null}
                </div>
              )
            })}
          </div>
        ) : (
          <span className="sb-pending">Not yet slotted into a shot</span>
        )}
      </div>
    </article>
  )
}

// ---------------------------------------------------------------------------
// Masthead band — Talent / Agencies / Window.
// ---------------------------------------------------------------------------
function Masthead({ model }: { readonly model: TalentModel }): JSX.Element {
  const stats = useMemo(() => {
    const agencies = new Set<string>()
    let total = 0
    for (const g of model.groups) {
      for (const e of g.items) {
        if (e.excluded) continue
        total += 1
        if (e.agency) agencies.add(e.agency)
      }
    }
    return { agencies: agencies.size, total }
  }, [model.groups])

  const cells: ReadonlyArray<readonly [string, string | number]> = [
    ["Talent", stats.total],
    ["Agencies", stats.agencies],
    ["Window", model.project.dateRange ?? "—"],
  ]

  return (
    <header className="sb-tr-masthead-band">
      <div className="sb-tr-eyebrow-row">
        <span className="sb-tr-eyebrow">
          Talent{model.project.name ? ` · ${model.project.name}` : ""}
        </span>
        {model.project.client ? <span className="sb-tr-eyebrow sb-tr-lede">{model.project.client}</span> : null}
      </div>
      <h1 className="sb-tr-masthead-title">Talent</h1>
      <div className="sb-tr-masthead-meta">
        {cells.map(([k, v]) => (
          <div className="sb-tr-meta-cell" key={k}>
            <span className="sb-tr-meta-k">{k}</span>
            <span className="sb-tr-meta-v">{String(v)}</span>
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
  readonly group: TalentGroup
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (talentId: string) => void
}): JSX.Element {
  const shown = group.items.filter((e) => !e.excluded).length
  return (
    <section className="sb-tr-group" aria-label={group.label}>
      <div className="sb-tr-group-head">
        <span className="sb-tr-group-name">{group.label}</span>
        <span className="sb-tr-group-count">{shown} talent</span>
      </div>
      <div className="sb-tr-grid">
        {group.items.map((entry) => (
          <TalentCard key={entry.id} entry={entry} imageMap={imageMap} onToggleExclude={onToggleExclude} />
        ))}
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
// Paged (print preview) — US-Letter LANDSCAPE sheets. Explicit pagination packs
// whole cards onto a fixed 2-column grid per sheet so a wide call-sheet card NEVER
// straddles or clips a page break (mirrors the shipped report PagedView discipline
// at DOM scope; the comp's CSS-only print clipping must NOT recur). Only PDF-bound
// (non-excluded) entries are paginated.
// ---------------------------------------------------------------------------
const PRINT_COLS = 2
const PRINT_ROWS = 3
const CARDS_PER_SHEET = PRINT_COLS * PRINT_ROWS

interface Sheet {
  readonly groupLabel: string
  readonly cont: boolean
  readonly items: readonly TalentEntry[]
}

function buildSheets(model: TalentModel): readonly Sheet[] {
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
  readonly model: TalentModel
  readonly imageMap: ReadonlyMap<string, string>
  readonly onToggleExclude: (talentId: string) => void
}): JSX.Element {
  const sheets = useMemo(() => buildSheets(model), [model])
  const projLine = model.project.client
    ? `${model.project.name} · ${model.project.client}`
    : model.project.name
  const totalPages = sheets.length

  if (sheets.length === 0) {
    return (
      <div className="sb-tr-paged">
        <p className="sb-tr-empty">All talent are excluded — nothing to print.</p>
      </div>
    )
  }

  return (
    <div className="sb-tr-paged" style={{ ["--sb-tr-print-cols" as string]: PRINT_COLS }}>
      {sheets.map((sheet, idx) => (
        <section className="sb-tr-sheet" key={`tr-sheet-${idx}`}>
          <div className="sb-tr-sheet-head">
            <div>
              <div className="sb-tr-sh-title">Talent Report</div>
              <div className="sb-tr-sh-proj">{projLine}</div>
            </div>
            <div className="sb-tr-sh-group">
              {sheet.groupLabel}
              {sheet.cont ? " (cont.)" : ""}
            </div>
          </div>
          <div className="sb-tr-sheet-body">
            {sheet.items.map((entry) => (
              <TalentCard key={entry.id} entry={entry} imageMap={imageMap} onToggleExclude={onToggleExclude} />
            ))}
          </div>
          <div className="sb-tr-sheet-foot">
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
// Control bar (never prints): scope (in-shots/project-attached), group-by
// (none/gender/agency), Screen/Print, Export PDF. No image-size knob (headshots
// are small).
// ---------------------------------------------------------------------------
function ControlBar({
  scope,
  onSetScope,
  groupBy,
  onSetGroupBy,
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
  readonly scope: TalentScope
  readonly onSetScope: (v: TalentScope) => void
  readonly groupBy: TalentGroupBy
  readonly onSetGroupBy: (v: TalentGroupBy) => void
  readonly printMode: boolean
  readonly onSetPrintMode: (v: boolean) => void
  readonly showStatusFilter: boolean
  readonly showSort: boolean
  readonly sortBy: TalentSortField
  readonly onSetSortBy: (v: TalentSortField) => void
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
  const viewLabelId = useId()
  const statusLabelId = useId()

  const scopeOpts: ReadonlyArray<readonly [TalentScope, string]> = [
    ["in-shots", "In shots"],
    ["project-attached", "Attached"],
  ]
  const groupOpts: ReadonlyArray<readonly [TalentGroupBy, string]> = [
    ["none", "None"],
    ["gender", "Gender"],
    ["agency", "Agency"],
    // O2 status grouping rides the same flag as the sort controls.
    ...(showSort ? [["status", "Status"] as const] : []),
  ]

  return (
    <div className="sb-tr-controlbar no-print" role="region" aria-label="Talent report controls">
      <div className="sb-tr-control-group" role="group" aria-labelledby={scopeLabelId}>
        <span id={scopeLabelId} className="sb-tr-control-label">
          Scope
        </span>
        <div className="sb-tr-seg">
          {scopeOpts.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="sb-tr-seg-btn"
              aria-pressed={scope === v}
              onClick={() => onSetScope(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="sb-tr-control-group" role="group" aria-labelledby={groupLabelId}>
        <span id={groupLabelId} className="sb-tr-control-label">
          Group by
        </span>
        <div className="sb-tr-seg">
          {groupOpts.map(([v, label]) => (
            <button
              key={v}
              type="button"
              className="sb-tr-seg-btn"
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
          classes={{ group: "sb-tr-control-group", label: "sb-tr-control-label", seg: "sb-tr-seg", segBtn: "sb-tr-seg-btn" }}
          sortOptions={TALENT_SORT_FIELD_OPTIONS}
          sortBy={sortBy}
          onSortBy={onSetSortBy}
          sortDir={sortDir}
          onSortDir={onSetSortDir}
        />
      )}

      <div className="sb-tr-control-group" role="group" aria-labelledby={viewLabelId}>
        <span id={viewLabelId} className="sb-tr-control-label">
          View
        </span>
        <div className="sb-tr-seg">
          <button
            type="button"
            className="sb-tr-seg-btn"
            aria-pressed={!printMode}
            onClick={() => onSetPrintMode(false)}
          >
            Screen
          </button>
          <button
            type="button"
            className="sb-tr-seg-btn"
            aria-pressed={printMode}
            onClick={() => onSetPrintMode(true)}
          >
            Print preview
          </button>
        </div>
      </div>

      {showStatusFilter && (
        <div className="sb-tr-control-group" role="group" aria-labelledby={statusLabelId}>
          <span id={statusLabelId} className="sb-tr-control-label">
            Hide statuses
          </span>
          <div className="sb-tr-seg">
            {REPORT_STATUS_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className="sb-tr-seg-btn"
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
        className="sb-tr-export-btn"
        onClick={onExportPdf}
        disabled={exporting || imagesLoading || !canExport}
        aria-busy={exporting}
      >
        {exporting ? (
          <>
            <Loader2 className="sb-tr-spin" size={15} aria-hidden="true" />
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
export function TalentReportView(props: TalentReportViewProps): JSX.Element {
  const { model, imageMap, config, onConfigChange, onExportPdf, exporting = false, imagesLoading = false } = props
  const [printMode, setPrintMode] = useState(false)
  const reportConfigEnabled = isFeatureEnabled("featureReportConfig")

  const toggleExclude = (talentId: string): void => {
    const set = new Set(config.excludedTalentIds)
    if (set.has(talentId)) set.delete(talentId)
    else set.add(talentId)
    onConfigChange({ ...config, excludedTalentIds: [...set] })
  }

  const setScope = (talentScope: TalentScope): void => {
    if (talentScope === config.talentScope) return
    onConfigChange({ ...config, talentScope })
  }

  const setGroupBy = (groupBy: TalentGroupBy): void => {
    if (groupBy === config.groupBy) return
    onConfigChange({ ...config, groupBy })
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
  const sortBy: TalentSortField = config.sortBy ?? DEFAULT_TALENT_CONFIG.sortBy ?? "name"
  const sortDir: SortDir = config.sortDir ?? "asc"
  const setSortBy = (next: TalentSortField): void => {
    if (next === sortBy) return
    onConfigChange({ ...config, sortBy: next })
  }
  const setSortDir = (next: SortDir): void => {
    if (next === sortDir) return
    onConfigChange({ ...config, sortDir: next })
  }

  const isEmpty = model.groups.length === 0 || model.project.talentCount === 0
  // No non-excluded talent => the PDF would have zero pages (@react-pdf throws); gate Export.
  const canExport = model.groups.some((g) => g.items.some((i) => !i.excluded))

  return (
    <div className={"sb-tr-root" + (printMode ? " sb-tr-print-mode" : "")}>
      <style>{TALENT_STYLES}</style>

      <ControlBar
        scope={config.talentScope}
        onSetScope={setScope}
        groupBy={config.groupBy}
        onSetGroupBy={setGroupBy}
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

      <main className="sb-tr-report">
        <Masthead model={model} />

        {isEmpty ? (
          <p className="sb-tr-empty">No talent to report yet.</p>
        ) : (
          <>
            {/* Fluid grouped grid (screen) */}
            <div className="sb-tr-fluid">
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
