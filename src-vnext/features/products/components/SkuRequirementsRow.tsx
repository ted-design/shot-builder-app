import type { Timestamp } from "firebase/firestore"
import type { AuthUser, ProductAssetFlag, ProductAssetRequirements, ProductFamily, ProductSku } from "@/shared/types"
import { ASSET_TYPES, LEGACY_ASSET_TYPES, ASSET_FLAG_OPTIONS } from "@/features/products/lib/assetRequirements"
import { updateProductSkuAssetRequirements, updateProductSkuLaunchDateWithSync } from "@/features/products/lib/productWorkspaceWrites"
import { InlineDateField } from "@/features/products/components/InlineDateField"
import { toast } from "@/shared/hooks/use-toast"
import { AssetRequirementChip } from "@/features/products/components/AssetRequirementChip"
import { AddRequirementPopover } from "@/features/products/components/AddRequirementPopover"
import { cn } from "@/shared/lib/utils"

const TYPE_LABELS: Record<string, string> = Object.fromEntries([
  ...ASSET_TYPES.map((t) => [t.key, t.label]),
  ...LEGACY_ASSET_TYPES.map((t) => [t.key, t.label]),
])

interface SkuRequirementsRowProps {
  readonly sku: ProductSku
  readonly familyLaunchDate: Timestamp | null | undefined
  readonly canEdit: boolean
  readonly clientId: string | null
  readonly userId: string | null
  readonly familyId: string
  readonly allSkus?: ReadonlyArray<ProductSku>
  readonly family?: ProductFamily
  readonly user?: AuthUser
}

function resolveChipEntries(
  reqs: ProductAssetRequirements | null | undefined,
): ReadonlyArray<{ readonly typeKey: string; readonly flag: ProductAssetFlag }> {
  if (!reqs) return []
  const entries: Array<{ readonly typeKey: string; readonly flag: ProductAssetFlag }> = []
  for (const [key, value] of Object.entries(reqs)) {
    if (key === "other_label") continue
    if (!value || value === "not_needed") continue
    const validFlags = new Set(ASSET_FLAG_OPTIONS.map((o) => o.value))
    if (!validFlags.has(value as ProductAssetFlag)) continue
    entries.push({ typeKey: key, flag: value as ProductAssetFlag })
  }
  return entries
}

function resolveUsedKeys(reqs: ProductAssetRequirements | null | undefined): ReadonlyArray<string> {
  if (!reqs) return []
  return Object.entries(reqs)
    .filter(([key, value]) => key !== "other_label" && value && value !== "not_needed")
    .map(([key]) => key)
}

function resolveTypeLabel(typeKey: string, reqs: ProductAssetRequirements | null | undefined): string {
  if (typeKey === "other" && reqs?.other_label) {
    return String(reqs.other_label)
  }
  return TYPE_LABELS[typeKey] ?? typeKey
}

export function SkuRequirementsRow({
  sku,
  familyLaunchDate,
  canEdit,
  clientId,
  userId,
  familyId,
  allSkus,
  family,
  user,
}: SkuRequirementsRowProps) {
  const chipEntries = resolveChipEntries(sku.assetRequirements)
  const usedKeys = resolveUsedKeys(sku.assetRequirements)
  const swatchColor = sku.hexColor ?? sku.colourHex
  const colorName = sku.colorName ?? sku.name

  const handleFlagChange = async (typeKey: string, newFlag: ProductAssetFlag) => {
    if (!clientId) return
    const current = sku.assetRequirements ?? {}
    const next: ProductAssetRequirements = { ...current, [typeKey]: newFlag }
    try {
      await updateProductSkuAssetRequirements({
        clientId,
        familyId,
        skuId: sku.id,
        userId,
        assetRequirements: next,
        allSkus,
        previousSku: sku,
        previousFamily: family,
        user,
      })
    } catch (err) {
      toast({
        title: "Update failed",
        description: err instanceof Error ? err.message : "Could not update asset requirement.",
      })
    }
  }

  const handleRemove = async (typeKey: string) => {
    if (!clientId) return
    const current = sku.assetRequirements ?? {}
    const next: ProductAssetRequirements = { ...current, [typeKey]: "not_needed" }
    try {
      await updateProductSkuAssetRequirements({
        clientId,
        familyId,
        skuId: sku.id,
        userId,
        assetRequirements: next,
        allSkus,
        previousSku: sku,
        previousFamily: family,
        user,
      })
    } catch (err) {
      toast({
        title: "Remove failed",
        description: err instanceof Error ? err.message : "Could not remove asset requirement.",
      })
    }
  }

  const handleAdd = async (typeKey: string, customLabel?: string) => {
    if (!clientId) return
    const current = sku.assetRequirements ?? {}
    const next: ProductAssetRequirements = {
      ...current,
      [typeKey]: "needed" as ProductAssetFlag,
      ...(typeKey === "other" && customLabel ? { other_label: customLabel } : {}),
    }
    try {
      await updateProductSkuAssetRequirements({
        clientId,
        familyId,
        skuId: sku.id,
        userId,
        assetRequirements: next,
        allSkus,
        previousSku: sku,
        previousFamily: family,
        user,
      })
    } catch (err) {
      toast({
        title: "Add failed",
        description: err instanceof Error ? err.message : "Could not add asset requirement.",
      })
    }
  }

  const launchDateSection = (() => {
    if (canEdit && clientId && allSkus) {
      const hasCustom = sku.launchDate != null
      return (
        <InlineDateField
          value={sku.launchDate ?? familyLaunchDate ?? null}
          onChange={async (date) => {
            await updateProductSkuLaunchDateWithSync({
              clientId,
              familyId,
              skuId: sku.id,
              userId,
              launchDate: date,
              familyLaunchDate,
              allSkus,
              previousSku: sku,
              previousFamily: family,
              user,
            })
          }}
          canEdit
          label={hasCustom ? "Custom" : "Family"}
        />
      )
    }
    if (sku.launchDate) {
      return (
        <InlineDateField
          value={sku.launchDate}
          onChange={async () => {}}
          canEdit={false}
          label="Custom"
        />
      )
    }
    if (familyLaunchDate) {
      return (
        <InlineDateField
          value={familyLaunchDate}
          onChange={async () => {}}
          canEdit={false}
          label="Family"
        />
      )
    }
    return <span className="text-2xs text-[var(--color-text-muted)]">&mdash;</span>
  })()

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-3 w-3 shrink-0 rounded-full border border-[var(--color-border)]",
              !swatchColor && "bg-[var(--color-surface-subtle)]",
            )}
            style={swatchColor ? { backgroundColor: swatchColor } : undefined}
          />
          <span className="text-sm font-medium text-[var(--color-text)]">{colorName}</span>
        </div>
        {launchDateSection}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {chipEntries.map((entry) => (
          <AssetRequirementChip
            key={entry.typeKey}
            typeKey={entry.typeKey}
            typeLabel={resolveTypeLabel(entry.typeKey, sku.assetRequirements)}
            flag={entry.flag}
            onFlagChange={(newFlag) => void handleFlagChange(entry.typeKey, newFlag)}
            onRemove={() => void handleRemove(entry.typeKey)}
            canEdit={canEdit}
          />
        ))}
        {canEdit && (
          <AddRequirementPopover
            usedTypeKeys={usedKeys}
            onAdd={(typeKey, label) => void handleAdd(typeKey, label)}
            disabled={!clientId}
          />
        )}
        {chipEntries.length === 0 && !canEdit && (
          <span className="text-2xs text-[var(--color-text-muted)]">No requirements set</span>
        )}
      </div>
    </div>
  )
}
