import { useCallback, useMemo, useSyncExternalStore } from "react"
import type { ProductFamily, ProductSku, ProductSample, ProductAssetType, ProductAssetFlag } from "@/shared/types"
import { ASSET_TYPES, ASSET_FLAG_OPTIONS, summarizeSkuAssetFlags } from "@/features/products/lib/assetRequirements"
import { ProductLaunchDateField } from "@/features/products/components/ProductLaunchDateField"
import { SkuRequirementsRow } from "@/features/products/components/SkuRequirementsRow"
import { updateProductSkuAssetRequirements } from "@/features/products/lib/productWorkspaceWrites"
import { toast } from "@/shared/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { ClipboardCheck, LayoutGrid, Table2 } from "lucide-react"

type ViewMode = "chips" | "table"

const STORAGE_KEY = "sb:requirements-view"

function getSnapshot(): ViewMode {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY)
    return stored === "table" ? "table" : "chips"
  } catch {
    return "chips"
  }
}

function getServerSnapshot(): ViewMode {
  return "chips"
}

function subscribe(callback: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) callback()
  }
  globalThis.addEventListener("storage", handler)
  return () => globalThis.removeEventListener("storage", handler)
}

function setViewMode(mode: ViewMode): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, mode)
    globalThis.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }))
  } catch {
    // Ignore storage errors.
  }
}

function flagColorClass(flag: ProductAssetFlag | undefined): string {
  switch (flag) {
    case "needed":
      return "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]"
    case "in_progress":
      return "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)]"
    case "delivered":
      return "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]"
    default:
      return "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
  }
}

interface ProductRequirementsSectionProps {
  readonly family: ProductFamily
  readonly activeSkus: ReadonlyArray<ProductSku>
  readonly visibleSamples: ReadonlyArray<ProductSample>
  readonly canEdit: boolean
  readonly clientId: string | null
  readonly userId: string | null
  readonly isFamilyDeleted: boolean
}

export function ProductRequirementsSection({
  family,
  activeSkus,
  visibleSamples,
  canEdit,
  clientId,
  userId,
  isFamilyDeleted,
}: ProductRequirementsSectionProps) {
  const editEnabled = canEdit && !isFamilyDeleted && !!clientId
  const summary = useMemo(() => summarizeSkuAssetFlags(activeSkus), [activeSkus])
  const viewMode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const aiCount = useMemo(() => {
    let count = 0
    for (const sku of activeSkus) {
      if (!sku.assetRequirements) continue
      for (const key of Object.keys(sku.assetRequirements)) {
        if (key === "other_label") continue
        if (sku.assetRequirements[key] === "ai_generated") count += 1
      }
    }
    return count
  }, [activeSkus])

  const handleToggleView = useCallback(() => {
    setViewMode(viewMode === "chips" ? "table" : "chips")
  }, [viewMode])

  const handleFlagChange = async (
    skuId: string,
    assetType: ProductAssetType,
    value: ProductAssetFlag,
  ) => {
    if (!clientId) return
    const sku = activeSkus.find((s) => s.id === skuId)
    const current = sku?.assetRequirements ?? {}
    const next = { ...current, [assetType]: value }
    try {
      await updateProductSkuAssetRequirements({
        clientId,
        familyId: family.id,
        skuId,
        userId,
        assetRequirements: next,
      })
    } catch (err) {
      toast({
        title: "Update failed",
        description:
          err instanceof Error ? err.message : "Could not update asset requirement.",
      })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-[var(--color-surface-subtle)] p-2 text-[var(--color-text-muted)]">
            <ClipboardCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text)]">Asset Requirements</h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Track which asset types each colorway needs and manage launch timelines.
            </p>
          </div>
        </div>
        {activeSkus.length > 0 && (
          <button
            type="button"
            onClick={handleToggleView}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
          >
            {viewMode === "chips" ? (
              <>
                <Table2 className="h-3.5 w-3.5" />
                Table view
              </>
            ) : (
              <>
                <LayoutGrid className="h-3.5 w-3.5" />
                Chip view
              </>
            )}
          </button>
        )}
      </div>

      {/* Launch date */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="label-meta">Launch date</div>
        <div className="mt-2">
          <ProductLaunchDateField
            familyId={family.id}
            clientId={clientId}
            userId={userId}
            launchDate={family.launchDate}
            canEdit={editEnabled}
          />
        </div>
      </div>

      {/* Summary badges */}
      {summary.total > 0 && (
        <div className="flex flex-wrap gap-2">
          {summary.needed > 0 && (
            <span className="rounded-md bg-[var(--color-status-amber-bg)] px-2 py-1 text-xs text-[var(--color-status-amber-text)]">
              {summary.needed} needed
            </span>
          )}
          {summary.inProgress > 0 && (
            <span className="rounded-md bg-[var(--color-status-blue-bg)] px-2 py-1 text-xs text-[var(--color-status-blue-text)]">
              {summary.inProgress} in progress
            </span>
          )}
          {summary.delivered > 0 && (
            <span className="rounded-md bg-[var(--color-status-green-bg)] px-2 py-1 text-xs text-[var(--color-status-green-text)]">
              {summary.delivered} delivered
            </span>
          )}
          {aiCount > 0 && (
            <span className="rounded-md bg-[var(--color-status-purple-bg)] px-2 py-1 text-xs text-[var(--color-status-purple-text)]">
              {aiCount} AI &#x2726;
            </span>
          )}
        </div>
      )}

      {/* Per-colorway requirements */}
      {activeSkus.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No colorways yet. Add colorways to set asset requirements.
          </p>
        </div>
      ) : viewMode === "chips" ? (
        <div className="flex flex-col gap-3">
          {activeSkus.map((sku) => (
            <SkuRequirementsRow
              key={sku.id}
              sku={sku}
              familyLaunchDate={family.launchDate}
              canEdit={editEnabled}
              clientId={clientId}
              userId={userId}
              familyId={family.id}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]">
                  Colorway
                </th>
                {ASSET_TYPES.map((at) => (
                  <th
                    key={at.key}
                    className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-muted)]"
                  >
                    {at.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSkus.map((sku) => (
                <tr key={sku.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="px-3 py-2 text-sm text-[var(--color-text)]">
                    {sku.colorName ?? sku.name}
                  </td>
                  {ASSET_TYPES.map((at) => {
                    const flag = sku.assetRequirements?.[at.key]
                    return (
                      <td key={at.key} className="px-3 py-2">
                        {editEnabled ? (
                          <Select
                            value={flag ?? "not_needed"}
                            onValueChange={(v) =>
                              void handleFlagChange(sku.id, at.key, v as ProductAssetFlag)
                            }
                          >
                            <SelectTrigger className="h-7 w-[120px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ASSET_FLAG_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-2xs ${flagColorClass(flag)}`}
                          >
                            {flag
                              ? (ASSET_FLAG_OPTIONS.find((o) => o.value === flag)?.label ?? "\u2014")
                              : "\u2014"}
                          </span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Sample readiness summary */}
      {visibleSamples.length > 0 && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="label-meta">Sample readiness</div>
          <div className="mt-2 text-xs text-[var(--color-text-muted)]">
            {visibleSamples.filter((s) => s.status === "arrived").length} of{" "}
            {visibleSamples.length} samples arrived
          </div>
        </div>
      )}
    </div>
  )
}
