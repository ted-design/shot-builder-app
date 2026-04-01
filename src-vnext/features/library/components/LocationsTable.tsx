import { useState, useCallback, useMemo } from "react"
import { MapPin } from "lucide-react"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import type { LocationRecord } from "@/shared/types"

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
// Sortable header
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  sortKey,
  activeSortKey,
  activeSortDir,
  onSort,
  className,
}: {
  readonly label: string
  readonly sortKey: SortKey
  readonly activeSortKey: SortKey
  readonly activeSortDir: SortDir
  readonly onSort: (key: SortKey) => void
  readonly className?: string
}) {
  const isActive = activeSortKey === sortKey
  return (
    <th
      className={`label-meta cursor-pointer select-none px-4 py-2 text-left font-semibold transition-colors hover:text-[var(--color-text)] ${className ?? ""}`}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (activeSortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-3xs" aria-hidden>
            {activeSortDir === "asc" ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </span>
    </th>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LocationsTable({ locations, onSelect }: LocationsTableProps) {
  const isMobile = useIsMobile()
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

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

  const sorted = useMemo(
    () => sortLocations(locations, sortKey, sortDir),
    [locations, sortKey, sortDir],
  )

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]">
          <tr>
            <th className="w-14 px-3 py-2" aria-label="Photo" />
            <SortableHeader
              label="Name"
              sortKey="name"
              activeSortKey={sortKey}
              activeSortDir={sortDir}
              onSort={handleSort}
            />
            {!isMobile && (
              <SortableHeader
                label="Address"
                sortKey="address"
                activeSortKey={sortKey}
                activeSortDir={sortDir}
                onSort={handleSort}
                className="min-w-[200px]"
              />
            )}
            <SortableHeader
              label="City"
              sortKey="city"
              activeSortKey={sortKey}
              activeSortDir={sortDir}
              onSort={handleSort}
            />
            <th className="label-meta px-4 py-2 text-left font-semibold">Contact</th>
            <th className="label-meta px-4 py-2 text-left font-semibold">Projects</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((loc) => (
            <tr
              key={loc.id}
              className="cursor-pointer border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-subtle)]"
              onClick={() => onSelect(loc.id)}
              role="row"
              data-testid={`location-row-${loc.id}`}
            >
              <td className="px-3 py-2">
                <LocationThumb location={loc} />
              </td>
              <td className="px-4 py-2.5 font-medium text-[var(--color-text)]">
                {loc.name}
              </td>
              {!isMobile && (
                <td className="max-w-[280px] truncate px-4 py-2.5 text-[var(--color-text-muted)]">
                  {loc.address ?? "\u2014"}
                </td>
              )}
              <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">
                {loc.city ?? "\u2014"}
              </td>
              <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">
                {loc.phone ?? "\u2014"}
              </td>
              <td className="px-4 py-2.5">
                {loc.projectIds && loc.projectIds.length > 0 ? (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--color-surface-subtle)] px-1.5 text-2xs font-medium text-[var(--color-text-secondary)]">
                    {loc.projectIds.length}
                  </span>
                ) : (
                  <span className="text-[var(--color-text-muted)]">\u2014</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
