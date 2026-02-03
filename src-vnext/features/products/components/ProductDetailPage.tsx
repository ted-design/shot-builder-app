import { useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { ProductImage } from "@/features/products/components/ProductImage"
import { ProductSkuCard } from "@/features/products/components/ProductSkuCard"
import { ProductUpsertDialog } from "@/features/products/components/ProductUpsertDialog"
import {
  useProductFamily,
  useProductSkus,
} from "@/features/products/hooks/useProducts"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { Pencil, Palette } from "lucide-react"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"

export default function ProductDetailPage() {
  const { fid } = useParams<{ fid: string }>()
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const canEdit = !isMobile && canManageProducts(role)
  const [editOpen, setEditOpen] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const { data: family, loading: famLoading, error: famError } = useProductFamily(fid ?? null)
  const { data: skus, loading: skuLoading } = useProductSkus(fid ?? null)

  const activeSkus = useMemo(() => skus.filter((s) => s.deleted !== true), [skus])
  const deletedSkus = useMemo(() => skus.filter((s) => s.deleted === true), [skus])

  const visibleSkus = useMemo(() => {
    const source = showDeleted ? skus : activeSkus
    const next = [...source]
    next.sort((a, b) => {
      const aName = (a.colorName ?? a.name).toLowerCase()
      const bName = (b.colorName ?? b.name).toLowerCase()
      return aName.localeCompare(bName, undefined, { numeric: true })
    })
    return next
  }, [activeSkus, showDeleted, skus])

  if (famLoading) return <LoadingState loading />

  if (famError) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{famError}</p>
      </div>
    )
  }

  if (!family) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          Product not found.
        </p>
      </div>
    )
  }

  const status = (family.status ?? "active").toLowerCase()
  const categoryLabel = family.productSubcategory ?? family.productType ?? family.category

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={family.styleName}
        breadcrumbs={[
          { label: "Products", to: "/products" },
          { label: family.styleName },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {!isMobile && deletedSkus.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2 text-xs text-[var(--color-text-muted)]"
                onClick={() => setShowDeleted((v) => !v)}
              >
                {showDeleted ? "Hide deleted" : `Show deleted (${deletedSkus.length})`}
              </Button>
            )}
            {canEdit && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        }
      />

      {/* Hero area: image + metadata */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProductImage
          src={family.headerImagePath ?? family.thumbnailImagePath}
          alt={family.styleName}
          size="lg"
          className="h-48 w-48 shrink-0 sm:h-56 sm:w-56"
        />
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            {family.styleName}
          </h2>
          {family.styleNumber && (
            <span className="text-sm text-[var(--color-text-muted)]">
              Style {family.styleNumber}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {categoryLabel && (
              <Badge
                variant="outline"
                className="w-fit text-xs font-normal text-[var(--color-text-muted)]"
              >
                {categoryLabel}
              </Badge>
            )}
            {family.gender && family.gender.trim().length > 0 && (
              <Badge
                variant="outline"
                className="w-fit text-xs font-normal text-[var(--color-text-muted)]"
              >
                {family.gender}
              </Badge>
            )}
            {family.archived && (
              <Badge
                variant="outline"
                className="w-fit text-xs font-normal text-[var(--color-text-subtle)]"
              >
                Archived
              </Badge>
            )}
            {status !== "active" && (
              <Badge
                variant="outline"
                className="w-fit text-xs font-normal text-[var(--color-text-subtle)]"
              >
                {status.split("_").join(" ")}
              </Badge>
            )}
          </div>
          <span className="text-xs text-[var(--color-text-subtle)]">
            {skuLoading
              ? "Loading colorways..."
              : `${activeSkus.length} ${activeSkus.length === 1 ? "colorway" : "colorways"}${deletedSkus.length > 0 ? ` · ${deletedSkus.length} deleted` : ""}`}
          </span>
        </div>
      </div>

      <Separator />

      {/* SKU section */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
          Colorways
        </h3>

        {skuLoading ? (
          <LoadingState loading />
        ) : activeSkus.length === 0 ? (
          <EmptyState
            icon={<Palette className="h-8 w-8" />}
            title="No colorways"
            description="This product family has no SKU colorways defined."
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleSkus.map((sku) => (
              <ProductSkuCard
                key={sku.id}
                sku={sku}
                familyImageUrl={family.headerImagePath ?? family.thumbnailImagePath}
              />
            ))}
          </div>
        )}
      </div>

      <ProductUpsertDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        family={family}
        skus={skus}
      />
    </div>
  )
}
