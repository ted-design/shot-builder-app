import { useState, useCallback, useMemo, useRef } from "react"
import { MapPin, Settings2, ArrowUp, ArrowDown } from "lucide-react"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import type { LocationRecord } from "@/shared/types"
import type { TableColumnConfig } from "@/shared/types/table"
import { useTableColumns } from "@/shared/hooks/useTableColumns"
import { useColumnResize } from "@/shared/hooks/useColumnResize"
import { useTableKeyboardNav } from "@/shared/hooks/useTableKeyboardNav"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import { ResizableHeader } from "@/shared/components/ResizableHeader"
import { Button } from "@/ui/button"

// ---------------------------------------------------------------------------
// Default column configuration
// ---------------------------------------------------------------------------

const DEFAULT_COLUMNS: readonly TableColumnConfig[] = [
  { key: "thumb", label: "", defaultLabel: "", visible: true, width: 56, order: 0, pinned: true },
  { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 200, order: 1, pinned: true, sortable: true },
  { key: "address", label: "Address", defaultLabel: "Address", visible: true, width: 250, order: 2, sortable: true },
  { key: "city", label: "City", defaultLabel: "City", visible: true, width: 140, order: 3, sortable: true },
  { key: "contact", label: "Contact", defaultLabel: "Contact", visible: true, width: 160, order: 4 },
  { key: "projects", label: "Projects", defaultLabel: "Projects", visible: true, width: 100, order: 5 },
] as const

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortKey = "name" | "city" | "address"
type SortDir = "asc" | "desc"

interface LocationsTableProps {
  readonly locations: readonly LocationRecord[]
  readonly onSelect: (locationId: string) => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compareStrings(a: string | null | undefined, b: string | null | undefined): number {
  const sa = (a ?? "").toLowerCase()
  const sb = (b ?? "").toLowerCase()
  if (sa < sb) return -1
  if (sa > sb) return 1
  return 0
}

function sortLocations(
  locations: readonly LocationRecord[],
  sortKey: SortKey,
  sortDir: SortDir,
): readonly LocationRecord[] {
  const multiplier = sortDir === "asc" ? 1 : -1
  return [...locations].sort((a, b) => {
    switch (sortKey) {
      case "name":
        return multiplier * compareStrings(a.name, b.name)
      case "city":
        return multiplier * compareStrings(a.city, b.city)
      case "address":
        return multiplier * compareStrings(a.address, b.address)
      default:
        return 0
    }
  })
}

function isSortableKey(key: string): key is SortKey {
  return key === "name" || key === "city" || key === "address"
}

// ---------------------------------------------------------------------------
// Thumbnail
// ---------------------------------------------------------------------------

function LocationThumb({
  location,
}: {
  readonly location: LocationRecord
}) {
  const [visible, setVisible] = useState(true)

  if (location.photoUrl && visible) {
    return (
      <img
        src={location.photoUrl}
        alt={location.name}
        className="h-10 w-10 rounded-[var(--radius-md)] border border-[var(--color-border)] object-cover"
        onError={() => setVisible(false)}
      />
    )
  }

  return (
    <span
      className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-base"
      aria-hidden
    >
      <MapPin className="h-4 w-4 text-[var(--color-text-muted)]" />
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sortable header content
// ---------------------------------------------------------------------------

function SortableHeaderContent({
  label,
  sortKey,
  activeSortKey,
  activeSortDir,
  onSort,
}: {
  readonly label: string
  readonly sortKey: SortKey
  readonly activeSortKey: SortKey
  readonly activeSortDir: SortDir
  readonly onSort: (key: SortKey) => void
}) {
  const isActive = activeSortKey === sortKey
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className="inline-flex items-center gap-1 hover:text-[var(--color-text)]"
      aria-label={`Sort by ${label}`}
    >
      {label}
      {isActive && (
        activeSortDir === "asc"
          ? <ArrowUp className="h-3 w-3" aria-hidden="true" />
          : <ArrowDown className="h-3 w-3" aria-hidden="true" />
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Cell renderer
// ---------------------------------------------------------------------------

function renderCell(
  loc: LocationRecord,
  columnKey: string,
): React.ReactNode {
  switch (columnKey) {
    case "thumb":
      return (
        <td key="thumb" className="px-3 py-2">
          <LocationThumb location={loc} />
        </td>
      )
    case "name":
      return (
        <td key="name" className="px-4 py-2.5 font-medium text-[var(--color-text)]">
          {loc.name}
        </td>
      )
    case "address":
      return (
        <td key="address" className="max-w-[280px] truncate px-4 py-2.5 text-[var(--color-text-muted)]">
          {loc.address ?? "\u2014"}
        </td>
      )
    case "city":
      return (
        <td key="city" className="px-4 py-2.5 text-[var(--color-text-secondary)]">
          {loc.city ?? "\u2014"}
        </td>
      )
    case "contact":
      return (
        <td key="contact" className="px-4 py-2.5 text-[var(--color-text-secondary)]">
          {loc.phone ?? "\u2014"}
        </td>
      )
    case "projects":
      return (
        <td key="projects" className="px-4 py-2.5">
          {loc.projectIds && loc.projectIds.length > 0 ? (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-surface-subtle)] px-1.5 text-2xs font-medium text-[var(--color-text-secondary)]">
              {loc.projectIds.length}
            </span>
          ) : (
            <span className="text-[var(--color-text-muted)]">{"\u2014"}</span>
          )}
        </td>
      )
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LocationsTable({ locations, onSelect }: LocationsTableProps) {
  const isMobile = useIsMobile()
  const tableRef = useRef<HTMLTableElement>(null)
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const {
    columns,
    visibleColumns,
    setColumnWidth,
    toggleVisibility,
    reorderColumns,
    resetToDefaults,
  } = useTableColumns("locations-table", DEFAULT_COLUMNS)

  const { startResize } = useColumnResize({ onWidthChange: setColumnWidth })

  const sorted = useMemo(
    () => sortLocations(locations, sortKey, sortDir),
    [locations, sortKey, sortDir],
  )

  const { activeRowIndex, onTableKeyDown } = useTableKeyboardNav({
    tableRef,
    rowCount: sorted.length,
    onActivateRow: (i) => onSelect(sorted[i].id),
  })

  const handleSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortKey(key)
        setSortDir("asc")
      }
    },
    [sortKey],
  )

  // On mobile, filter out address column
  const effectiveColumns = isMobile
    ? visibleColumns.filter((col) => col.key !== "address")
    : visibleColumns

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-end border-b border-[var(--color-border)] px-3 py-1.5">
        <ColumnSettingsPopover
          columns={columns}
          onToggleVisibility={toggleVisibility}
          onReorder={reorderColumns}
          onReset={resetToDefaults}
        >
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            aria-label="Column settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </ColumnSettingsPopover>
      </div>

      <table
        ref={tableRef}
        onKeyDown={onTableKeyDown}
        tabIndex={0}
        className="w-full text-sm"
      >
        <colgroup>
          {effectiveColumns.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]">
          <tr>
            {effectiveColumns.map((col) => (
              <ResizableHeader
                key={col.key}
                columnKey={col.key}
                width={col.width}
                onStartResize={startResize}
                className={
                  col.key === "thumb"
                    ? "w-14 px-3 py-2"
                    : "label-meta cursor-pointer select-none px-4 py-2 text-left font-semibold transition-colors hover:text-[var(--color-text)]"
                }
              >
                {col.key === "thumb" ? (
                  <span className="sr-only">Photo</span>
                ) : col.sortable && isSortableKey(col.key) ? (
                  <SortableHeaderContent
                    label={col.label}
                    sortKey={col.key}
                    activeSortKey={sortKey}
                    activeSortDir={sortDir}
                    onSort={handleSort}
                  />
                ) : (
                  col.label
                )}
              </ResizableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((loc, i) => (
            <tr
              key={loc.id}
              className="cursor-pointer border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-subtle)]"
              onClick={() => onSelect(loc.id)}
              role="row"
              data-testid={`location-row-${loc.id}`}
              data-active-row={activeRowIndex === i ? "" : undefined}
            >
              {effectiveColumns.map((col) => renderCell(loc, col.key))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
