import { useMemo, useState } from "react"
import { Filter, X } from "lucide-react"
import type { TalentRecord } from "@/shared/types"
import type { TalentSearchFilters as Filters, MeasurementRange } from "@/features/library/lib/talentFilters"
import { EMPTY_TALENT_FILTERS, extractUniqueAgencies } from "@/features/library/lib/talentFilters"
import { getMeasurementOptionsForGender } from "@/features/library/lib/measurementOptions"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Checkbox } from "@/ui/checkbox"
import { Separator } from "@/ui/separator"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countActiveFilters(filters: Filters): number {
  let count = 0
  if (filters.gender) count += 1
  if (filters.agency) count += 1
  if (filters.hasCastingHistory !== null) count += 1
  for (const key of Object.keys(filters.measurementRanges)) {
    const r = filters.measurementRanges[key]!
    if (r.min !== null || r.max !== null) count += 1
  }
  return count
}

function buildFilterChips(filters: Filters): readonly { key: string; label: string }[] {
  const chips: { key: string; label: string }[] = []
  if (filters.gender) {
    const label = filters.gender.charAt(0).toUpperCase() + filters.gender.slice(1)
    chips.push({ key: "gender", label: `Gender: ${label}` })
  }
  for (const key of Object.keys(filters.measurementRanges)) {
    const r = filters.measurementRanges[key]!
    if (r.min !== null || r.max !== null) {
      const parts: string[] = []
      if (r.min !== null) parts.push(String(r.min))
      if (r.max !== null) parts.push(String(r.max))
      const fieldLabel = key.charAt(0).toUpperCase() + key.slice(1)
      chips.push({ key: `range:${key}`, label: `${fieldLabel}: ${parts.join(" \u2013 ")}` })
    }
  }
  if (filters.agency) {
    chips.push({ key: "agency", label: `Agency: ${filters.agency}` })
  }
  if (filters.hasCastingHistory !== null) {
    chips.push({
      key: "casting",
      label: filters.hasCastingHistory ? "Has castings" : "No castings",
    })
  }
  return chips
}

function removeChip(filters: Filters, chipKey: string): Filters {
  if (chipKey === "gender") {
    return { ...filters, gender: null, measurementRanges: {} }
  }
  if (chipKey.startsWith("range:")) {
    const field = chipKey.slice(6)
    const { [field]: _removed, ...rest } = filters.measurementRanges
    return { ...filters, measurementRanges: rest }
  }
  if (chipKey === "agency") {
    return { ...filters, agency: null }
  }
  if (chipKey === "casting") {
    return { ...filters, hasCastingHistory: null }
  }
  return filters
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TalentSearchFilterSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly filters: Filters
  readonly onFiltersChange: (next: Filters) => void
  readonly talent: readonly TalentRecord[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TalentSearchFilterSheet({
  open,
  onOpenChange,
  filters,
  onFiltersChange,
  talent,
}: TalentSearchFilterSheetProps) {
  const isMobile = useIsMobile()
  const [agencySearch, setAgencySearch] = useState("")

  const agencies = useMemo(() => extractUniqueAgencies(talent), [talent])

  const filteredAgencies = useMemo(() => {
    const q = agencySearch.trim().toLowerCase()
    if (!q) return agencies
    return agencies.filter((a) => a.toLowerCase().includes(q))
  }, [agencies, agencySearch])

  const measurementFields = useMemo(
    () => getMeasurementOptionsForGender(filters.gender),
    [filters.gender],
  )

  const setGender = (gender: string | null) => {
    onFiltersChange({ ...filters, gender, measurementRanges: {} })
  }

  const setRange = (key: string, field: "min" | "max", value: string) => {
    const parsed = value.trim() === "" ? null : Number(value)
    const numValue = parsed !== null && Number.isFinite(parsed) ? parsed : null
    const existing = filters.measurementRanges[key] ?? { min: null, max: null }
    const next: MeasurementRange = { ...existing, [field]: numValue }

    if (next.min === null && next.max === null) {
      const { [key]: _removed, ...rest } = filters.measurementRanges
      onFiltersChange({ ...filters, measurementRanges: rest })
    } else {
      onFiltersChange({
        ...filters,
        measurementRanges: { ...filters.measurementRanges, [key]: next },
      })
    }
  }

  const clearAll = () => {
    onFiltersChange(EMPTY_TALENT_FILTERS)
    setAgencySearch("")
  }

  const hasActive = countActiveFilters(filters) > 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filter Talent</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Gender */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Gender
            </div>
            <div className="space-y-2">
              {[
                { value: null, label: "All" },
                { value: "men", label: "Men" },
                { value: "women", label: "Women" },
                { value: "other", label: "Other" },
              ].map((opt) => (
                <label key={opt.label} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="talent-gender-filter"
                    checked={filters.gender === opt.value}
                    onChange={() => setGender(opt.value)}
                    className="accent-[var(--color-primary)]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Measurement ranges */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Measurements
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Ranges are inclusive. Leave blank to skip.
            </p>
            <div className="space-y-3 pt-1">
              {measurementFields.map((field) => {
                const range = filters.measurementRanges[field.key]
                return (
                  <div key={field.key}>
                    <div className="mb-1 text-xs font-medium text-[var(--color-text-secondary)]">
                      {field.label}
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                      <Input
                        type="number"
                        placeholder="min"
                        value={range?.min ?? ""}
                        onChange={(e) => setRange(field.key, "min", e.target.value)}
                        className="h-8 text-sm"
                        aria-label={`${field.label} min`}
                      />
                      <span className="text-xs text-[var(--color-text-subtle)]">to</span>
                      <Input
                        type="number"
                        placeholder="max"
                        value={range?.max ?? ""}
                        onChange={(e) => setRange(field.key, "max", e.target.value)}
                        className="h-8 text-sm"
                        aria-label={`${field.label} max`}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Agency */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Agency
            </div>
            <Input
              value={agencySearch}
              onChange={(e) => setAgencySearch(e.target.value)}
              placeholder="Type to filter agencies..."
              className="h-8 text-sm"
            />
            <div className="max-h-36 space-y-2 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              {filteredAgencies.length === 0 ? (
                <p className="text-xs text-[var(--color-text-subtle)]">No agencies found</p>
              ) : (
                filteredAgencies.map((agency) => (
                  <label key={agency} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={filters.agency === agency}
                      onCheckedChange={(v) => {
                        if (v === "indeterminate") return
                        onFiltersChange({
                          ...filters,
                          agency: v ? agency : null,
                        })
                      }}
                    />
                    <span>{agency}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Casting history */}
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Casting History
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.hasCastingHistory === true}
                onCheckedChange={(v) => {
                  if (v === "indeterminate") return
                  onFiltersChange({
                    ...filters,
                    hasCastingHistory: v ? true : null,
                  })
                }}
              />
              <span>Has casting sessions</span>
            </label>
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={!hasActive}
            >
              Clear all
            </Button>
            <SheetClose asChild>
              <Button size="sm">Done</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

interface TalentFilterToolbarProps {
  readonly filters: Filters
  readonly onFiltersChange: (next: Filters) => void
  readonly onOpenSheet: () => void
}

export function TalentFilterToolbar({
  filters,
  onFiltersChange,
  onOpenSheet,
}: TalentFilterToolbarProps) {
  const activeCount = countActiveFilters(filters)
  const chips = useMemo(() => buildFilterChips(filters), [filters])

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onOpenSheet}
        className="gap-2 self-start"
      >
        <Filter className="h-3.5 w-3.5" />
        Filters
        {activeCount > 0 ? (
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] text-2xs font-medium text-[var(--color-text-secondary)]">
            {activeCount}
          </span>
        ) : null}
      </Button>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => onFiltersChange(removeChip(filters, chip.key))}
                className="text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
                aria-label={`Remove ${chip.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={() => onFiltersChange(EMPTY_TALENT_FILTERS)}
            className="text-xs text-[var(--color-text-muted)] underline underline-offset-2 hover:text-[var(--color-text)]"
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  )
}
