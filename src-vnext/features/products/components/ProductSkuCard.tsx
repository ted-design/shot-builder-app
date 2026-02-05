import { ProductImage } from "@/features/products/components/ProductImage"
import { Badge } from "@/ui/badge"
import type { ProductSku } from "@/shared/types"

interface ProductSkuCardProps {
  readonly sku: ProductSku
  readonly familyImageUrl?: string
}

export function ProductSkuCard({ sku, familyImageUrl }: ProductSkuCardProps) {
  const name = sku.colorName ?? sku.name
  const hex = sku.hexColor ?? sku.colourHex
  const sizes = sku.sizes ?? []
  const sizesLabel = sizes.length > 0
    ? `${sizes.slice(0, 6).join(", ")}${sizes.length > 6 ? ` +${sizes.length - 6}` : ""}`
    : null

  const status = (sku.status ?? "active").toLowerCase()

  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-border-strong)]">
      <ProductImage
        src={sku.imagePath}
        fallbackSrc={familyImageUrl}
        alt={name}
        size="md"
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
              className="text-[10px] font-normal text-[var(--color-text-subtle)]"
            >
              {status.split("_").join(" ")}
            </Badge>
          )}
          {sku.archived && (
            <Badge
              variant="outline"
              className="text-[10px] font-normal text-[var(--color-text-subtle)]"
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
      </div>
    </div>
  )
}
