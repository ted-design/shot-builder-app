import { useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { ProductImage } from "@/features/products/components/ProductImage"
import { ProductSkuCard } from "@/features/products/components/ProductSkuCard"
import { ProductUpsertDialog } from "@/features/products/components/ProductUpsertDialog"
import { setProductFamilyDeleted } from "@/features/products/lib/productWrites"
import {
  useProductFamily,
  useProductSkus,
} from "@/features/products/hooks/useProducts"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { Pencil, Palette, RotateCcw, Trash2 } from "lucide-react"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { parseReturnToParam } from "@/shared/lib/returnTo"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { toast } from "@/shared/hooks/use-toast"

export default function ProductDetailPage() {
  const { fid } = useParams<{ fid: string }>()
  const [searchParams] = useSearchParams()
  const { role, clientId, user } = useAuth()
  const isMobile = useIsMobile()
  const canEdit = !isMobile && canManageProducts(role)
  const [editOpen, setEditOpen] = useState(false)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [mutating, setMutating] = useState(false)
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
  const returnTo = parseReturnToParam(searchParams.get("returnTo"))
  const isFamilyDeleted = family.deleted === true

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={family.styleName}
        breadcrumbs={[
          { label: "Products", to: returnTo?.path ?? "/products" },
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
            {canEdit && clientId && !isFamilyDeleted && (
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {canEdit && clientId && isFamilyDeleted && (
              <Button
                variant="outline"
                disabled={mutating}
                onClick={() => setRestoreConfirmOpen(true)}
              >
                <RotateCcw className="h-4 w-4" />
                Restore
              </Button>
            )}
            {canEdit && clientId && !isFamilyDeleted && (
              <Button
                variant="ghost"
                className="text-[var(--color-error)] hover:text-[var(--color-error)]"
                disabled={mutating}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Hero area: image + metadata */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProductImage
          src={family.thumbnailImagePath ?? family.headerImagePath}
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
                familyImageUrl={family.thumbnailImagePath ?? family.headerImagePath}
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

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Delete product family?"
        description="This hides the product family from default lists and selectors. You can restore it later."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!clientId) return
          setMutating(true)
          void (async () => {
            await setProductFamilyDeleted({
              clientId,
              userId: user?.uid ?? null,
              familyId: family.id,
              deleted: true,
            })
            toast({ title: "Deleted", description: "Product family deleted." })
          })()
            .catch((err) => {
              toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : "Failed to delete product family.",
              })
            })
            .finally(() => setMutating(false))
        }}
      />

      <ConfirmDialog
        open={restoreConfirmOpen}
        onOpenChange={setRestoreConfirmOpen}
        title="Restore product family?"
        description="This makes the product family visible again in default lists and selectors."
        confirmLabel="Restore"
        onConfirm={() => {
          if (!clientId) return
          setMutating(true)
          void (async () => {
            await setProductFamilyDeleted({
              clientId,
              userId: user?.uid ?? null,
              familyId: family.id,
              deleted: false,
            })
            toast({ title: "Restored", description: "Product family restored." })
          })()
            .catch((err) => {
              toast({
                title: "Restore failed",
                description: err instanceof Error ? err.message : "Failed to restore product family.",
              })
            })
            .finally(() => setMutating(false))
        }}
      />
    </div>
  )
}
