import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { formatLaunchDate } from "@/features/products/lib/assetRequirements"
import type { ShootReadinessItem } from "@/features/products/lib/shootReadiness"
import {
  useProductSelection,
  makeFamilySelectionId,
} from "@/features/products/hooks/useProductSelection"
import {
  getShootUrgency,
  getUrgencyLabel,
  getUrgencyColor,
  getUrgencyTimeText,
} from "@/features/products/lib/shootUrgency"
import { Checkbox } from "@/ui/checkbox"
import { ChevronDown, ChevronRight, Plus } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { ExpandedFamilySkus } from "./ExpandedFamilySkus"

// ---------------------------------------------------------------------------
// Gender helpers (matching DESIGN_SYSTEM.md canonical colors)
// ---------------------------------------------------------------------------

function genderLabel(gender: string | null | undefined): string {
  if (!gender) return ""
  switch (gender.toLowerCase()) {
    case "male":
    case "men":
      return "Men"
    case "female":
    case "women":
      return "Women"
    case "unisex":
      return "Unisex"
    case "non-binary":
      return "Non-Binary"
    case "other":
      return "Other"
    default:
      return gender
  }
}

function genderBadgeClasses(gender: string | null | undefined): string {
  if (!gender) return ""
  switch (gender.toLowerCase()) {
    case "male":
    case "men":
      return "border border-[var(--color-status-blue-border)] bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]"
    case "female":
    case "women":
    case "non-binary":
      return "border border-[var(--color-status-purple-border)] bg-[var(--color-status-purple-bg)] text-[var(--color-status-purple-text)]"
    default:
      return "border border-[var(--color-status-gray-border)] bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)]"
  }
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatWindowDate(date: Date | null): string {
  if (!date) return "\u2014"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)
}

function formatSampleEta(
  ts: import("firebase/firestore").Timestamp | null | undefined,
): string {
  if (!ts) return "\u2014"
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(ts.toDate())
  } catch {
    return "\u2014"
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UrgencyBadge({
  launchDate,
}: {
  readonly launchDate: ShootReadinessItem["launchDate"]
}) {
  const urgency = getShootUrgency(launchDate)
  const label = getUrgencyLabel(urgency)
  const colorClasses = getUrgencyColor(urgency)
  const timeText = getUrgencyTimeText(launchDate)

  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn(
          "inline-block rounded px-1.5 py-0.5 text-3xs font-semibold uppercase leading-none tracking-wide",
          colorClasses,
        )}
        data-testid="urgency-badge"
      >
        {label}
      </span>
      {timeText != null && (
        <span className="text-2xs text-[var(--color-text-muted)]">
          {timeText}
        </span>
      )}
    </span>
  )
}

function ProgressBar({ pct }: { readonly pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--color-surface)]">
        <div
          className={cn("h-full rounded-full transition-all", {
            "bg-[var(--color-status-green-text)]": pct >= 80,
            "bg-[var(--color-status-amber-text)]": pct >= 40 && pct < 80,
            "bg-[var(--color-status-red-text)]": pct < 40,
          })}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className="text-2xs tabular-nums text-[var(--color-text-muted)]">
        {pct}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReadinessCard — a single family row (with expand/collapse for SKUs)
// ---------------------------------------------------------------------------

export interface ReadinessCardProps {
  readonly item: ShootReadinessItem
  readonly selectionMode: boolean
  readonly isSelected: boolean
  readonly onToggle: (id: string) => void
  readonly isExpanded: boolean
  readonly onToggleExpand: (familyId: string) => void
  readonly selection: ReturnType<typeof useProductSelection>
  readonly familySkuIds: ReadonlyArray<string>
  readonly allFamilySkusSelected: boolean
  readonly someFamilySkusSelected: boolean
  readonly assignedProjects: ReadonlySet<string> | undefined
  readonly projectNames: ReadonlyMap<string, string>
  readonly skuProjectMap: ReadonlyMap<string, ReadonlySet<string>>
  readonly onQuickAdd?: () => void
}

export function ReadinessCard({
  item,
  selectionMode,
  isSelected,
  onToggle,
  isExpanded,
  onToggleExpand,
  selection,
  allFamilySkusSelected,
  someFamilySkusSelected,
  assignedProjects,
  projectNames,
  skuProjectMap,
  onQuickAdd,
}: ReadinessCardProps) {
  const [detailsExpanded, setDetailsExpanded] = useState(false)
  const navigate = useNavigate()

  const tier = item.shootWindow?.tier ?? "samples_only"
  const selectionId = makeFamilySelectionId(item.familyId, item.familyName)

  // Checkbox state: if SKU-level selections exist, show indeterminate/checked accordingly
  const checkboxChecked = selectionMode
    ? allFamilySkusSelected
      ? true
      : someFamilySkusSelected
        ? "indeterminate"
        : isSelected
    : false

  const handleNavigate = useCallback(() => {
    navigate(`/products/${item.familyId}?section=requirements`)
  }, [navigate, item.familyId])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        handleNavigate()
      }
    },
    [handleNavigate],
  )

  const handleCardClick = useCallback(() => {
    handleNavigate()
  }, [handleNavigate])

  const toggleDetails = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setDetailsExpanded((prev) => !prev)
  }, [])

  const toggleDetailsKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation()
        e.preventDefault()
        setDetailsExpanded((prev) => !prev)
      }
    },
    [],
  )

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleExpand(item.familyId)
    },
    [onToggleExpand, item.familyId],
  )

  const handleExpandKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation()
        e.preventDefault()
        onToggleExpand(item.familyId)
      }
    },
    [onToggleExpand, item.familyId],
  )

  const constraints = item.shootWindow?.constraints ?? []
  const hasShootWindow =
    item.shootWindow?.suggestedStart != null ||
    item.shootWindow?.suggestedEnd != null

  const ExpandIcon = isExpanded ? ChevronDown : ChevronRight

  const cardBody = (
    <div
      className={cn(
        "relative px-3 py-2.5 hover:bg-[var(--color-surface)]",
        selectionMode && "cursor-pointer",
        isSelected && "bg-[var(--color-surface)]",
      )}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-start gap-3">
        {selectionMode && (
          <div className="flex-shrink-0 pt-1">
            <Checkbox
              checked={checkboxChecked}
              onCheckedChange={() => onToggle(selectionId)}
              aria-label={`Select ${item.familyName}`}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            />
          </div>
        )}
        {/* Expand/collapse chevron */}
        <button
          type="button"
          className="flex-shrink-0 pt-0.5 text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"
          onClick={handleExpandClick}
          onKeyDown={handleExpandKey}
          aria-label={isExpanded ? "Collapse colorways" : "Expand colorways"}
          tabIndex={0}
        >
          <ExpandIcon className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="truncate text-sm font-medium text-[var(--color-text)]">
                {item.familyName}
              </span>
              {item.gender && (
                <span
                  className={cn(
                    "inline-block rounded-full px-1.5 py-0.5 text-2xs font-medium",
                    genderBadgeClasses(item.gender),
                  )}
                >
                  {genderLabel(item.gender)}
                </span>
              )}
              {tier !== "samples_only" && (
                <UrgencyBadge launchDate={item.launchDate} />
              )}
            </div>
            {/* Quick add button */}
            {onQuickAdd && (
              <button
                type="button"
                className="shrink-0 rounded p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  onQuickAdd()
                }}
                title="Add to project"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {tier === "samples_only" ? (
            <>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {item.samplesArrived > 0
                  ? `${item.samplesArrived} sample${item.samplesArrived !== 1 ? "s" : ""} arrived`
                  : `${item.samplesTotal} sample${item.samplesTotal !== 1 ? "s" : ""} tracked`}
              </p>
              <p
                className={cn(
                  "mt-1 text-2xs",
                  item.samplesArrived > 0
                    ? "text-[var(--color-status-green-text)]"
                    : "text-[var(--color-text-muted)]",
                )}
              >
                {item.samplesArrived > 0
                  ? "Samples ready \u2014 available to schedule"
                  : "Samples tracked \u2014 awaiting arrival"}
              </p>
            </>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
              <span>
                {item.totalSkus} colorway{item.totalSkus !== 1 ? "s" : ""}
              </span>
              {item.skusWithFlags > 0 && (
                <span className="text-[var(--color-status-amber-text)]">
                  {item.skusWithFlags} need shoot
                </span>
              )}
              {item.samplesTotal > 0 && (
                <span>
                  {item.samplesArrived}/{item.samplesTotal} samples arrived
                  {item.samplesArrived < item.samplesTotal && item.earliestSampleEta && (
                    <span className="text-[var(--color-status-amber-text)]">
                      {", ETA: "}{formatSampleEta(item.earliestSampleEta)}
                    </span>
                  )}
                </span>
              )}
              {assignedProjects && assignedProjects.size > 0 && (
                <span className="text-2xs text-[var(--color-status-green-text)]">
                  {assignedProjects.size === 1
                    ? `In ${projectNames.get([...assignedProjects][0]!) ?? "1 project"}`
                    : `In ${assignedProjects.size} projects`}
                </span>
              )}
            </div>
          )}

          {tier !== "samples_only" && hasShootWindow && (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span>
                Shoot window:{" "}
                {formatWindowDate(item.shootWindow!.suggestedStart)} &ndash;{" "}
                {formatWindowDate(item.shootWindow!.suggestedEnd)}
              </span>
              {item.launchDate != null && (
                <span className="text-2xs">
                  Launch: {formatLaunchDate(item.launchDate)}
                </span>
              )}
            </div>
          )}

          {item.samplesTotal > 0 && tier !== "samples_only" && (
            <div className="mt-1.5">
              <ProgressBar pct={item.readinessPct} />
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <div
      className={cn(
        "rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-left transition-colors",
        isSelected && "ring-2 ring-[var(--color-primary)]",
      )}
    >
      {cardBody}

      {/* Constraints details toggle */}
      {constraints.length > 0 && (
        <div className="border-t border-[var(--color-border)] px-3 py-1.5">
          <button
            type="button"
            className="text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"
            onClick={toggleDetails}
            onKeyDown={toggleDetailsKey}
          >
            {detailsExpanded
              ? "\u25BE Hide details"
              : "\u25B8 View details"}
          </button>
          {detailsExpanded && (
            <ul className="mt-1 flex flex-col gap-0.5">
              {constraints.map((c) => (
                <li
                  key={c}
                  className="text-2xs text-[var(--color-text-muted)]"
                >
                  &middot; {c}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Expanded SKU list */}
      {isExpanded && (
        <div className="border-t border-[var(--color-border)]">
          <ExpandedFamilySkus
            familyId={item.familyId}
            familyName={item.familyName}
            selectionMode={selectionMode}
            selection={selection}
            skuProjectMap={skuProjectMap}
            projectNames={projectNames}
          />
        </div>
      )}
    </div>
  )
}
