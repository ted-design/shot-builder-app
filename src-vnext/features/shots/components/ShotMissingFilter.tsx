import { useState } from "react"
import type { MissingKey } from "@/features/shots/lib/shotListFilters"
import type { computeInsights } from "@/features/shots/lib/shotListFilters"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import { CircleSlash } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Insights = ReturnType<typeof computeInsights>

type ShotMissingFilterProps = {
  readonly insights: Insights
  readonly missingFilter: ReadonlySet<MissingKey>
  readonly toggleMissing: (key: MissingKey) => void
  readonly clearMissingFilter: () => void
}

// ---------------------------------------------------------------------------
// Missing keys + labels (canonical order)
// ---------------------------------------------------------------------------

const MISSING_ORDER: readonly MissingKey[] = [
  "products",
  "talent",
  "location",
  "image",
]

const MISSING_LABELS: Record<MissingKey, string> = {
  products: "Products",
  talent: "Talent",
  location: "Location",
  image: "Hero Image",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotMissingFilter({
  insights,
  missingFilter,
  toggleMissing,
  clearMissingFilter,
}: ShotMissingFilterProps) {
  const [open, setOpen] = useState(false)

  const activeCount = missingFilter.size

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-testid="filter-missing-trigger"
          className={`gap-1.5 ${activeCount > 0 ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]" : ""}`}
        >
          <CircleSlash className="h-3.5 w-3.5" />
          Missing
          {activeCount > 0 && (
            <span className="ml-0.5 flex h-4.5 min-w-4 items-center justify-center rounded-full bg-[var(--color-primary)]/15 px-1 text-2xs font-semibold tabular-nums">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <div className="px-3 pt-2.5 pb-1">
          <p className="text-2xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
            Filter by Missing
          </p>
        </div>
        <div className="py-1">
          {MISSING_ORDER.map((key) => {
            const count = insights.missingCounts[key] ?? 0
            const active = missingFilter.has(key)
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-[var(--color-surface-subtle)]"
                data-testid={`filter-missing-option-${key}`}
              >
                <Checkbox
                  checked={active}
                  onCheckedChange={() => toggleMissing(key)}
                  className="pointer-events-none"
                />
                <span className="flex-1 text-[var(--color-text)]">
                  {MISSING_LABELS[key]}
                </span>
                <span className="flex h-4.5 min-w-4 items-center justify-center rounded-full bg-[var(--color-status-amber-bg)] px-1 text-2xs font-semibold tabular-nums text-[var(--color-status-amber-text)]">
                  {count}
                </span>
              </label>
            )
          })}
        </div>
        {activeCount > 0 && (
          <>
            <div className="h-px bg-[var(--color-border)]" />
            <div className="px-3 py-1.5">
              <button
                type="button"
                data-testid="filter-missing-clear"
                className="text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                onClick={clearMissingFilter}
              >
                Clear missing filter
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
