import type { Timestamp } from "firebase/firestore"
import type { ProductSku } from "@/shared/types"
import { EditableProductImage } from "@/features/products/components/EditableProductImage"
import { replaceProductSkuImage, removeProductSkuImage } from "@/features/products/lib/productWorkspaceWrites"
import { formatLaunchDate } from "@/features/products/lib/assetRequirements"
import { toast } from "@/shared/hooks/use-toast"
import { Badge } from "@/ui/badge"

interface ProductSkuCardProps {
  readonly sku: ProductSku
  readonly familyImageUrl?: string
  readonly familyLaunchDate?: Timestamp | null
  readonly canEdit?: boolean
  readonly clientId?: string | null
  readonly userId?: string | null
  readonly familyId?: string
}

export function ProductSkuCard({
  sku,
  familyImageUrl,
  familyLaunchDate,
  canEdit = false,
  clientId,
  userId,
  familyId,
}: ProductSkuCardProps) {
  const name = sku.colorName ?? sku.name
  const hex = sku.hexColor ?? sku.colourHex
  const sizes = sku.sizes ?? []
  const sizesLabel = sizes.length > 0
    ? `${sizes.slice(0, 6).join(", ")}${sizes.length > 6 ? ` +${sizes.length - 6}` : ""}`
    : null

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
        {sku.skuCode && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {sku.skuCode}
          </span>
        )}
        {sizesLabel && (
          <span className="text-xs text-[var(--color-text-subtle)]">
            Sizes: {sizesLabel}
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
