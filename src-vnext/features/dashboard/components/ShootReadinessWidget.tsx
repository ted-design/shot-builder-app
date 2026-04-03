import { useState, useCallback, useMemo } from "react"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageProjects } from "@/shared/lib/rbac"
import { useShootReadiness } from "@/features/products/hooks/useShootReadiness"
import { useProductProjectMap } from "@/features/dashboard/hooks/useProductProjectMap"
import {
  useProductSelection,
  makeFamilySelectionId,
} from "@/features/products/hooks/useProductSelection"
import { BulkAddToProjectDialog } from "@/features/products/components/BulkAddToProjectDialog"
import { BulkClearLaunchDatesDialog } from "./BulkClearLaunchDatesDialog"
import { Button } from "@/ui/button"
import { Skeleton } from "@/ui/skeleton"
import { CalendarClock, Plus } from "lucide-react"
import {
  sortItems,
  filterReadinessItems,
  type ReadinessSort,
  type SampleFilter,
} from "../lib/readinessFilters"
import { ReadinessToolbar } from "./ReadinessToolbar"
import { ReadinessCard } from "./ReadinessCard"

// ---------------------------------------------------------------------------
// localStorage persistence for filter state
// ---------------------------------------------------------------------------

const FILTER_KEY = "sb:readiness-requirements-filter"

function getPersistedRequirementsFilter(): boolean {
  try {
    return globalThis.localStorage?.getItem(FILTER_KEY) === "true"
  } catch {
    return false
  }
}

function persistRequirementsFilter(value: boolean): void {
  try {
    globalThis.localStorage?.setItem(FILTER_KEY, String(value))
  } catch {
    // Ignore storage errors
  }
}

// ---------------------------------------------------------------------------
// Main Widget
// ---------------------------------------------------------------------------

export function ShootReadinessWidget() {
  const { items, loading } = useShootReadiness()
  const { role, clientId } = useAuth()
  const canBulkAdd = canManageProjects(role)
  const {
    familyProjectMap,
    skuProjectMap,
    projectNames,
  } = useProductProjectMap(clientId)

  // Selection state — always active (no toggle mode)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const selection = useProductSelection()

  // Sort + filter state
  const [sort, setSort] = useState<ReadinessSort>("urgency")
  const [query, setQuery] = useState("")
  const [requireShootRequirements, setRequireShootRequirements] = useState(getPersistedRequirementsFilter)
  const [sampleFilter, setSampleFilter] = useState<SampleFilter>("all")

  // Expand state
  const [expandedFamilies, setExpandedFamilies] = useState<ReadonlySet<string>>(new Set())

  // Apply sort + filters
  const sortedItems = useMemo(() => sortItems(items, sort), [items, sort])
  const filteredItems = useMemo(
    () =>
      filterReadinessItems(sortedItems, {
        query,
        requireShootRequirements,
        sampleFilter,
      }),
    [sortedItems, query, requireShootRequirements, sampleFilter],
  )

  const familyGenderMap = useMemo(
    () => new Map(items.map((item) => [item.familyId, item.gender ?? null])),
    [items],
  )

  const handleRequirementsToggle = useCallback((value: boolean) => {
    setRequireShootRequirements(value)
    persistRequirementsFilter(value)
  }, [])

  const toggleExpand = useCallback((familyId: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(familyId)) {
        next.delete(familyId)
      } else {
        next.add(familyId)
      }
      return next
    })
  }, [])

  function handleSelectAll() {
    const allIds = filteredItems.map((item) =>
      makeFamilySelectionId(item.familyId, item.familyName),
    )
    selection.selectAll(allIds)
  }

  function handleDialogSuccess() {
    setShowAddDialog(false)
    selection.clearAll()
  }

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Shoot Readiness
          </h3>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-md" />
          ))}
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Shoot Readiness
          </h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          No products with upcoming launches, tracked samples, or shoot requirements.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        {/* Header */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Shoot Readiness
            </h3>
          </div>
          {canBulkAdd && selection.count > 0 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleSelectAll}
              >
                All
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={selection.clearAll}
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Toolbar: search, sort, filters */}
        <ReadinessToolbar
          query={query}
          onQueryChange={setQuery}
          sort={sort}
          onSortChange={setSort}
          requireShootRequirements={requireShootRequirements}
          onRequireShootRequirementsChange={handleRequirementsToggle}
          sampleFilter={sampleFilter}
          onSampleFilterChange={setSampleFilter}
          itemCount={sortedItems.length}
          filteredCount={filteredItems.length}
        />

        {/* Card list */}
        {filteredItems.length === 0 ? (
          <p className="py-6 text-center text-xs text-[var(--color-text-muted)]">
            No products match the current filters.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredItems.map((item) => {
              const selId = makeFamilySelectionId(
                item.familyId,
                item.familyName,
              )
              const familySkuPrefix = `sku:${item.familyId}|`
              const selectedSkuIdsForFamily = Array.from(
                selection.selectedIds,
              ).filter((id) => id.startsWith(familySkuPrefix))
              const someFamilySkusSelected = selectedSkuIdsForFamily.length > 0
              const allFamilySkusSelected = false

              return (
                <ReadinessCard
                  key={item.familyId}
                  item={item}
                  selectionMode={canBulkAdd}
                  isSelected={selection.isSelected(selId)}
                  onToggle={selection.toggle}
                  isExpanded={expandedFamilies.has(item.familyId)}
                  onToggleExpand={toggleExpand}
                  selection={selection}
                  familySkuIds={[]}
                  allFamilySkusSelected={allFamilySkusSelected}
                  someFamilySkusSelected={someFamilySkusSelected}
                  assignedProjects={familyProjectMap.get(item.familyId)}
                  projectNames={projectNames}
                  skuProjectMap={skuProjectMap}
                  onQuickAdd={canBulkAdd ? () => {
                    selection.clearAll()
                    selection.toggle(selId)
                    setShowAddDialog(true)
                  } : undefined}
                />
              )
            })}
          </div>
        )}
      </div>

      {/* Sticky selection bar with dual actions */}
      {canBulkAdd && selection.count > 0 && (
        <div className="sticky bottom-0 z-10 mt-2">
          <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-lg">
            <span className="text-sm text-[var(--color-text-muted)]">
              {selection.count} {selection.count === 1 ? "item" : "items"} selected
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={selection.clearAll}>
                Clear
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowClearDialog(true)}>
                Clear Dates
              </Button>
              <Button type="button" size="sm" onClick={() => setShowAddDialog(true)}>
                Add to Project
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAddDialog && (
        <BulkAddToProjectDialog
          selectedFamilies={selection.getSelectedFamilies()}
          selectedSkus={selection.getSelectedSkus()}
          familyGenderMap={familyGenderMap}
          onClose={() => setShowAddDialog(false)}
          onSuccess={handleDialogSuccess}
        />
      )}

      {showClearDialog && (
        <BulkClearLaunchDatesDialog
          selectedFamilies={selection.getSelectedFamilies()}
          onClose={() => setShowClearDialog(false)}
          onSuccess={() => {
            setShowClearDialog(false)
            selection.clearAll()
          }}
        />
      )}
    </div>
  )
}
