import type { Timestamp } from "firebase/firestore"
import type { ProductSku } from "@/shared/types"
import { EditableProductImage } from "@/features/products/components/EditableProductImage"
import { replaceProductSkuImage, removeProductSkuImage } from "@/features/products/lib/productWorkspaceWrites"
import { formatLaunchDate } from "@/features/products/lib/assetRequirements"
import { compressSizeRange } from "@/shared/lib/sizeRange"
import { toast } from "@/shared/hooks/use-toast"
import { Badge } from "@/ui/badge"

interface ProductSkuCardProps {
  readonly sku: ProductSku
  readonly familyImageUrl?: string
  readonly familyLaunchDate?: Timestamp | null
  /** Family-level sizeOptions for comparison — if SKU sizes match, they are hidden. */
  readonly familySizeOptions?: ReadonlyArray<string>
  readonly canEdit?: boolean
  readonly clientId?: string | null
  readonly userId?: string | null
  readonly familyId?: string
}

export function ProductSkuCard({
  sku,
  familyImageUrl,
  familyLaunchDate,
  familySizeOptions,
  canEdit = false,
  clientId,
  userId,
  familyId,
}: ProductSkuCardProps) {
  const name = sku.colorName ?? sku.name
  const hex = sku.hexColor ?? sku.colourHex
  const sizes = sku.sizes ?? []

  // Only show size on the card if it differs from the family-level range
  const skuSizeRange = compressSizeRange(sizes)
  const familySizeRange = compressSizeRange([...(familySizeOptions ?? [])])
  const showSize = skuSizeRange !== null && skuSizeRange !== familySizeRange

  const status = (sku.status ?? "active").toLowerCase()

  const hasCustomLaunchDate =
    sku.launchDate && familyLaunchDate
      ? sku.launchDate.toMillis() !== familyLaunchDate.toMillis()
      : !!sku.launchDate && !familyLaunchDate

  const handleImageReplace = (file: File) => {
    if (!clientId || !familyId) return
    void replaceProductSkuImage({
      clientId,
      familyId,
      skuId: sku.id,
      userId: userId ?? null,
      file,
      previousImagePath: sku.imagePath,
    }).catch((err) => {
      toast({
        title: "Upload failed",
        description: err instanceof Error ? err.message : "Failed to upload image.",
      })
    })
  }

  const handleImageRemove = sku.imagePath
    ? () => {
        if (!clientId || !familyId || !sku.imagePath) return
        void removeProductSkuImage({
          clientId,
          familyId,
          skuId: sku.id,
          userId: userId ?? null,
          previousImagePath: sku.imagePath,
        }).catch((err) => {
          toast({
            title: "Remove failed",
            description: err instanceof Error ? err.message : "Failed to remove image.",
          })
        })
      }
    : undefined

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-border-strong)]">
      <EditableProductImage
        src={sku.imagePath}
        fallbackSrc={familyImageUrl}
        alt={name}
        size="md"
        canEdit={canEdit && !!clientId && !!familyId}
        onReplace={handleImageReplace}
        onRemove={handleImageRemove}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          {hex && (
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--color-border)]"
              style={{ backgroundColor: hex }}
            />
          )}
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {name}
          </span>
          {status !== "active" && (
            <Badge
              variant="outline"
              className="text-2xs font-normal text-[var(--color-text-subtle)]"
            >
              {status.split("_").join(" ")}
            </Badge>
          )}
          {sku.archived && (
            <Badge
              variant="outline"
              className="text-2xs font-normal text-[var(--color-text-subtle)]"
            >
              Archived
            </Badge>
          )}
        </div>
        {showSize && skuSizeRange && (
          <span className="text-xs text-[var(--color-text-subtle)]">
            {skuSizeRange}
          </span>
        )}
        {hasCustomLaunchDate && sku.launchDate && (
          <span className="text-2xs text-[var(--color-text-muted)]">
            Launch: {formatLaunchDate(sku.launchDate)}
          </span>
        )}
      </div>
    </div>
  )
}
