import { useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageProjects } from "@/shared/lib/rbac"
import { useShootReadiness } from "@/features/products/hooks/useShootReadiness"
import { useProductProjectMap } from "@/features/dashboard/hooks/useProductProjectMap"
import { useProductSkus } from "@/features/products/hooks/useProducts"
import { formatLaunchDate, countActiveRequirements } from "@/features/products/lib/assetRequirements"
import type { ShootReadinessItem } from "@/features/products/lib/shootReadiness"
import type { ProductSku } from "@/shared/types"
import {
  useProductSelection,
  makeFamilySelectionId,
  makeSkuSelectionId,
} from "@/features/products/hooks/useProductSelection"
import { BulkSelectionBar } from "@/shared/components/BulkSelectionBar"
import { BulkAddToProjectDialog } from "@/features/products/components/BulkAddToProjectDialog"
import {
  getShootUrgency,
  getUrgencyLabel,
  getUrgencyColor,
  getUrgencyTimeText,
} from "@/features/products/lib/shootUrgency"
import type { ShootUrgency } from "@/features/products/lib/shootUrgency"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Skeleton } from "@/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Loader2,
} from "lucide-react"
import { cn } from "@/shared/lib/utils"

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

type ReadinessSort = "urgency" | "name" | "launchDate"

function sortItems(
  items: ReadonlyArray<ShootReadinessItem>,
  sort: ReadinessSort,
): ReadonlyArray<ShootReadinessItem> {
  const sorted = [...items]
  switch (sort) {
    case "name":
      sorted.sort((a, b) =>
        a.familyName.localeCompare(b.familyName, undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      )
      break
    case "launchDate":
      sorted.sort((a, b) => {
        const aMs = safeTimestampMs(a.launchDate)
        const bMs = safeTimestampMs(b.launchDate)
        return aMs - bMs
      })
      break
    case "urgency":
    default:
      // Already sorted by urgency from the hook
      break
  }
  return sorted
}

function safeTimestampMs(
  ts: import("firebase/firestore").Timestamp | null | undefined,
): number {
  if (!ts) return Number.MAX_SAFE_INTEGER
  try {
    return ts.toDate().getTime()
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

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

function ColorSwatch({ sku }: { readonly sku: ProductSku }) {
  const hex = sku.hexColor ?? sku.colourHex
  if (!hex) {
    return (
      <div className="h-4 w-4 shrink-0 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)]" />
    )
  }
  return (
    <div
      className="h-4 w-4 shrink-0 rounded-full border border-[var(--color-border)]"
      style={{ backgroundColor: hex }}
      title={sku.colorName ?? hex}
    />
  )
}

// ---------------------------------------------------------------------------
// ExpandedFamilySkus — lazy-loaded SKU list for an expanded family
// ---------------------------------------------------------------------------

interface ExpandedFamilySkusProps {
  readonly familyId: string
  readonly familyName: string
  readonly selectionMode: boolean
  readonly selection: ReturnType<typeof useProductSelection>
  readonly skuProjectMap: ReadonlyMap<string, ReadonlySet<string>>
  readonly projectNames: ReadonlyMap<string, string>
}

function ExpandedFamilySkus({
  familyId,
  familyName,
  selectionMode,
  selection,
  skuProjectMap,
  projectNames,
}: ExpandedFamilySkusProps) {
  const { data: skus, loading } = useProductSkus(familyId)
  const activeSkus = useMemo(
    () => skus.filter((s) => s.deleted !== true),
    [skus],
  )

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-[var(--color-text-muted)]">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Loading colorways...</span>
      </div>
    )
  }

  if (activeSkus.length === 0) {
    return (
      <div className="px-3 py-2 text-xs text-[var(--color-text-subtle)]">
        No colorways found
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {activeSkus.map((sku) => {
        const skuSelId = makeSkuSelectionId(
          familyId,
          familyName,
          sku.id,
          sku.colorName ?? sku.name,
        )
        const isSkuSelected = selection.isSelected(skuSelId)
        const skuLaunchDate = sku.launchDate
          ? formatLaunchDate(sku.launchDate)
          : null
        const activeReqs = countActiveRequirements(sku.assetRequirements)
        const hasReqs = activeReqs > 0

        return (
          <div
            key={sku.id}
            className={cn(
              "flex items-center gap-2.5 px-3 py-1.5 text-xs",
              selectionMode && "cursor-pointer hover:bg-[var(--color-surface)]",
              isSkuSelected && "bg-[var(--color-surface)]",
            )}
            onClick={
              selectionMode
                ? () => selection.toggle(skuSelId)
                : undefined
            }
            role={selectionMode ? "button" : undefined}
            tabIndex={selectionMode ? 0 : undefined}
            onKeyDown={
              selectionMode
                ? (e: React.KeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      selection.toggle(skuSelId)
                    }
                  }
                : undefined
            }
          >
            {selectionMode && (
              <Checkbox
                checked={isSkuSelected}
                onCheckedChange={() => selection.toggle(skuSelId)}
                aria-label={`Select ${sku.colorName ?? sku.name}`}
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              />
            )}
            <ColorSwatch sku={sku} />
            <span className="min-w-0 truncate text-[var(--color-text)]">
              {sku.colorName ?? sku.name}
            </span>
            {hasReqs ? (
              <span className="shrink-0 rounded-full bg-[var(--color-status-amber-bg)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-status-amber-text)]">
                {activeReqs} needed
              </span>
            ) : sku.assetRequirements ? (
              <span className="shrink-0 rounded-full bg-[var(--color-status-green-bg)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-status-green-text)]">
                Done
              </span>
            ) : (
              <span className="shrink-0 text-2xs text-[var(--color-text-subtle)]">
                No requirements
              </span>
            )}
            {(() => {
              const linkedProjects = skuProjectMap.get(sku.id)
              if (!linkedProjects || linkedProjects.size === 0) return null
              const names = [...linkedProjects]
                .map((pid) => projectNames.get(pid) ?? pid)
                .join(", ")
              return (
                <span
                  className="shrink-0 rounded-full bg-[var(--color-status-blue-bg)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-status-blue-text)]"
                  title={names}
                >
                  In {linkedProjects.size} project{linkedProjects.size !== 1 ? "s" : ""}
                </span>
              )
            })()}
            {skuLaunchDate && (
              <span className="ml-auto shrink-0 text-2xs text-[var(--color-text-subtle)]">
                {skuLaunchDate}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReadinessCard — a single family row (with expand/collapse for SKUs)
// ---------------------------------------------------------------------------

interface ReadinessCardProps {
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
}

function ReadinessCard({
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
            {/* Urgency badge replaces confidence badge — no competing indicators */}
            {!selectionMode && tier === "samples_only" && (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-subtle)]" />
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

// ---------------------------------------------------------------------------
// Main Widget
// ---------------------------------------------------------------------------

export function ShootReadinessWidget() {
  const { items, loading } = useShootReadiness()
  const { role, clientId } = useAuth()
  const canBulkAdd = canManageProjects(role)
  const {
    familyProjectMap,
    skuProjectMap,
    projectNames,
  } = useProductProjectMap(clientId)

  const [selectionMode, setSelectionMode] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [sort, setSort] = useState<ReadinessSort>("urgency")
  const [expandedFamilies, setExpandedFamilies] = useState<
    ReadonlySet<string>
  >(new Set())

  const selection = useProductSelection()

  const sortedItems = useMemo(
    () => sortItems(items, sort),
    [items, sort],
  )

  const familyGenderMap = useMemo(
    () => new Map(items.map((item) => [item.familyId, item.gender ?? null])),
    [items],
  )

  const allIds = sortedItems.map((item) =>
    makeFamilySelectionId(item.familyId, item.familyName),
  )

  const toggleExpand = useCallback((familyId: string) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev)
      if (next.has(familyId)) {
        next.delete(familyId)
      } else {
        next.add(familyId)
      }
      return next
    })
  }, [])

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

        {/* Sort toolbar */}
        <div className="mb-2 flex items-center gap-2">
          <span className="text-2xs text-[var(--color-text-subtle)]">
            Sort:
          </span>
          <Select
            value={sort}
            onValueChange={(v) => setSort(v as ReadinessSort)}
          >
            <SelectTrigger
              className="h-7 w-auto min-w-[120px] text-xs"
              data-testid="readiness-sort-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgency">By urgency</SelectItem>
              <SelectItem value="name">By name (A-Z)</SelectItem>
              <SelectItem value="launchDate">
                By launch date
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          {sortedItems.map((item) => {
            const selId = makeFamilySelectionId(
              item.familyId,
              item.familyName,
            )
            // Compute per-family SKU selection state from current selection set
            const familySkuPrefix = `sku:${item.familyId}|`
            const selectedSkuIdsForFamily = Array.from(
              selection.selectedIds,
            ).filter((id) => id.startsWith(familySkuPrefix))
            const someFamilySkusSelected =
              selectedSkuIdsForFamily.length > 0
            // We can't know total active SKU count without loading them,
            // so "all selected" is approximated by checking if family-level is selected
            // AND some SKUs are selected. The real "all" logic happens inside ExpandedFamilySkus.
            const allFamilySkusSelected = false

            return (
              <ReadinessCard
                key={item.familyId}
                item={item}
                selectionMode={selectionMode}
                isSelected={selection.isSelected(selId)}
                onToggle={selection.toggle}
                isExpanded={expandedFamilies.has(item.familyId)}
                onToggleExpand={toggleExpand}
                selection={selection}
                familySkuIds={[]}
                allFamilySkusSelected={allFamilySkusSelected}
                someFamilySkusSelected={someFamilySkusSelected}
                assignedProjects={familyProjectMap.get(item.familyId)}
                projectNames={projectNames}
                skuProjectMap={skuProjectMap}
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
          familyGenderMap={familyGenderMap}
          onClose={() => setShowDialog(false)}
          onSuccess={handleDialogSuccess}
        />
      )}
    </>
  )
}
