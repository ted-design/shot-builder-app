import { useMemo, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { ProductImage } from "@/features/products/components/ProductImage"
import { ProductSkuCard } from "@/features/products/components/ProductSkuCard"
import { setProductFamilyDeleted } from "@/features/products/lib/productWrites"
import {
  useProductFamily,
  useProductSkus,
} from "@/features/products/hooks/useProducts"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import {
  FileText,
  LayoutDashboard,
  Palette,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { parseReturnToParam } from "@/shared/lib/returnTo"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { toast } from "@/shared/hooks/use-toast"
import { ProductWorkspaceNav, type ProductWorkspaceSectionKey } from "@/features/products/components/ProductWorkspaceNav"
import { Card, CardContent } from "@/ui/card"
import { cn } from "@/shared/lib/utils"

export default function ProductDetailPage() {
  const { fid } = useParams<{ fid: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { role, clientId, user } = useAuth()
  const isMobile = useIsMobile()
  const canEdit = !isMobile && canManageProducts(role)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState(false)
  const [mutating, setMutating] = useState(false)
  const { data: family, loading: famLoading, error: famError } = useProductFamily(fid ?? null)
  const { data: skus, loading: skuLoading } = useProductSkus(fid ?? null)

  const activeSkus = useMemo(() => skus.filter((s) => s.deleted !== true), [skus])
  const deletedSkus = useMemo(() => skus.filter((s) => s.deleted === true), [skus])

  const familyImages = useMemo(() => {
    if (!family) return []
    const out: Array<{ key: string; label: string; path: string }> = []
    if (family.thumbnailImagePath) out.push({ key: "thumb", label: "Thumbnail", path: family.thumbnailImagePath })
    if (family.headerImagePath && family.headerImagePath !== family.thumbnailImagePath) {
      out.push({ key: "header", label: "Header image", path: family.headerImagePath })
    }
    return out
  }, [family])

  const skuImages = useMemo(() => {
    return skus
      .filter((s) => s.deleted !== true)
      .map((s) => ({
        key: s.id,
        label: s.colorName ?? s.name,
        path: s.imagePath ?? null,
      }))
      .filter((s) => typeof s.path === "string" && s.path.trim().length > 0) as Array<{ key: string; label: string; path: string }>
  }, [skus])

  const assetsCount = familyImages.length + skuImages.length
  const skuPhotosCount = skuImages.length

  const navItems = useMemo(() => {
    return [
      { key: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
      { key: "colorways", label: "Colorways", icon: <Palette className="h-4 w-4" />, count: activeSkus.length },
      { key: "assets", label: "Assets", icon: <FileText className="h-4 w-4" />, count: assetsCount },
    ] as const
  }, [activeSkus.length, assetsCount])

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
  const detailUrl = `${location.pathname}${location.search}`
  const productsReturnTo = returnTo?.path ?? "/products"
  const sectionParam = searchParams.get("section")
  const activeSection: ProductWorkspaceSectionKey =
    sectionParam === "colorways" || sectionParam === "assets" || sectionParam === "overview"
      ? sectionParam
      : "overview"

  const setSection = (next: ProductWorkspaceSectionKey) => {
    setSearchParams((prev) => {
      const out = new URLSearchParams(prev)
      if (next === "overview") out.delete("section")
      else out.set("section", next)
      return out
    }, { replace: true })
  }

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
              <Button
                variant="outline"
                onClick={() =>
                  navigate(
                    `/products/${family.id}/edit?returnTo=${encodeURIComponent(detailUrl)}&productsReturnTo=${encodeURIComponent(productsReturnTo)}`,
                  )
                }
              >
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

      <div className="flex flex-col gap-6">
        {/* Identity hero */}
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

        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
            <ProductWorkspaceNav items={navItems} activeKey={activeSection} onChange={setSection} />
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                Quick stats
              </div>
              <div className="mt-2 grid gap-1 text-xs text-[var(--color-text-muted)]">
                <div>{activeSkus.length} active colorways</div>
                <div>{skuPhotosCount} colorway photos</div>
                <div>{assetsCount} assets</div>
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {activeSection === "overview" && (
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Explore sections</h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Colorways and assets are powered by existing fields—no extra database reads.
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card
                    className={cn("cursor-pointer transition-shadow hover:shadow-md")}
                    onClick={() => setSection("colorways")}
                    role="button"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-[var(--color-surface-subtle)] p-2 text-[var(--color-text-muted)]">
                            <Palette className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-text)]">Colorways</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              Manage SKUs, sizes, and photos.
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-[var(--color-text)]">{activeSkus.length}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {skuPhotosCount} with photos
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={cn("cursor-pointer transition-shadow hover:shadow-md")}
                    onClick={() => setSection("assets")}
                    role="button"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-[var(--color-surface-subtle)] p-2 text-[var(--color-text-muted)]">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-text)]">Assets</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              Current images attached to this product.
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-[var(--color-text)]">{assetsCount}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            images
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                    Classification
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-subtle)]">Gender</div>
                      <div className="mt-0.5 text-sm text-[var(--color-text)]">{family.gender || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-subtle)]">Type</div>
                      <div className="mt-0.5 text-sm text-[var(--color-text)]">{family.productType || "—"}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-[var(--color-text-subtle)]">Subcategory</div>
                      <div className="mt-0.5 text-sm text-[var(--color-text)]">{family.productSubcategory || "—"}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeSection === "colorways" && (
              <div className="flex flex-col gap-3">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">Colorways</h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      SKU-level status, sizing, and images.
                    </p>
                  </div>
                </div>

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
            )}

            {activeSection === "assets" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Assets</h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Images already attached to the product family and colorways.
                  </p>
                </div>

                {assetsCount === 0 ? (
                  <EmptyState
                    icon={<FileText className="h-8 w-8" />}
                    title="No assets"
                    description="No images are currently attached to this product."
                  />
                ) : (
                  <div className="flex flex-col gap-6">
                    {familyImages.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                          Family images
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {familyImages.map((img) => (
                            <Card key={img.key}>
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  <ProductImage src={img.path} alt={img.label} size="sm" />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-[var(--color-text)]">
                                      {img.label}
                                    </div>
                                    <div className="truncate text-xs text-[var(--color-text-muted)]">
                                      {img.path}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {skuImages.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                          Colorway images
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {skuImages.map((img) => (
                            <Card key={img.key}>
                              <CardContent className="p-3">
                                <div className="flex items-center gap-3">
                                  <ProductImage src={img.path} alt={img.label} size="sm" />
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-[var(--color-text)]">
                                      {img.label}
                                    </div>
                                    <div className="truncate text-xs text-[var(--color-text-muted)]">
                                      {img.path}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

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
