import { useState } from "react"
import type { ProductFamily, ProductSku } from "@/shared/types"
import { LoadingState } from "@/shared/components/LoadingState"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { ProductSkuCard } from "@/features/products/components/ProductSkuCard"
import { BulkCreateColorwaysDialog } from "@/features/products/components/BulkCreateColorwaysDialog"
import { Button } from "@/ui/button"
import { Palette, Pencil, Plus } from "lucide-react"

interface ProductColorwaysSectionProps {
  readonly family: ProductFamily
  readonly skuLoading: boolean
  readonly activeSkus: ReadonlyArray<ProductSku>
  readonly visibleSkus: ReadonlyArray<ProductSku>
  readonly canEdit: boolean
  readonly isFamilyDeleted: boolean
  readonly clientId: string
  readonly userId: string | null
  readonly onAddColorway?: () => void
}

export function ProductColorwaysSection({
  family,
  skuLoading,
  activeSkus,
  visibleSkus,
  canEdit,
  isFamilyDeleted,
  clientId,
  userId,
  onAddColorway,
}: ProductColorwaysSectionProps) {
  const [bulkOpen, setBulkOpen] = useState(false)
  const existingColorNames = activeSkus.map((s) => s.colorName ?? s.name ?? "").filter(Boolean)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text)]">Colorways</h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            SKU-level status, sizing, and images.
          </p>
        </div>
        {canEdit && !isFamilyDeleted && activeSkus.length > 0 && (
          <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <Plus className="h-4 w-4" />
            Quick add
          </Button>
        )}
      </div>

      {skuLoading ? (
        <LoadingState loading />
      ) : activeSkus.length === 0 ? (
        <InlineEmpty
          icon={<Palette className="h-8 w-8" />}
          title="No colorways"
          description="This product family has no SKU colorways defined."
          action={
            canEdit && !isFamilyDeleted ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Quick add
                </Button>
                {onAddColorway && (
                  <Button type="button" variant="outline" size="sm" onClick={onAddColorway}>
                    <Pencil className="h-4 w-4" />
                    Full editor
                  </Button>
                )}
              </div>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSkus.map((sku) => (
            <ProductSkuCard
              key={sku.id}
              sku={sku}
              familyImageUrl={family.thumbnailImagePath ?? family.headerImagePath}
            />
          ))}
        </div>
      )}

      <BulkCreateColorwaysDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        clientId={clientId}
        userId={userId}
        familyId={family.id}
        existingColorNames={existingColorNames}
        existingSkuCount={family.skuCount ?? 0}
        existingActiveSkuCount={family.activeSkuCount ?? 0}
        familySizes={family.sizes ?? []}
      />
    </div>
  )
}
