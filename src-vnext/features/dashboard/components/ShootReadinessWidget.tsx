import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageProjects } from "@/shared/lib/rbac"
import { useShootReadiness } from "@/features/products/hooks/useShootReadiness"
import { formatLaunchDate } from "@/features/products/lib/assetRequirements"
import type { ShootReadinessItem } from "@/features/products/lib/shootReadiness"
import type { ShootWindow } from "@/features/products/lib/shootReadiness"
import {
  useProductSelection,
  makeFamilySelectionId,
} from "@/features/products/hooks/useProductSelection"
import { BulkSelectionBar } from "@/shared/components/BulkSelectionBar"
import { BulkAddToProjectDialog } from "@/features/products/components/BulkAddToProjectDialog"
import {
  getShootUrgency,
  getUrgencyLabel,
  getUrgencyColor,
  getUrgencyTimeText,
} from "@/features/products/lib/shootUrgency"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Skeleton } from "@/ui/skeleton"
import { CalendarClock, ChevronRight } from "lucide-react"
import { cn } from "@/shared/lib/utils"

function formatWindowDate(date: Date | null): string {
  if (!date) return "\u2014"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date)
}

function ConfidenceBadge({
  confidence,
}: {
  readonly confidence: ShootWindow["confidence"]
}) {
  return (
    <Badge
      variant="outline"
      className={cn("text-2xs font-normal", {
        "border-[var(--color-status-green-border)] bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]":
          confidence === "high",
        "border-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]":
          confidence === "medium",
        "border-[var(--color-status-red-border)] bg-[var(--color-status-red-bg)] text-[var(--color-status-red-text)]":
          confidence === "low",
      })}
    >
      {confidence === "high" && "High \u2713"}
      {confidence === "medium" && "Medium"}
      {confidence === "low" && "Low"}
    </Badge>
  )
}

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

interface ReadinessCardProps {
  readonly item: ShootReadinessItem
  readonly selectionMode: boolean
  readonly isSelected: boolean
  readonly onToggle: (id: string) => void
}

function ReadinessCard({
  item,
  selectionMode,
  isSelected,
  onToggle,
}: ReadinessCardProps) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const tier = item.shootWindow?.tier ?? "samples_only"
  const selectionId = makeFamilySelectionId(item.familyId, item.familyName)

  const handleNavigate = useCallback(() => {
    if (selectionMode) return
    navigate(`/products/${item.familyId}?section=requirements`)
  }, [navigate, item.familyId, selectionMode])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        if (selectionMode) {
          onToggle(selectionId)
        } else {
          handleNavigate()
        }
      }
    },
    [handleNavigate, selectionMode, onToggle, selectionId],
  )

  const handleCardClick = useCallback(() => {
    if (selectionMode) {
      onToggle(selectionId)
    } else {
      handleNavigate()
    }
  }, [selectionMode, onToggle, selectionId, handleNavigate])

  const toggleExpanded = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded((prev) => !prev)
  }, [])

  const toggleExpandedKey = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.stopPropagation()
        e.preventDefault()
        setExpanded((prev) => !prev)
      }
    },
    [],
  )

  const constraints = item.shootWindow?.constraints ?? []
  const hasShootWindow =
    item.shootWindow?.suggestedStart != null ||
    item.shootWindow?.suggestedEnd != null

  const cardBody = (
    <div
      role="button"
      tabIndex={0}
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
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggle(selectionId)}
              className="h-4 w-4 rounded border-[var(--color-border)]"
              aria-label={`Select ${item.familyName}`}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {item.familyName}
          </span>
          {tier !== "samples_only" && (
            <UrgencyBadge launchDate={item.launchDate} />
          )}
        </div>
        {tier !== "samples_only" && item.shootWindow ? (
          <ConfidenceBadge confidence={item.shootWindow.confidence} />
        ) : (
          !selectionMode && (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-subtle)]" />
          )
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
          {item.samplesTotal > 0 && (
            <span>
              {item.samplesArrived}/{item.samplesTotal} samples arrived
            </span>
          )}
        </div>
      )}

      {tier !== "samples_only" && hasShootWindow && (
        <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>
            Shoot window: {formatWindowDate(item.shootWindow!.suggestedStart)}{" "}
            &ndash; {formatWindowDate(item.shootWindow!.suggestedEnd)}
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

  if (constraints.length === 0) {
    return (
      <div
        className={cn(
          "rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-left transition-colors",
          isSelected && "ring-2 ring-[var(--color-primary)]",
        )}
      >
        {cardBody}
      </div>
    )
  }

  return (
    <div
      className={cn(
        "rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-left transition-colors",
        isSelected && "ring-2 ring-[var(--color-primary)]",
      )}
    >
      {cardBody}
      <div className="border-t border-[var(--color-border)] px-3 py-1.5">
        <button
          type="button"
          className="text-2xs text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"
          onClick={toggleExpanded}
          onKeyDown={toggleExpandedKey}
        >
          {expanded ? "\u25BE Hide details" : "\u25B8 View details"}
        </button>
        {expanded && (
          <ul className="mt-1 flex flex-col gap-0.5">
            {constraints.map((c) => (
              <li key={c} className="text-2xs text-[var(--color-text-muted)]">
                &middot; {c}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function ShootReadinessWidget() {
  const { items, loading } = useShootReadiness()
  const { role } = useAuth()
  const canBulkAdd = canManageProjects(role)

  const [selectionMode, setSelectionMode] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const selection = useProductSelection()

  const allIds = items.map((item) =>
    makeFamilySelectionId(item.familyId, item.familyName),
  )

  function handleEnterSelection() {
    setSelectionMode(true)
    selection.clearAll()
  }

  function handleExitSelection() {
    setSelectionMode(false)
    selection.clearAll()
  }

  function handleDialogSuccess() {
    setShowDialog(false)
    setSelectionMode(false)
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
          No products with upcoming launches or tracked samples.
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text)]">
              Shoot Readiness
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {!selectionMode && (
              <span className="text-2xs text-[var(--color-text-subtle)]">
                Next 90 days
              </span>
            )}
            {canBulkAdd && !selectionMode && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleEnterSelection}
                data-testid="readiness-widget-select-btn"
              >
                Select
              </Button>
            )}
            {selectionMode && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => selection.selectAll(allIds)}
                >
                  All
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleExitSelection}
                  data-testid="readiness-widget-cancel-btn"
                >
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const selId = makeFamilySelectionId(item.familyId, item.familyName)
            return (
              <ReadinessCard
                key={item.familyId}
                item={item}
                selectionMode={selectionMode}
                isSelected={selection.isSelected(selId)}
                onToggle={selection.toggle}
              />
            )
          })}
        </div>
      </div>

      {selectionMode && (
        <BulkSelectionBar
          count={selection.count}
          onAction={() => setShowDialog(true)}
          onClear={handleExitSelection}
          actionLabel="Add to Project"
        />
      )}

      {showDialog && (
        <BulkAddToProjectDialog
          selectedFamilies={selection.getSelectedFamilies()}
          selectedSkus={selection.getSelectedSkus()}
          onClose={() => setShowDialog(false)}
          onSuccess={handleDialogSuccess}
        />
      )}
    </>
  )
}
