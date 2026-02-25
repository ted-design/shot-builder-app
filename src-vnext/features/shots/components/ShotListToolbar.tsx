import type { SortKey, GroupKey, ViewMode } from "@/features/shots/lib/shotListFilters"
import { SORT_LABELS } from "@/features/shots/lib/shotListFilters"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import {
  Search,
  X,
  ArrowUpDown,
  SlidersHorizontal,
  Eye,
  LayoutGrid,
  Table2,
  Image as ImageIcon,
  Kanban,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ShotListToolbarProps = {
  readonly queryDraft: string
  readonly onQueryDraftChange: (value: string) => void
  readonly onClearQuery: () => void
  readonly sortKey: SortKey
  readonly onSortKeyChange: (key: SortKey) => void
  readonly sortDir: "asc" | "desc"
  readonly onSortDirToggle: () => void
  readonly isCustomSort: boolean
  readonly groupKey: GroupKey
  readonly onGroupKeyChange: (key: GroupKey) => void
  readonly isMobile: boolean
  readonly viewMode: ViewMode
  readonly onViewModeChange: (mode: ViewMode) => void
  readonly activeFilterCount: number
  readonly onFiltersOpen: () => void
  readonly onDisplayOpen: () => void
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
  groupKey,
  onGroupKeyChange,
  isMobile,
  viewMode,
  onViewModeChange,
  activeFilterCount,
  onFiltersOpen,
  onDisplayOpen,
}: ShotListToolbarProps) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-[260px]">
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

      <Select value={sortKey} onValueChange={(v) => onSortKeyChange(v as SortKey)}>
        <SelectTrigger className="w-[160px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <SelectItem key={key} value={key}>
              {SORT_LABELS[key]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

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

      {!isMobile && (
        <Select value={groupKey} onValueChange={(v) => onGroupKeyChange(v as GroupKey)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Group by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No grouping</SelectItem>
            <SelectItem value="status">By status</SelectItem>
            <SelectItem value="date">By date</SelectItem>
            <SelectItem value="talent">By talent</SelectItem>
            <SelectItem value="location">By location</SelectItem>
          </SelectContent>
        </Select>
      )}

      <Button
        variant="outline"
        className="gap-2"
        onClick={onFiltersOpen}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {activeFilterCount > 0 && (
          <span className="ml-1 rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-2xs font-medium text-[var(--color-text-subtle)]">
            {activeFilterCount}
          </span>
        )}
      </Button>

      <Button
        variant="outline"
        className="gap-2"
        onClick={onDisplayOpen}
      >
        <Eye className="h-4 w-4" />
        Display
      </Button>

      {!isMobile && (
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant={viewMode === "gallery" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => onViewModeChange("gallery")}
            aria-label="Gallery view"
            title="Gallery view"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "visual" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => onViewModeChange("visual")}
            aria-label="Visual view"
            title="Visual view"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => onViewModeChange("table")}
            aria-label="Table view"
            title="Table view"
          >
            <Table2 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "board" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => onViewModeChange("board")}
            aria-label="Board view"
            title="Board view"
          >
            <Kanban className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
