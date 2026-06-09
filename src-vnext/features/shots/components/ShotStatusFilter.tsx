import { useState } from "react"
import type { ShotFirestoreStatus } from "@/shared/types"
import type { computeInsights } from "@/features/shots/lib/shotListFilters"
import { STATUS_LABELS } from "@/features/shots/lib/shotListFilters"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import { CircleDot } from "lucide-react"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Insights = ReturnType<typeof computeInsights>

type ShotStatusFilterProps = {
  readonly insights: Insights
  readonly statusFilter: ReadonlySet<ShotFirestoreStatus>
  readonly toggleStatus: (status: ShotFirestoreStatus) => void
  readonly clearStatusFilter: () => void
}

// ---------------------------------------------------------------------------
// Status hue dots — mirror ShotStatusTapRow token usage (NO raw Tailwind colors).
// The solid "*-text" token is the saturated hue for each status; using it as a
// background gives a small filled dot that matches the status mappings.
// ---------------------------------------------------------------------------

const STATUS_DOT_CLASS: Record<ShotFirestoreStatus, string> = {
  todo: "bg-[var(--color-status-gray-text)]",
  in_progress: "bg-[var(--color-status-blue-text)]",
  on_hold: "bg-[var(--color-status-amber-text)]",
  complete: "bg-[var(--color-status-green-text)]",
}

const STATUS_ORDER: readonly ShotFirestoreStatus[] = [
  "todo",
  "in_progress",
  "on_hold",
  "complete",
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotStatusFilter({
  insights,
  statusFilter,
  toggleStatus,
  clearStatusFilter,
}: ShotStatusFilterProps) {
  const [open, setOpen] = useState(false)

  const activeCount = statusFilter.size
  const activeStatuses = STATUS_ORDER.filter((s) => statusFilter.has(s))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          data-testid="filter-status-trigger"
          className={`gap-1.5 ${activeCount > 0 ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]" : ""}`}
        >
          <CircleDot className="h-3.5 w-3.5" />
          Status
          {/* Mini status-hue dots for active selections (per mockup) */}
          {activeCount > 0 && (
            <span className="ml-0.5 flex items-center gap-0.5">
              {activeStatuses.map((s) => (
                <span
                  key={s}
                  className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[s]}`}
                />
              ))}
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
          {STATUS_ORDER.map((s) => {
            const count = insights.statusCounts[s] ?? 0
            const active = statusFilter.has(s)
            return (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-[var(--color-surface-subtle)]"
                data-testid={`filter-status-option-${s}`}
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
        {activeCount > 0 && (
          <>
            <div className="h-px bg-[var(--color-border)]" />
            <div className="px-3 py-1.5">
              <button
                type="button"
                data-testid="filter-status-clear"
                className="text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text)] transition-colors"
                onClick={clearStatusFilter}
              >
                Clear status filter
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}
