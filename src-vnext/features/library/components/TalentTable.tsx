import { useState, useMemo, useCallback, useRef } from "react"
import { ArrowUp, ArrowDown, Settings } from "lucide-react"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useTableColumns } from "@/shared/hooks/useTableColumns"
import { useColumnResize } from "@/shared/hooks/useColumnResize"
import { useTableKeyboardNav } from "@/shared/hooks/useTableKeyboardNav"
import { ResizableHeader } from "@/shared/components/ResizableHeader"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import { Button } from "@/ui/button"
import type { TableColumnConfig } from "@/shared/types/table"
import type { TalentRecord } from "@/shared/types"
import { buildDisplayName, initials } from "@/features/library/components/talentUtils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = "name" | "gender" | "agency" | "height" | "projects"
type SortDirection = "asc" | "desc"

interface SortState {
  readonly field: SortField
  readonly direction: SortDirection
}

interface TalentTableProps {
  readonly talent: readonly TalentRecord[]
  readonly onSelect: (talentId: string) => void
  readonly selectedId?: string | null
}

// ---------------------------------------------------------------------------
// Default column configuration
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS: readonly TableColumnConfig[] = [
  { key: "avatar", label: "", defaultLabel: "", visible: true, width: 48, order: 0, pinned: true },
  { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 180, order: 1, pinned: true, sortable: true },
  { key: "gender", label: "Gender", defaultLabel: "Gender", visible: true, width: 100, order: 2, sortable: true },
  { key: "agency", label: "Agency", defaultLabel: "Agency", visible: true, width: 160, order: 3, sortable: true },
  { key: "height", label: "Height", defaultLabel: "Height", visible: true, width: 80, order: 4 },
  { key: "bust", label: "Bust", defaultLabel: "Bust", visible: true, width: 70, order: 5 },
  { key: "waist", label: "Waist", defaultLabel: "Waist", visible: true, width: 70, order: 6 },
  { key: "hips", label: "Hips", defaultLabel: "Hips", visible: true, width: 70, order: 7 },
  { key: "projects", label: "Projects", defaultLabel: "Projects", visible: true, width: 90, order: 8, sortable: true },
]

// Desktop-only columns hidden on mobile regardless of user config
const DESKTOP_ONLY_KEYS = new Set(["agency", "bust", "waist", "hips"])

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMeasurementValue(
  measurements: TalentRecord["measurements"],
  key: string,
): string {
  if (!measurements) return ""
  const val = measurements[key]
  if (val === null || val === undefined) return ""
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>
    return String(obj["value"] ?? obj["v"] ?? "")
  }
  return String(val)
}

function genderLabel(gender: string | null | undefined): string {
  if (!gender) return ""
  switch (gender.toLowerCase()) {
    case "male":
    case "men":
      return "Male"
    case "female":
    case "women":
      return "Female"
    case "non-binary":
      return "Non-Binary"
    case "other":
      return "Other"
    default:
      return gender
  }
}

function genderBadgeClasses(gender: string | null | undefined): string {
  if (!gender) return ""
  switch (gender.toLowerCase()) {
    case "male":
    case "men":
      return "border border-[var(--color-status-blue-border)] bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]"
    case "female":
    case "women":
      return "border border-[var(--color-status-purple-border)] bg-[var(--color-status-purple-bg)] text-[var(--color-status-purple-text)]"
    case "non-binary":
      return "border border-[var(--color-status-purple-border)] bg-[var(--color-status-purple-bg)] text-[var(--color-status-purple-text)]"
    default:
      return "border border-[var(--color-status-gray-border)] bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)]"
  }
}

function sortValue(
  talent: TalentRecord,
  field: SortField,
): string | number {
  switch (field) {
    case "name":
      return buildDisplayName(talent).toLowerCase()
    case "gender":
      return (talent.gender ?? "").toLowerCase()
    case "agency":
      return (talent.agency ?? "").toLowerCase()
    case "height":
      return getMeasurementValue(talent.measurements, "height").toLowerCase()
    case "projects":
      return (talent.projectIds ?? []).length
    default:
      return ""
  }
}

function compareTalent(
  a: TalentRecord,
  b: TalentRecord,
  sort: SortState,
): number {
  const av = sortValue(a, sort.field)
  const bv = sortValue(b, sort.field)
  const direction = sort.direction === "asc" ? 1 : -1
  if (typeof av === "number" && typeof bv === "number") {
    return (av - bv) * direction
  }
  return String(av).localeCompare(String(bv)) * direction
}

// ---------------------------------------------------------------------------
// Avatar cell (needs hook at component level)
// ---------------------------------------------------------------------------

function AvatarCell({ talent }: { readonly talent: TalentRecord }) {
  const path = talent.headshotPath || talent.imageUrl || undefined
  const url = useStorageUrl(path)
  const name = buildDisplayName(talent)
  return (
    <div className="h-8 w-8 overflow-hidden rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xs font-semibold text-[var(--color-text-muted)]">
          {initials(name)}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sortable header content (button only, no <th> wrapper)
// ---------------------------------------------------------------------------

function SortableHeaderContent({
  label,
  field,
  sort,
  onSort,
}: {
  readonly label: string
  readonly field: SortField
  readonly sort: SortState
  readonly onSort: (field: SortField) => void
}) {
  const active = sort.field === field
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {active ? (
        sort.direction === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden="true" />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden="true" />
        )
      ) : null}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function renderCell(
  talent: TalentRecord,
  columnKey: string,
): React.ReactNode {
  switch (columnKey) {
    case "avatar":
      return <AvatarCell talent={talent} />
    case "name":
      return (
        <span className="font-medium text-[var(--color-text)]">
          {buildDisplayName(talent)}
        </span>
      )
    case "gender":
      return talent.gender ? (
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-2xs font-medium ${genderBadgeClasses(talent.gender)}`}
        >
          {genderLabel(talent.gender)}
        </span>
      ) : (
        <span className="text-[var(--color-text-subtle)]">--</span>
      )
    case "agency":
      return talent.agency || (
        <span className="text-[var(--color-text-subtle)]">--</span>
      )
    case "height":
      return getMeasurementValue(talent.measurements, "height") || (
        <span className="text-[var(--color-text-subtle)]">--</span>
      )
    case "bust":
      return getMeasurementValue(talent.measurements, "bust") || (
        <span className="text-[var(--color-text-subtle)]">--</span>
      )
    case "waist":
      return getMeasurementValue(talent.measurements, "waist") || (
        <span className="text-[var(--color-text-subtle)]">--</span>
      )
    case "hips":
      return getMeasurementValue(talent.measurements, "hips") || (
        <span className="text-[var(--color-text-subtle)]">--</span>
      )
    case "projects": {
      const count = (talent.projectIds ?? []).length
      return count > 0 ? (
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] px-1.5 text-2xs font-medium text-[var(--color-text-muted)]">
          {count}
        </span>
      ) : (
        <span className="text-[var(--color-text-subtle)]">--</span>
      )
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function TalentTable({ talent, onSelect, selectedId }: TalentTableProps) {
  const isMobile = useIsMobile()
  const [sort, setSort] = useState<SortState>({ field: "name", direction: "asc" })

  const {
    columns,
    visibleColumns: allVisibleColumns,
    setColumnWidth,
    toggleVisibility,
    reorderColumns,
    resetToDefaults,
  } = useTableColumns("talent-table", DEFAULT_COLUMNS)

  const { startResize } = useColumnResize({ onWidthChange: setColumnWidth })

  // Filter out desktop-only columns on mobile
  const visibleColumns = isMobile
    ? allVisibleColumns.filter((col) => !DESKTOP_ONLY_KEYS.has(col.key))
    : allVisibleColumns

  const toggleSort = useCallback((field: SortField) => {
    setSort((prev) => {
      if (prev.field === field) {
        return { field, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { field, direction: "asc" }
    })
  }, [])

  const sorted = useMemo(
    () => [...talent].sort((a, b) => compareTalent(a, b, sort)),
    [talent, sort],
  )

  const tableRef = useRef<HTMLTableElement>(null)
  const { onTableKeyDown } = useTableKeyboardNav({
    tableRef,
    rowCount: sorted.length,
    onActivateRow: (i) => {
      const row = sorted[i]
      if (row) onSelect(row.id)
    },
  })

  return (
    <div className="flex flex-col gap-2">
      {/* Column settings toolbar */}
      <div className="flex justify-end">
        <ColumnSettingsPopover
          columns={columns}
          onToggleVisibility={toggleVisibility}
          onReorder={reorderColumns}
          onReset={resetToDefaults}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-2xs text-[var(--color-text-muted)]"
            aria-label="Column settings"
          >
            <Settings className="h-3.5 w-3.5" />
            Columns
          </Button>
        </ColumnSettingsPopover>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table
          ref={tableRef}
          className="w-full text-sm"
          onKeyDown={onTableKeyDown}
        >
          <colgroup>
            {visibleColumns.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]">
            <tr>
              {visibleColumns.map((col) => (
                <ResizableHeader
                  key={col.key}
                  columnKey={col.key}
                  width={col.width}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  {col.sortable ? (
                    <SortableHeaderContent
                      label={col.label}
                      field={col.key as SortField}
                      sort={sort}
                      onSort={toggleSort}
                    />
                  ) : (
                    col.label
                  )}
                </ResizableHeader>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.id}
                role="row"
                onClick={() => onSelect(t.id)}
                className={`cursor-pointer border-b border-[var(--color-border)] transition-colors ${
                  selectedId === t.id
                    ? "bg-[var(--color-primary)]/5"
                    : "hover:bg-[var(--color-surface-subtle)]"
                }`}
              >
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 ${
                      col.key === "bust" || col.key === "waist" || col.key === "hips"
                        ? "text-xs text-[var(--color-text-muted)]"
                        : col.key === "agency" || col.key === "height"
                          ? "text-[var(--color-text-muted)]"
                          : ""
                    }`}
                  >
                    {renderCell(t, col.key)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
