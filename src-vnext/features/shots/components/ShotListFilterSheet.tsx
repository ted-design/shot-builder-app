import type { FilterCondition } from "@/features/shots/lib/filterConditions"
import { STATUS_LABELS } from "@/features/shots/lib/shotListFilters"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { FilterConditionRow } from "./FilterConditionRow"
import { AddFilterMenu } from "./AddFilterMenu"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ShotListFilterSheetProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly isMobile: boolean
  // Conditions
  readonly conditions: readonly FilterCondition[]
  readonly onAddCondition: (condition: Omit<FilterCondition, "id">) => void
  readonly onUpdateCondition: (conditionId: string, updates: Partial<Omit<FilterCondition, "id">>) => void
  readonly onRemoveCondition: (conditionId: string) => void
  // Data for value pickers
  readonly tagOptions: readonly { id: string; label: string }[]
  readonly talentRecords: readonly { id: string; name: string }[]
  readonly locationRecords: readonly { id: string; name: string }[]
  readonly productFamilies: readonly { id: string; styleName: string }[]
  // Actions
  readonly hasActiveFilters: boolean
  readonly onClearFilters: () => void
  // Repair
  readonly canRepair: boolean
  readonly onRepairOpen: () => void
}

// ---------------------------------------------------------------------------
// Status options (derived from canonical STATUS_LABELS)
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = (["todo", "in_progress", "on_hold", "complete"] as const).map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}))

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotListFilterSheet({
  open,
  onOpenChange,
  isMobile,
  conditions,
  onAddCondition,
  onUpdateCondition,
  onRemoveCondition,
  tagOptions,
  talentRecords,
  locationRecords,
  productFamilies,
  hasActiveFilters,
  onClearFilters,
  canRepair,
  onRepairOpen,
}: ShotListFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={isMobile ? "max-h-[80vh]" : "sm:max-w-md"}
      >
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="mt-4 flex flex-col gap-4 overflow-y-auto">
          {/* Active conditions */}
          {conditions.length === 0 ? (
            <p className="text-sm text-[var(--color-text-subtle)]">
              No active filters. Add a filter to narrow your shots.
            </p>
          ) : (
            <div className="space-y-3">
              {conditions.map((condition) => (
                <FilterConditionRow
                  key={condition.id}
                  condition={condition}
                  onUpdate={onUpdateCondition}
                  onRemove={onRemoveCondition}
                  statusOptions={STATUS_OPTIONS}
                  tagOptions={tagOptions}
                  talentRecords={talentRecords}
                  locationRecords={locationRecords}
                  productFamilies={productFamilies}
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
              Clear filters
            </Button>
            {canRepair && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false)
                  onRepairOpen()
                }}
              >
                Repair missing shot dates
              </Button>
            )}
            <SheetClose asChild>
              <Button size="sm">Done</Button>
            </SheetClose>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
