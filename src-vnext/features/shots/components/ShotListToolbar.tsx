import { useState } from "react"
import type { SortKey, ViewMode, GroupKey, MissingKey } from "@/features/shots/lib/shotListFilters"
import { SORT_LABELS } from "@/features/shots/lib/shotListFilters"
import type { ShotFirestoreStatus } from "@/shared/types"
import type { computeInsights } from "@/features/shots/lib/shotListFilters"
import type { FilterCondition } from "@/features/shots/lib/filterConditions"
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import { ShotStatusFilter } from "@/features/shots/components/ShotStatusFilter"
import { ShotMissingFilter } from "@/features/shots/components/ShotMissingFilter"
import { ShotListFilterContent } from "@/features/shots/components/ShotListFilterContent"
import {
  Search,
  X,
  ArrowUpDown,
  LayoutGrid,
  Table2,
  Hash,
  Layers,
  RotateCcw,
  SlidersHorizontal,
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
  readonly clearStatusFilter: () => void
  readonly missingFilter: ReadonlySet<MissingKey>
  readonly toggleMissing: (key: MissingKey) => void
  readonly clearMissingFilter: () => void
  // Renumber
  readonly canReorder: boolean
  readonly hasActiveFilters: boolean
  readonly onRenumberOpen: () => void
  // Advanced (More) filter conditions — rendered in a toolbar-anchored popover
  readonly extraFilterCount: number
  readonly conditions: readonly FilterCondition[]
  readonly onAddCondition: (condition: Omit<FilterCondition, "id">) => void
  readonly onUpdateCondition: (conditionId: string, updates: Partial<Omit<FilterCondition, "id">>) => void
  readonly onRemoveCondition: (conditionId: string) => void
  readonly tagOptions: readonly { id: string; label: string }[]
  readonly talentRecords: readonly { id: string; name: string; projectIds?: readonly string[] }[]
  readonly locationRecords: readonly { id: string; name: string }[]
  readonly productFamilies: readonly { id: string; styleName: string }[]
  readonly projectId: string
  readonly onClearFilters: () => void
  readonly canRepair: boolean
  readonly onRepairOpen: () => void
  // Scene grouping
  readonly groupKey?: GroupKey
  readonly onGroupKeyChange?: (key: GroupKey) => void
  readonly hasScenes?: boolean
  // Showing count
  readonly displayCount: number
  readonly totalCount: number
}

// ---------------------------------------------------------------------------
// Sort sentinels (non-SortKey actions surfaced inside the Sort <Select>)
// ---------------------------------------------------------------------------

const SORT_RESTORE = "__restore_custom__"
const SORT_RENUMBER = "__renumber__"

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
  clearStatusFilter,
  missingFilter,
  toggleMissing,
  clearMissingFilter,
  canReorder,
  hasActiveFilters,
  onRenumberOpen,
  extraFilterCount,
  conditions,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  tagOptions,
  talentRecords,
  locationRecords,
  productFamilies,
  projectId,
  onClearFilters,
  canRepair,
  onRepairOpen,
  groupKey,
  onGroupKeyChange,
  hasScenes,
  displayCount,
  totalCount,
}: ShotListToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const handleSortChange = (value: string) => {
    if (value === SORT_RENUMBER) {
      onRenumberOpen()
      return
    }
    if (value === SORT_RESTORE) {
      onSortKeyChange("custom")
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

      {/* Sort (with Restore custom order + destructive Renumber actions) */}
      <Select value={sortKey} onValueChange={handleSortChange}>
        <SelectTrigger className="w-[160px]" data-testid="sort-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
          {/* Explicit recovery affordance — survives the inline-banner collapse.
              Only meaningful when a non-custom sort is currently active. */}
          {!isCustomSort && (
            <>
              <SelectSeparator />
              <SelectItem value={SORT_RESTORE}>
                <span className="flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore custom order
                </span>
              </SelectItem>
            </>
          )}
          {canReorder && (
            <>
              <SelectSeparator />
              {/* DESTRUCTIVE action — styled with the app's destructive token
                  (mirrors BulkActionBar's Delete variant), NOT raw red. */}
              <SelectItem
                value={SORT_RENUMBER}
                className="text-destructive focus:text-destructive"
              >
                <span className="flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  {hasActiveFilters ? "Renumber visible shots" : "Renumber to match order"}
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

      {/* Scene grouping toggle */}
      {hasScenes && onGroupKeyChange && (
        <Button
          variant="outline"
          data-testid="group-by-toggle"
          className={`gap-1.5 ${groupKey === "scene" ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]" : ""}`}
          onClick={() => onGroupKeyChange(groupKey === "scene" ? "none" : "scene")}
        >
          <Layers className="h-3.5 w-3.5" />
          Scenes
        </Button>
      )}

      {/* Inline Status filter */}
      <ShotStatusFilter
        insights={insights}
        statusFilter={statusFilter}
        toggleStatus={toggleStatus}
        clearStatusFilter={clearStatusFilter}
      />

      {/* Inline Missing filter */}
      <ShotMissingFilter
        insights={insights}
        missingFilter={missingFilter}
        toggleMissing={toggleMissing}
        clearMissingFilter={clearMissingFilter}
      />

      {/* More (advanced) filters — toolbar-anchored popover, progressive
          disclosure in the SAME toolbar (no slide-over sheet). */}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            data-testid="filter-more-trigger"
            className={`gap-1.5 ${extraFilterCount > 0 ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]" : ""}`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            More
            {extraFilterCount > 0 && (
              <span className="ml-0.5 flex h-4.5 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)]/15 px-1 text-2xs font-semibold tabular-nums">
                {extraFilterCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-80 p-3 max-h-[min(600px,calc(100vh-8rem))] overflow-y-auto"
        >
          <ShotListFilterContent
            conditions={conditions}
            onAddCondition={onAddCondition}
            onUpdateCondition={onUpdateCondition}
            onRemoveCondition={onRemoveCondition}
            tagOptions={tagOptions}
            talentRecords={talentRecords}
            locationRecords={locationRecords}
            productFamilies={productFamilies}
            projectId={projectId}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={onClearFilters}
            canRepair={canRepair}
            onRepairOpen={onRepairOpen}
            onClose={() => setMoreOpen(false)}
          />
        </PopoverContent>
      </Popover>

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
