import type { ShotFirestoreStatus } from "@/shared/types"
import type { MissingKey } from "@/features/shots/lib/shotListFilters"
import { STATUS_LABELS } from "@/features/shots/lib/shotListFilters"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet"
import { Checkbox } from "@/ui/checkbox"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type TalentRecord = { readonly id: string; readonly name: string }
type LocationRecord = { readonly id: string; readonly name: string }
type TagOption = { readonly id: string; readonly label: string }

type ShotListFilterSheetProps = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly isMobile: boolean
  // Status
  readonly statusFilter: ReadonlySet<ShotFirestoreStatus>
  readonly onToggleStatus: (status: ShotFirestoreStatus) => void
  // Missing
  readonly missingFilter: ReadonlySet<MissingKey>
  readonly onToggleMissing: (key: MissingKey) => void
  // Talent
  readonly talentParam: string
  readonly onTalentChange: (talentId: string) => void
  readonly talentRecords: ReadonlyArray<TalentRecord>
  // Location
  readonly locationParam: string
  readonly onLocationChange: (locationId: string) => void
  readonly locationRecords: ReadonlyArray<LocationRecord>
  // Tags
  readonly tagFilter: ReadonlySet<string>
  readonly onToggleTag: (tagId: string) => void
  readonly tagOptions: ReadonlyArray<TagOption>
  // Actions
  readonly hasActiveFilters: boolean
  readonly onClearFilters: () => void
  // Repair
  readonly canRepair: boolean
  readonly onRepairOpen: () => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotListFilterSheet({
  open,
  onOpenChange,
  isMobile,
  statusFilter,
  onToggleStatus,
  missingFilter,
  onToggleMissing,
  talentParam,
  onTalentChange,
  talentRecords,
  locationParam,
  onLocationChange,
  locationRecords,
  tagFilter,
  onToggleTag,
  tagOptions,
  hasActiveFilters,
  onClearFilters,
  canRepair,
  onRepairOpen,
}: ShotListFilterSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Status
            </div>
            <div className="space-y-2">
              {(["todo", "in_progress", "on_hold", "complete"] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={statusFilter.has(s)}
                    onCheckedChange={(v) => {
                      if (v === "indeterminate") return
                      onToggleStatus(s)
                    }}
                  />
                  <span>{STATUS_LABELS[s]}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Missing
            </div>
            <div className="space-y-2">
              {(["products", "talent", "location", "image"] as const).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={missingFilter.has(k)}
                    onCheckedChange={(v) => {
                      if (v === "indeterminate") return
                      onToggleMissing(k)
                    }}
                  />
                  <span>{k === "image" ? "Hero image" : k}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Talent
              </div>
              <Select
                value={talentParam.trim() ? talentParam.trim() : "__any__"}
                onValueChange={(v) => onTalentChange(v === "__any__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {talentRecords.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                Location
              </div>
              <Select
                value={locationParam.trim() ? locationParam.trim() : "__any__"}
                onValueChange={(v) => onLocationChange(v === "__any__" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any</SelectItem>
                  {locationRecords.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
              Tag
            </div>
            <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              {tagOptions.length === 0 ? (
                <p className="text-xs text-[var(--color-text-subtle)]">No tags available</p>
              ) : (
                tagOptions.map((tag) => (
                  <label key={tag.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={tagFilter.has(tag.id)}
                      onCheckedChange={(v) => {
                        if (v === "indeterminate") return
                        onToggleTag(tag.id)
                      }}
                    />
                    <span>{tag.label}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
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
