import { GripVertical } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/tooltip"

// ---------------------------------------------------------------------------
// Reasons reorder can be gated OFF while the user otherwise has permission.
// ALL FOUR must be representable so the user always gets a "why" + path back.
// ---------------------------------------------------------------------------

export type ReorderDisabledReason =
  | "filters" // search / filters active
  | "grouping" // scene grouping active
  | "sort" // a non-custom sort is active
  | "limit" // shots.length > REORDER_SHOT_LIMIT

const REASON_TEXT: Record<ReorderDisabledReason, string> = {
  filters: "Reordering is off while search or filters are active. Clear filters to reorder.",
  grouping: "Reordering is off while grouping is active. Clear grouping to reorder.",
  sort: "Reordering is off while a sort is active. Restore custom order to reorder.",
  limit: "Reordering is off for large projects. Use Sort + Renumber to set order instead.",
}

/**
 * Resolve the single most relevant reorder-disabled reason, in priority order.
 * Returns null when reorder is NOT gated (caller should render the live handle).
 */
export function resolveReorderDisabledReason(params: {
  readonly hasActiveFilters: boolean
  readonly hasActiveGrouping: boolean
  readonly isCustomSort: boolean
  readonly overLimit: boolean
}): ReorderDisabledReason | null {
  if (params.overLimit) return "limit"
  if (!params.isCustomSort) return "sort"
  if (params.hasActiveFilters) return "filters"
  if (params.hasActiveGrouping) return "grouping"
  return null
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type DisabledDragHandleProps = {
  readonly reason: ReorderDisabledReason
  /** Optional shot id for a per-shot testid (shot-drag-handle-<id>). */
  readonly shotId?: string
  readonly className?: string
}

/**
 * A non-interactive (disabled) drag handle. Renders the same GripVertical glyph
 * as the live handle, dimmed, with a Tooltip stating the specific reason
 * reordering is currently off and how to restore it.
 */
export function DisabledDragHandle({ reason, shotId, className }: DisabledDragHandleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            data-testid={shotId ? `shot-drag-handle-${shotId}` : "shot-drag-handle"}
            data-reorder-disabled-reason={reason}
            aria-disabled="true"
            className={`inline-flex h-7 w-7 cursor-not-allowed items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-subtle)] opacity-40 ${className ?? ""}`}
          >
            <GripVertical className="h-4 w-4" />
            <span className="sr-only">Reordering disabled</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[220px]">
          {REASON_TEXT[reason]}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
