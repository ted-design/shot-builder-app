import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/ui/card"
import { Badge } from "@/ui/badge"
import { ProductImage } from "@/features/products/components/ProductImage"
import type { ProductFamily } from "@/shared/types"

interface ProductFamilyCardProps {
  readonly family: ProductFamily
  readonly skuCount: number | null
}

export function ProductFamilyCard({ family, skuCount }: ProductFamilyCardProps) {
  const navigate = useNavigate()

  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={() => navigate(`/products/${family.id}`)}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[var(--color-surface-subtle)]">
        <ProductImage
          src={family.headerImagePath ?? family.thumbnailImagePath}
          alt={family.styleName}
          size="lg"
          className="h-full w-full rounded-none transition-transform duration-200 group-hover:scale-[1.02]"
        />
      </div>
      <CardContent className="flex flex-col gap-1 p-3">
        <span className="text-sm font-medium leading-tight text-[var(--color-text)]">
          {family.styleName}
        </span>
        <div className="flex items-center gap-2">
          {family.styleNumber && (
            <span className="text-xs text-[var(--color-text-muted)]">
              {family.styleNumber}
            </span>
          )}
          {family.category && (
            <Badge
              variant="outline"
              className="text-[10px] font-normal text-[var(--color-text-muted)]"
            >
              {family.category}
            </Badge>
          )}
        </div>
        {skuCount !== null && (
          <span className="text-xs text-[var(--color-text-subtle)]">
            {skuCount} {skuCount === 1 ? "colorway" : "colorways"}
          </span>
        )}
      </CardContent>
    </Card>
  )
}
