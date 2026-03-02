import { useNavigate } from "react-router-dom"
import { useShootReadiness } from "@/features/products/hooks/useShootReadiness"
import { formatLaunchDate, getLaunchDeadlineWarning } from "@/features/products/lib/assetRequirements"
import { Badge } from "@/ui/badge"
import { Skeleton } from "@/ui/skeleton"
import { CalendarClock } from "lucide-react"
import { cn } from "@/shared/lib/utils"

export function ShootReadinessWidget() {
  const { items, loading } = useShootReadiness()
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Shoot Readiness</h3>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-md" />
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
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Shoot Readiness</h3>
        </div>
        <p className="text-xs text-[var(--color-text-muted)]">
          No products with upcoming launch dates.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-[var(--color-text-muted)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Shoot Readiness</h3>
        <span className="text-xs text-[var(--color-text-subtle)]">Next 90 days</span>
      </div>

      <div className="flex flex-col gap-2">
        {items.map((item) => {
          const warning = getLaunchDeadlineWarning(item.launchDate)

          return (
            <div
              key={item.familyId}
              role="button"
              tabIndex={0}
              className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface)]"
              onClick={() => navigate(`/products/${item.familyId}?section=requirements`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  navigate(`/products/${item.familyId}?section=requirements`)
                }
              }}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--color-text)]">
                    {item.familyName}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("text-xs font-normal", {
                      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300": warning === "overdue",
                      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300": warning === "soon",
                      "text-[var(--color-text-muted)]": warning === "ok",
                    })}
                  >
                    {formatLaunchDate(item.launchDate)}
                  </Badge>
                </div>
                <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {item.totalSkus} colorway{item.totalSkus !== 1 ? "s" : ""}
                  {item.skusWithFlags > 0 && ` · ${item.skusWithFlags} needing assets`}
                  {item.samplesTotal > 0 && ` · ${item.samplesArrived}/${item.samplesTotal} samples arrived`}
                </div>
              </div>

              {item.samplesTotal > 0 && (
                <div className="flex shrink-0 items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-[var(--color-surface)]">
                    <div
                      className={cn("h-full rounded-full transition-all", {
                        "bg-green-500": item.readinessPct >= 80,
                        "bg-amber-500": item.readinessPct >= 40 && item.readinessPct < 80,
                        "bg-red-500": item.readinessPct < 40,
                      })}
                      style={{ width: `${item.readinessPct}%` }}
                    />
                  </div>
                  <span className="text-xs tabular-nums text-[var(--color-text-muted)]">
                    {item.readinessPct}%
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
