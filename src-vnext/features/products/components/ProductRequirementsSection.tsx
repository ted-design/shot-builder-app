import { useMemo } from "react"
import type { ProductFamily, ProductSku, ProductSample, ProductAssetType, ProductAssetFlag } from "@/shared/types"
import { ASSET_TYPES, ASSET_FLAG_OPTIONS, summarizeSkuAssetFlags } from "@/features/products/lib/assetRequirements"
import { ProductLaunchDateField } from "@/features/products/components/ProductLaunchDateField"
import { updateProductSkuAssetRequirements } from "@/features/products/lib/productWorkspaceWrites"
import { toast } from "@/shared/hooks/use-toast"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { ClipboardCheck } from "lucide-react"

interface ProductRequirementsSectionProps {
  readonly family: ProductFamily
  readonly activeSkus: ReadonlyArray<ProductSku>
  readonly visibleSamples: ReadonlyArray<ProductSample>
  readonly canEdit: boolean
  readonly clientId: string | null
  readonly userId: string | null
  readonly isFamilyDeleted: boolean
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
        </div>
      )}

      {/* Per-colorway asset flags table */}
      {activeSkus.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            No colorways yet. Add colorways to set asset requirements.
          </p>
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
                              ? (ASSET_FLAG_OPTIONS.find((o) => o.value === flag)?.label ?? "—")
                              : "—"}
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
