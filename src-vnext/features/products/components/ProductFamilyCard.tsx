import { useLocation, useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { ProductImage } from "@/features/products/components/ProductImage"
import type { ProductCardPropertyVisibility } from "@/features/products/lib/productPreferences"
import type { ProductFamily } from "@/shared/types"
import { humanizeClassificationKey } from "@/features/products/lib/productClassifications"

interface ProductFamilyCardProps {
  readonly family: ProductFamily
  readonly returnTo?: string | null
  readonly properties?: ProductCardPropertyVisibility
}

const DEFAULT_PROPERTIES: ProductCardPropertyVisibility = {
  styleNumber: true,
  category: true,
  status: true,
}

export function ProductFamilyCard({ family, returnTo, properties = DEFAULT_PROPERTIES }: ProductFamilyCardProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const skuCount = family.skuCount ?? null
  const activeSkuCount = family.activeSkuCount ?? null
  const colorCount = family.colorNames?.length ?? null
  const sizeCount = family.sizeOptions?.length ?? null

  const categoryRaw = family.productSubcategory ?? family.productType ?? family.category
  const categoryLabel = categoryRaw ? humanizeClassificationKey(categoryRaw) : null
  const status = (family.status ?? "active").toLowerCase()

  const href = (() => {
    const base = `/products/${family.id}`
    const target = returnTo ?? `${location.pathname}${location.search}`
    if (!target) return base
    return `${base}?returnTo=${encodeURIComponent(target)}`
  })()

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={() => navigate(href)}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-surface-subtle)]">
        <ProductImage
          src={family.thumbnailImagePath ?? family.headerImagePath}
          alt={family.styleName}
          size="lg"
          className="h-full w-full rounded-none transition-transform duration-200 group-hover:scale-[1.02]"
        />
      </div>
      <CardContent className="flex flex-col gap-1 p-3">
        <span className="text-sm font-medium leading-tight text-[var(--color-text)]">
          {family.styleName}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {properties.styleNumber && family.styleNumber && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {family.styleNumber}
            </span>
          )}
          {properties.category && categoryLabel && (
            <Badge
              variant="outline"
              className="text-[10px] font-normal text-[var(--color-text-muted)]"
            >
              {categoryLabel}
            </Badge>
          )}
          {properties.status && (
            <>
              {family.archived && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal text-[var(--color-text-subtle)]"
                >
                  Archived
                </Badge>
              )}
              {family.deleted && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal text-[var(--color-text-subtle)]"
                >
                  Deleted
                </Badge>
              )}
              {status === "discontinued" && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-normal text-[var(--color-text-subtle)]"
                >
                  Discontinued
                </Badge>
              )}
            </>
          )}
        </div>
        <span className="text-xs text-[var(--color-text-subtle)]">
          {activeSkuCount !== null
            ? `${activeSkuCount} active ${activeSkuCount === 1 ? "colorway" : "colorways"}`
            : skuCount !== null
              ? `${skuCount} ${skuCount === 1 ? "colorway" : "colorways"}`
              : "—"}
          {colorCount !== null && ` · ${colorCount} ${colorCount === 1 ? "color" : "colors"}`}
          {sizeCount !== null && ` · ${sizeCount} ${sizeCount === 1 ? "size" : "sizes"}`}
        </span>
      </CardContent>
    </Card>
  )
}
