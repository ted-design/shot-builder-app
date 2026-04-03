import { SearchBar } from "@/shared/components/SearchBar"
import { Switch } from "@/ui/switch"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { ReadinessSort, SampleFilter } from "../lib/readinessFilters"

interface ReadinessToolbarProps {
  readonly query: string
  readonly onQueryChange: (value: string) => void
  readonly sort: ReadinessSort
  readonly onSortChange: (value: ReadinessSort) => void
  readonly requireShootRequirements: boolean
  readonly onRequireShootRequirementsChange: (value: boolean) => void
  readonly sampleFilter: SampleFilter
  readonly onSampleFilterChange: (value: SampleFilter) => void
  readonly itemCount: number
  readonly filteredCount: number
}

export function ReadinessToolbar({
  query,
  onQueryChange,
  sort,
  onSortChange,
  requireShootRequirements,
  onRequireShootRequirementsChange,
  sampleFilter,
  onSampleFilterChange,
  itemCount,
  filteredCount,
}: ReadinessToolbarProps) {
  return (
    <div className="mb-3 flex flex-col gap-2">
      {/* Row 1: Search + Sort */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchBar
          value={query}
          onChange={onQueryChange}
          placeholder="Search products..."
          className="w-full sm:w-48"
        />
        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-[var(--color-text-subtle)]">Sort:</span>
          <Select value={sort} onValueChange={(v) => onSortChange(v as ReadinessSort)}>
            <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs" data-testid="readiness-sort-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgency">By urgency</SelectItem>
              <SelectItem value="name">By name (A-Z)</SelectItem>
              <SelectItem value="launchDate">By launch date</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Filters */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Switch
            id="require-shoot-reqs"
            checked={requireShootRequirements}
            onCheckedChange={onRequireShootRequirementsChange}
          />
          <Label htmlFor="require-shoot-reqs" className="cursor-pointer text-xs text-[var(--color-text-muted)]">
            Has shoot requirements
          </Label>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-2xs text-[var(--color-text-subtle)]">Samples:</span>
          <Select value={sampleFilter} onValueChange={(v) => onSampleFilterChange(v as SampleFilter)}>
            <SelectTrigger className="h-7 w-auto min-w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="awaiting">Awaiting samples</SelectItem>
              <SelectItem value="arrived">Samples arrived</SelectItem>
              <SelectItem value="none">No samples tracked</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredCount !== itemCount && (
          <span className="text-2xs text-[var(--color-text-subtle)]">
            Showing {filteredCount} of {itemCount}
          </span>
        )}
      </div>
    </div>
  )
}
