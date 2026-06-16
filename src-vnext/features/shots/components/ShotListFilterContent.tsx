import type { FilterCondition } from "@/features/shots/lib/filterConditions"
import { STATUS_LABELS } from "@/features/shots/lib/shotListFilters"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { FilterConditionRow } from "./FilterConditionRow"
import { AddFilterMenu } from "./AddFilterMenu"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ShotListFilterContentProps = {
  // Conditions
  readonly conditions: readonly FilterCondition[]
  readonly onAddCondition: (condition: Omit<FilterCondition, "id">) => void
  readonly onUpdateCondition: (conditionId: string, updates: Partial<Omit<FilterCondition, "id">>) => void
  readonly onRemoveCondition: (conditionId: string) => void
  // Data for value pickers
  readonly tagOptions: readonly { id: string; label: string }[]
  readonly talentRecords: readonly { id: string; name: string; projectIds?: readonly string[] }[]
  readonly locationRecords: readonly { id: string; name: string }[]
  readonly productFamilies: readonly { id: string; styleName: string }[]
  readonly projectId: string
  // Actions
  readonly hasActiveFilters: boolean
  readonly onClearFilters: () => void
  // Repair
  readonly canRepair: boolean
  readonly onRepairOpen: () => void
  /** Optional: close the surrounding popover/sheet (e.g. on Done / Repair). */
  readonly onClose?: () => void
}

// ---------------------------------------------------------------------------
// Status options (derived from canonical STATUS_LABELS)
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = (["todo", "in_progress", "on_hold", "complete"] as const).map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}))

// ---------------------------------------------------------------------------
// Component — the shared advanced-filter body. Rendered inside a toolbar-anchored
// Popover (progressive disclosure in the SAME toolbar, NOT a slide-over Sheet).
// All 9 filter fields x their operators flow through AddFilterMenu +
// FilterConditionRow (+ FilterValuePicker), reused verbatim.
// ---------------------------------------------------------------------------

export function ShotListFilterContent({
  conditions,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  tagOptions,
  talentRecords,
  locationRecords,
  productFamilies,
  projectId,
  hasActiveFilters,
  onClearFilters,
  canRepair,
  onRepairOpen,
  onClose,
}: ShotListFilterContentProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center">
        <p className="text-2xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
          Advanced filters
        </p>
      </div>

      {/* Active conditions */}
      {conditions.length === 0 ? (
        <p className="text-sm text-[var(--color-text-subtle)]">
          No active filters. Add a filter to narrow your shots.
        </p>
      ) : (
        <div className="space-y-3">
          {conditions.map((condition) => (
            <FilterConditionRow
              key={condition.field}
              condition={condition}
              onUpdate={onUpdateCondition}
              onRemove={onRemoveCondition}
              statusOptions={STATUS_OPTIONS}
              tagOptions={tagOptions}
              talentRecords={talentRecords}
              locationRecords={locationRecords}
              productFamilies={productFamilies}
              projectId={projectId}
            />
          ))}
        </div>
      )}

      {/* Add filter button */}
      <AddFilterMenu conditions={conditions} onAdd={onAddCondition} />

      <Separator />

      {/* Footer actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
        >
          Clear all filters
        </Button>
        {canRepair && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose?.()
              onRepairOpen()
            }}
          >
            Repair missing shot dates
          </Button>
        )}
        {onClose && (
          <Button size="sm" className="ml-auto" data-testid="filter-more-done" onClick={onClose}>
            Done
          </Button>
        )}
      </div>
    </div>
  )
}
