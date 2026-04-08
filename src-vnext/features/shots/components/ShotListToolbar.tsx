import { useState } from "react"
import type { SortKey, ViewMode } from "@/features/shots/lib/shotListFilters"
import { SORT_LABELS, STATUS_LABELS } from "@/features/shots/lib/shotListFilters"
import type { ShotFirestoreStatus } from "@/shared/types"
import type { computeInsights } from "@/features/shots/lib/shotListFilters"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import {
  Search,
  X,
  ArrowUpDown,
  LayoutGrid,
  Table2,
  CircleDot,
  Hash,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Insights = ReturnType<typeof computeInsights>

type ShotListToolbarProps = {
  readonly queryDraft: string
  readonly onQueryDraftChange: (value: string) => void
  readonly onClearQuery: () => void
  readonly sortKey: SortKey
  readonly onSortKeyChange: (key: SortKey) => void
  readonly sortDir: "asc" | "desc"
  readonly onSortDirToggle: () => void
  readonly isCustomSort: boolean
  readonly isMobile: boolean
  readonly viewMode: ViewMode
  readonly onViewModeChange: (mode: ViewMode) => void
  // Inline filter dropdowns
  readonly insights: Insights
  readonly statusFilter: ReadonlySet<ShotFirestoreStatus>
  readonly toggleStatus: (status: ShotFirestoreStatus) => void
  // Renumber
  readonly canReorder: boolean
  readonly hasActiveFilters: boolean
  readonly onRenumberOpen: () => void
  // More filters (advanced conditions beyond status/missing)
  readonly extraFilterCount: number
  readonly onMoreFiltersOpen: () => void
  // Showing count
  readonly displayCount: number
  readonly totalCount: number
}

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------

const STATUS_DOT_CLASS: Record<ShotFirestoreStatus, string> = {
  todo: "bg-[var(--color-text-subtle)]",
  in_progress: "bg-blue-500",
  on_hold: "bg-amber-500",
  complete: "bg-green-600",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotListToolbar({
  queryDraft,
  onQueryDraftChange,
  onClearQuery,
  sortKey,
  onSortKeyChange,
  sortDir,
  onSortDirToggle,
  isCustomSort,
  isMobile,
  viewMode,
  onViewModeChange,
  insights,
  statusFilter,
  toggleStatus,
  canReorder,
  hasActiveFilters,
  onRenumberOpen,
  extraFilterCount,
  onMoreFiltersOpen,
  displayCount,
  totalCount,
}: ShotListToolbarProps) {
  const [statusOpen, setStatusOpen] = useState(false)

  const statusActiveCount = statusFilter.size

  const handleSortChange = (value: string) => {
    if (value === "__renumber__") {
      onRenumberOpen()
      return
    }
    onSortKeyChange(value as SortKey)
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative w-full sm:w-[240px]">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
        <Input
          value={queryDraft}
          onChange={(e) => onQueryDraftChange(e.target.value)}
          placeholder="Search shots…"
          className="pl-9 pr-9"
        />
        {queryDraft.trim().length > 0 && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
            onClick={() => {
              onQueryDraftChange("")
              onClearQuery()
            }}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Clear search</span>
          </button>
        )}
      </div>

      {/* Sort (with Renumber action at bottom) */}
      <Select value={sortKey} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
          {canReorder && (
            <>
              <SelectSeparator />
              <SelectItem
                value="__renumber__"
                disabled={hasActiveFilters}
                className="text-[var(--color-text-muted)]"
                title={hasActiveFilters ? "Clear filters to renumber all shots." : undefined}
              >
                <span className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  Renumber to match order
                </span>
              </SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {/* Sort direction toggle */}
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9"
        disabled={isCustomSort}
        title="Toggle sort direction"
        onClick={onSortDirToggle}
      >
        <ArrowUpDown className="h-4 w-4" />
      </Button>

      {/* Status filter popover */}
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={`gap-1.5 ${statusActiveCount > 0 ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]" : ""}`}
          >
            <CircleDot className="h-3.5 w-3.5" />
            Status
            {statusActiveCount > 0 && (
              <span className="ml-0.5 flex h-4.5 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)]/15 px-1 text-2xs font-semibold tabular-nums">
                {statusActiveCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-0">
          <div className="px-3 pt-2.5 pb-1">
            <p className="text-2xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
              Filter by Status
            </p>
          </div>
          <div className="py-1">
            {(["todo", "in_progress", "on_hold", "complete"] as const).map((s) => {
              const count = insights.statusCounts[s] ?? 0
              const active = statusFilter.has(s)
              return (
                <label
                  key={s}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-[var(--color-surface-subtle)]"
                >
                  <Checkbox
                    checked={active}
                    onCheckedChange={() => toggleStatus(s)}
                    className="pointer-events-none"
                  />
                  <span className="flex items-center gap-1.5 flex-1">
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT_CLASS[s]}`} />
                    <span className="text-[var(--color-text)]">{STATUS_LABELS[s]}</span>
                  </span>
                  <span className="text-2xs font-medium text-[var(--color-text-subtle)] tabular-nums">
                    {count}
                  </span>
                </label>
              )
            })}
          </div>
          {statusActiveCount > 0 && (
            <>
              <div className="h-px bg-[var(--color-border)]" />
              <div className="px-3 py-1.5">
                <button
                  type="button"
                  className="text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                  onClick={() => {
                    for (const s of statusFilter) toggleStatus(s)
                  }}
                >
                  Clear status filter
                </button>
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* More filters button (advanced conditions: tag, talent, location, product, missing, etc.) */}
      {extraFilterCount > 0 && (
        <Button
          variant="outline"
          className="gap-1.5 border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]"
          onClick={onMoreFiltersOpen}
        >
          More filters
          <span className="ml-0.5 flex h-4.5 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)]/15 px-1 text-2xs font-semibold tabular-nums">
            {extraFilterCount}
          </span>
        </Button>
      )}
      {extraFilterCount === 0 && (
        <Button variant="ghost" size="sm" className="text-[var(--color-text-subtle)] text-xs h-9" onClick={onMoreFiltersOpen}>
          More filters
        </Button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Showing X of Y (compact, right of spacer) */}
      {totalCount > 0 && (
        <span className="text-2xs text-[var(--color-text-subtle)] tabular-nums whitespace-nowrap">
          {displayCount === totalCount ? `${totalCount} shots` : `${displayCount} of ${totalCount}`}
        </span>
      )}

      {/* Card / Table view toggle (desktop only) */}
      {!isMobile && (
        <div className="flex items-center gap-1">
          {([
            { mode: "card" as const, icon: LayoutGrid, label: "Card view", hint: "1" },
            { mode: "table" as const, icon: Table2, label: "Table view", hint: "2" },
          ] as const).map(({ mode, icon: Icon, label, hint }) => (
            <Button
              key={mode}
              variant={viewMode === mode ? "default" : "outline"}
              size="icon"
              className="relative h-9 w-9"
              onClick={() => onViewModeChange(mode)}
              aria-label={label}
              title={`${label} (${hint})`}
            >
              <Icon className="h-4 w-4" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded text-3xs font-medium text-[var(--color-text-subtle)]">
                {hint}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
