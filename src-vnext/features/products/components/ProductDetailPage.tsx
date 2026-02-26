import { useMemo, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { ProductImage } from "@/features/products/components/ProductImage"
import { ProductWorkspaceNav, type ProductWorkspaceSectionKey } from "@/features/products/components/ProductWorkspaceNav"
import { ProductOverviewSection } from "@/features/products/components/ProductOverviewSection"
import { ProductColorwaysSection } from "@/features/products/components/ProductColorwaysSection"
import { ProductSamplesSection } from "@/features/products/components/ProductSamplesSection"
import { ProductAssetsSection } from "@/features/products/components/ProductAssetsSection"
import { ProductActivitySection } from "@/features/products/components/ProductActivitySection"
import { setProductFamilyDeleted } from "@/features/products/lib/productWrites"
import { useProductFamily, useProductSkus } from "@/features/products/hooks/useProducts"
import { useProductComments, useProductDocuments, useProductSamples } from "@/features/products/hooks/useProductWorkspace"
import { humanizeClassificationKey } from "@/features/products/lib/productClassifications"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { parseReturnToParam } from "@/shared/lib/returnTo"
import { toast } from "@/shared/hooks/use-toast"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import {
  Activity as ActivityIcon,
  Box,
  FileText,
  LayoutDashboard,
  Palette,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react"

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

  // Data hooks
  const { data: family, loading: famLoading, error: famError } = useProductFamily(fid ?? null)
  const { data: skus, loading: skuLoading } = useProductSkus(fid ?? null)
  const { data: samples, loading: samplesLoading, error: samplesError } = useProductSamples(fid ?? null)
  const { data: comments, loading: commentsLoading, error: commentsError } = useProductComments(fid ?? null)
  const { data: documents, loading: documentsLoading, error: documentsError } = useProductDocuments(fid ?? null)

  // Derived data
  const activeSkus = useMemo(() => skus.filter((s) => s.deleted !== true), [skus])
  const deletedSkus = useMemo(() => skus.filter((s) => s.deleted === true), [skus])
  const visibleSamples = useMemo(() => samples.filter((s) => s.deleted !== true), [samples])
  const visibleComments = useMemo(() => comments.filter((c) => c.deleted !== true), [comments])
  const visibleDocuments = useMemo(() => documents.filter((d) => d.deleted !== true && typeof d.storagePath === "string" && d.storagePath.trim().length > 0), [documents])

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
      .map((s) => ({ key: s.id, label: s.colorName ?? s.name, path: s.imagePath ?? null }))
      .filter((s): s is { key: string; label: string; path: string } => typeof s.path === "string" && s.path.trim().length > 0)
  }, [skus])

  const imageAssetsCount = familyImages.length + skuImages.length
  const assetsCount = imageAssetsCount + visibleDocuments.length
  const skuPhotosCount = skuImages.length

  const visibleSkus = useMemo(() => {
    const source = showDeleted ? skus : activeSkus
    return [...source].sort((a, b) => {
      const aName = (a.colorName ?? a.name).toLowerCase()
      const bName = (b.colorName ?? b.name).toLowerCase()
      return aName.localeCompare(bName, undefined, { numeric: true })
    })
  }, [activeSkus, showDeleted, skus])

  // Nav items with count badges (M2)
  const navItems = useMemo(() => [
    { key: "overview" as const, label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "colorways" as const, label: "Colorways", icon: <Palette className="h-4 w-4" />, count: activeSkus.length },
    { key: "samples" as const, label: "Samples", icon: <Box className="h-4 w-4" />, count: visibleSamples.length },
    { key: "assets" as const, label: "Assets", icon: <FileText className="h-4 w-4" />, count: assetsCount },
    { key: "activity" as const, label: "Activity", icon: <ActivityIcon className="h-4 w-4" />, count: visibleComments.length },
  ], [activeSkus.length, assetsCount, visibleComments.length, visibleSamples.length])

  // Section routing
  const sectionParam = searchParams.get("section")
  const activeSection: ProductWorkspaceSectionKey =
    sectionParam === "colorways" || sectionParam === "samples" || sectionParam === "assets" || sectionParam === "activity" || sectionParam === "overview"
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

  // Loading / error / not found
  if (famLoading) return <LoadingState loading skeleton={<DetailPageSkeleton />} />
  if (famError) return <div className="p-8 text-center"><p className="text-sm text-[var(--color-error)]">{famError}</p></div>
  if (!family) return <div className="p-8 text-center"><p className="text-sm text-[var(--color-text-muted)]">Product not found.</p></div>

  const status = (family.status ?? "active").toLowerCase()
  const categoryRaw = family.productSubcategory ?? family.productType ?? family.category
  const categoryLabel = categoryRaw ? humanizeClassificationKey(categoryRaw) : null
  const returnTo = parseReturnToParam(searchParams.get("returnTo"))
  const isFamilyDeleted = family.deleted === true
  const detailUrl = `${location.pathname}${location.search}`
  const productsReturnTo = returnTo?.path ?? "/products"

  return (
    <ErrorBoundary>
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
              <Button variant="ghost" size="sm" className="h-9 px-2 text-xs text-[var(--color-text-muted)]" onClick={() => setShowDeleted((v) => !v)}>
                {showDeleted ? "Hide deleted" : `Show deleted (${deletedSkus.length})`}
              </Button>
            )}
            {canEdit && clientId && !isFamilyDeleted && (
              <Button variant="outline" onClick={() => navigate(`/products/${family.id}/edit?returnTo=${encodeURIComponent(detailUrl)}&productsReturnTo=${encodeURIComponent(productsReturnTo)}`)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {canEdit && clientId && isFamilyDeleted && (
              <Button variant="outline" disabled={mutating} onClick={() => setRestoreConfirmOpen(true)}>
                <RotateCcw className="h-4 w-4" />
                Restore
              </Button>
            )}
            {canEdit && clientId && !isFamilyDeleted && (
              <Button variant="ghost" className="text-[var(--color-error)] hover:text-[var(--color-error)]" disabled={mutating} onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        }
      />

      {/* Identity hero */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ProductImage
          src={family.thumbnailImagePath ?? family.headerImagePath}
          alt={family.styleName}
          size="lg"
          className="h-48 w-48 shrink-0 sm:h-56 sm:w-56"
        />
        <div className="flex flex-col gap-2">
          <h2 className="heading-section">{family.styleName}</h2>
          {family.styleNumber && <span className="text-sm text-[var(--color-text-muted)]">Style {family.styleNumber}</span>}
          {family.previousStyleNumber && <span className="text-xs text-[var(--color-text-subtle)]">Previously: {family.previousStyleNumber}</span>}
          <div className="flex flex-wrap items-center gap-2">
            {categoryLabel && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-muted)]">{categoryLabel}</Badge>}
            {family.gender && family.gender.trim().length > 0 && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-muted)]">{family.gender}</Badge>}
            {family.archived && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-subtle)]">Archived</Badge>}
            {status !== "active" && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-subtle)]">{status.split("_").join(" ")}</Badge>}
          </div>
          <span className="text-xs text-[var(--color-text-subtle)]">
            {skuLoading ? "Loading colorways..." : `${activeSkus.length} ${activeSkus.length === 1 ? "colorway" : "colorways"}${deletedSkus.length > 0 ? ` · ${deletedSkus.length} deleted` : ""}`}
          </span>
        </div>
      </div>

      <Separator />

      {/* Workspace: nav + section */}
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <ProductWorkspaceNav items={navItems} activeKey={activeSection} onChange={setSection} />
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="label-meta">Quick stats</div>
            <div className="mt-2 grid gap-1 text-xs text-[var(--color-text-muted)]">
              <div>{activeSkus.length} active colorways</div>
              <div>{skuPhotosCount} colorway photos</div>
              <div>{assetsCount} assets</div>
              <div>{visibleSamples.length} samples tracked</div>
              <div>{visibleDocuments.length} documents</div>
              <div>{visibleComments.length} comments</div>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          {activeSection === "overview" && (
            <ProductOverviewSection
              family={family}
              activeSkus={activeSkus}
              visibleSamples={visibleSamples}
              visibleComments={visibleComments}
              visibleDocuments={visibleDocuments}
              skuPhotosCount={skuPhotosCount}
              assetsCount={assetsCount}
              imageAssetsCount={imageAssetsCount}
              onSectionChange={setSection}
            />
          )}
          {activeSection === "colorways" && (
            <ProductColorwaysSection
              family={family}
              skuLoading={skuLoading}
              activeSkus={activeSkus}
              visibleSkus={visibleSkus}
              canEdit={canEdit}
              isFamilyDeleted={isFamilyDeleted}
              onAddColorway={() => navigate(`/products/${family.id}/edit?returnTo=${encodeURIComponent(detailUrl)}&productsReturnTo=${encodeURIComponent(productsReturnTo)}`)}
            />
          )}
          {activeSection === "samples" && (
            <ProductSamplesSection
              family={family}
              activeSkus={activeSkus}
              samples={samples}
              samplesLoading={samplesLoading}
              samplesError={samplesError}
              canEdit={canEdit}
              clientId={clientId}
              userId={user?.uid ?? null}
              isFamilyDeleted={isFamilyDeleted}
            />
          )}
          {activeSection === "assets" && (
            <ProductAssetsSection
              family={family}
              familyImages={familyImages}
              skuImages={skuImages}
              documents={documents}
              documentsLoading={documentsLoading}
              documentsError={documentsError}
              canEdit={canEdit}
              clientId={clientId}
              userId={user?.uid ?? null}
              userName={user?.displayName ?? null}
              userAvatar={user?.photoURL ?? null}
              isFamilyDeleted={isFamilyDeleted}
              assetsCount={assetsCount}
            />
          )}
          {activeSection === "activity" && (
            <ProductActivitySection
              family={family}
              comments={comments}
              commentsLoading={commentsLoading}
              commentsError={commentsError}
              visibleSamples={visibleSamples}
              visibleDocuments={visibleDocuments}
              canEdit={canEdit}
              clientId={clientId}
              userId={user?.uid ?? null}
              userName={user?.displayName ?? null}
              userAvatar={user?.photoURL ?? null}
              isFamilyDeleted={isFamilyDeleted}
            />
          )}
        </section>
      </div>

      {/* Family delete/restore dialogs */}
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
          void setProductFamilyDeleted({ clientId, userId: user?.uid ?? null, familyId: family.id, deleted: true })
            .then(() => toast({ title: "Deleted", description: "Product family deleted." }))
            .catch((err) => toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Failed to delete product family." }))
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
          void setProductFamilyDeleted({ clientId, userId: user?.uid ?? null, familyId: family.id, deleted: false })
            .then(() => toast({ title: "Restored", description: "Product family restored." }))
            .catch((err) => toast({ title: "Restore failed", description: err instanceof Error ? err.message : "Failed to restore product family." }))
            .finally(() => setMutating(false))
        }}
      />
    </div>
    </ErrorBoundary>
  )
}
