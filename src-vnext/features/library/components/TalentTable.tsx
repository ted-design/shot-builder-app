import { useState, useMemo, useCallback } from "react"
import { ArrowUp, ArrowDown } from "lucide-react"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
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
// Helpers
// ---------------------------------------------------------------------------

function getMeasurementValue(
  measurements: TalentRecord["measurements"],
  key: string,
): string {
  if (!measurements) return ""
  const val = measurements[key]
  if (val === null || val === undefined) return ""
  return String(val)
}

function formatMeasurements(measurements: TalentRecord["measurements"]): string {
  if (!measurements) return ""
  const bust = getMeasurementValue(measurements, "bust")
  const waist = getMeasurementValue(measurements, "waist")
  const hips = getMeasurementValue(measurements, "hips")
  if (!bust && !waist && !hips) return ""
  return [bust || "-", waist || "-", hips || "-"].join("-")
}

function genderLabel(gender: string | null | undefined): string {
  if (!gender) return ""
  switch (gender.toLowerCase()) {
    case "male":
      return "Male"
    case "female":
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
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
    case "female":
      return "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300"
    case "non-binary":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
    default:
      return "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
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
// Sortable header
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  field,
  sort,
  onSort,
  className = "",
}: {
  readonly label: string
  readonly field: SortField
  readonly sort: SortState
  readonly onSort: (field: SortField) => void
  readonly className?: string
}) {
  const active = sort.field === field
  return (
    <th className={`px-3 py-2 text-left font-medium ${className}`}>
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
    </th>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function TalentTableRow({
  talent,
  isSelected,
  isMobile,
  onSelect,
}: {
  readonly talent: TalentRecord
  readonly isSelected: boolean
  readonly isMobile: boolean
  readonly onSelect: (id: string) => void
}) {
  const name = buildDisplayName(talent)
  const height = getMeasurementValue(talent.measurements, "height")
  const measurements = formatMeasurements(talent.measurements)
  const projectCount = (talent.projectIds ?? []).length

  return (
    <tr
      role="row"
      onClick={() => onSelect(talent.id)}
      className={`cursor-pointer border-b border-[var(--color-border)] transition-colors ${
        isSelected
          ? "bg-[var(--color-primary)]/5"
          : "hover:bg-[var(--color-surface-subtle)]"
      }`}
    >
      <td className="px-3 py-2">
        <AvatarCell talent={talent} />
      </td>
      <td className="px-3 py-2">
        <span className="font-medium text-[var(--color-text)]">{name}</span>
      </td>
      <td className="px-3 py-2">
        {talent.gender ? (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-2xs font-medium ${genderBadgeClasses(talent.gender)}`}
          >
            {genderLabel(talent.gender)}
          </span>
        ) : (
          <span className="text-[var(--color-text-subtle)]">--</span>
        )}
      </td>
      {!isMobile && (
        <td className="px-3 py-2 text-[var(--color-text-muted)]">
          {talent.agency || <span className="text-[var(--color-text-subtle)]">--</span>}
        </td>
      )}
      <td className="px-3 py-2 text-[var(--color-text-muted)]">
        {height || <span className="text-[var(--color-text-subtle)]">--</span>}
      </td>
      {!isMobile && (
        <td className="px-3 py-2">
          {measurements ? (
            <span className="font-mono text-xs text-[var(--color-text-muted)]">
              {measurements}
            </span>
          ) : (
            <span className="text-[var(--color-text-subtle)]">--</span>
          )}
        </td>
      )}
      <td className="px-3 py-2">
        {projectCount > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] px-1.5 text-2xs font-medium text-[var(--color-text-muted)]">
            {projectCount}
          </span>
        ) : (
          <span className="text-[var(--color-text-subtle)]">--</span>
        )}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export function TalentTable({ talent, onSelect, selectedId }: TalentTableProps) {
  const isMobile = useIsMobile()
  const [sort, setSort] = useState<SortState>({ field: "name", direction: "asc" })

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

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]">
          <tr>
            <th className="w-12 px-3 py-2" />
            <SortableHeader label="Name" field="name" sort={sort} onSort={toggleSort} className="min-w-[160px]" />
            <SortableHeader label="Gender" field="gender" sort={sort} onSort={toggleSort} className="w-28" />
            {!isMobile && (
              <SortableHeader label="Agency" field="agency" sort={sort} onSort={toggleSort} className="min-w-[140px]" />
            )}
            <th className="w-24 px-3 py-2 text-left font-medium">Height</th>
            {!isMobile && (
              <th className="w-32 px-3 py-2 text-left font-medium">Measurements</th>
            )}
            <SortableHeader label="Projects" field="projects" sort={sort} onSort={toggleSort} className="w-24" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <TalentTableRow
              key={t.id}
              talent={t}
              isSelected={selectedId === t.id}
              isMobile={isMobile}
              onSelect={onSelect}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
