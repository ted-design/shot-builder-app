import { ProductImage } from "@/features/products/components/ProductImage"
import { Badge } from "@/ui/badge"
import type { ProductSku } from "@/shared/types"

interface ProductSkuCardProps {
  readonly sku: ProductSku
  readonly familyImageUrl?: string
}

export function ProductSkuCard({ sku, familyImageUrl }: ProductSkuCardProps) {
  return (
    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-colors hover:border-[var(--color-border-strong)]">
      <ProductImage
        src={sku.imagePath}
        fallbackSrc={familyImageUrl}
        alt={sku.colorName ?? sku.name}
        size="md"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {sku.colourHex && (
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-[var(--color-border)]"
              style={{ backgroundColor: sku.colourHex }}
            />
          )}
          <span className="truncate text-sm font-medium text-[var(--color-text)]">
            {sku.colorName ?? sku.name}
          </span>
        </div>
        {sku.skuCode && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {sku.skuCode}
          </span>
        )}
        {sku.sizes && sku.sizes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sku.sizes.map((size) => (
              <Badge
                key={size}
                variant="outline"
                className="text-[10px] font-normal text-[var(--color-text-subtle)]"
              >
                {size}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
