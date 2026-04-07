import { useState, useMemo } from "react"
import { useProductSkus } from "@/features/products/hooks/useProducts"
import { formatLaunchDate, countActiveRequirements } from "@/features/products/lib/assetRequirements"
import type { ProductSku } from "@/shared/types"
import {
  makeSkuSelectionId,
  useProductSelection,
} from "@/features/products/hooks/useProductSelection"
import { Checkbox } from "@/ui/checkbox"
import { Loader2 } from "lucide-react"
import { cn } from "@/shared/lib/utils"

// ---------------------------------------------------------------------------
// ColorSwatch — small circle showing a SKU's hex color
// ---------------------------------------------------------------------------

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

export interface ExpandedFamilySkusProps {
  readonly familyId: string
  readonly familyName: string
  readonly selectionMode: boolean
  readonly selection: ReturnType<typeof useProductSelection>
  readonly skuProjectMap: ReadonlyMap<string, ReadonlySet<string>>
  readonly projectNames: ReadonlyMap<string, string>
  readonly filterByRequirements?: boolean
}

export function ExpandedFamilySkus({
  familyId,
  familyName,
  selectionMode,
  selection,
  skuProjectMap,
  projectNames,
  filterByRequirements,
}: ExpandedFamilySkusProps) {
  const { data: skus, loading } = useProductSkus(familyId)
  const [showAll, setShowAll] = useState(false)
  const activeSkus = useMemo(
    () => skus.filter((s) => s.deleted !== true),
    [skus],
  )
  const displaySkus = useMemo(() => {
    if (!filterByRequirements || showAll) return activeSkus
    return activeSkus.filter((sku) => {
      const activeReqs = countActiveRequirements(sku.assetRequirements)
      return activeReqs > 0 || sku.launchDate != null
    })
  }, [activeSkus, filterByRequirements, showAll])

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

  if (filterByRequirements && !showAll && displaySkus.length === 0 && activeSkus.length > 0) {
    return (
      <div className="px-3 py-2 text-xs text-[var(--color-text-subtle)]">
        No colorways match the requirements filter
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {displaySkus.map((sku) => {
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
      {filterByRequirements && !showAll && displaySkus.length < activeSkus.length && (
        <div className="flex items-center justify-between px-3 py-1.5 text-2xs text-[var(--color-text-muted)]">
          <span>Showing {displaySkus.length} of {activeSkus.length} colorways</span>
          <button
            type="button"
            className="text-[var(--color-primary)] hover:underline"
            onClick={() => setShowAll(true)}
          >
            Show all
          </button>
        </div>
      )}
    </div>
  )
}
