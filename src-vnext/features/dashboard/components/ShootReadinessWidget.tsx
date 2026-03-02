import { useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useShootReadiness } from "@/features/products/hooks/useShootReadiness"
import {
  formatLaunchDate,
  getLaunchDeadlineWarning,
} from "@/features/products/lib/assetRequirements"
import type { ShootReadinessItem } from "@/features/products/lib/shootReadiness"
import type { ShootWindow } from "@/features/products/lib/shootReadiness"
import { Badge } from "@/ui/badge"
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

function ReadinessCard({ item }: { readonly item: ShootReadinessItem }) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const tier = item.shootWindow?.tier ?? "samples_only"
  const warning = getLaunchDeadlineWarning(item.launchDate)

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

  const toggleExpanded = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setExpanded((prev) => !prev)
    },
    [],
  )

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

  if (tier === "samples_only") {
    return (
      <div
        role="button"
        tabIndex={0}
        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface)]"
        onClick={handleNavigate}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {item.familyName}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-subtle)]" />
        </div>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          {item.samplesArrived > 0
            ? `${item.samplesArrived} sample${item.samplesArrived !== 1 ? "s" : ""} arrived`
            : `${item.samplesTotal} sample${item.samplesTotal !== 1 ? "s" : ""} tracked`}
        </p>
        <p className="mt-1 text-2xs text-[var(--color-status-green-text)]">
          Samples ready &mdash; available to schedule
        </p>
      </div>
    )
  }

  // Tier "full" or "request_only"
  const hasShootWindow =
    item.shootWindow?.suggestedStart != null ||
    item.shootWindow?.suggestedEnd != null
  const constraints = item.shootWindow?.constraints ?? []

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-left transition-colors">
      <div
        role="button"
        tabIndex={0}
        className="px-3 py-2.5 hover:bg-[var(--color-surface)]"
        onClick={handleNavigate}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-text)]">
              {item.familyName}
            </span>
            {item.launchDate != null && (
              <Badge
                variant="outline"
                className={cn("text-2xs font-normal", {
                  "border-[var(--color-status-red-border)] bg-[var(--color-status-red-bg)] text-[var(--color-status-red-text)]":
                    warning === "overdue",
                  "border-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]":
                    warning === "soon",
                  "text-[var(--color-text-muted)]": warning === "ok",
                })}
              >
                Launch: {formatLaunchDate(item.launchDate)}
              </Badge>
            )}
          </div>
          {item.shootWindow && (
            <ConfidenceBadge confidence={item.shootWindow.confidence} />
          )}
        </div>

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

        {hasShootWindow && (
          <div className="mt-1.5 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <span>
              Shoot window: {formatWindowDate(item.shootWindow!.suggestedStart)}{" "}
              &ndash; {formatWindowDate(item.shootWindow!.suggestedEnd)}
            </span>
          </div>
        )}

        {item.samplesTotal > 0 && (
          <div className="mt-1.5">
            <ProgressBar pct={item.readinessPct} />
          </div>
        )}
      </div>

      {constraints.length > 0 && (
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
    </div>
  )
}

export function ShootReadinessWidget() {
  const { items, loading } = useShootReadiness()

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
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text)]">
            Shoot Readiness
          </h3>
        </div>
        <span className="text-2xs text-[var(--color-text-subtle)]">
          Next 90 days
        </span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <ReadinessCard key={item.familyId} item={item} />
        ))}
      </div>
    </div>
  )
}
