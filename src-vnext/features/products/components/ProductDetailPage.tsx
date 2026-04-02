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
import { ProductFilesSection } from "@/features/products/components/ProductAssetsSection"
import { ProductActivitySection } from "@/features/products/components/ProductActivitySection"
import { ProductRequirementsSection } from "@/features/products/components/ProductRequirementsSection"
import { LinkedShotsSection } from "@/features/products/components/LinkedShotsSection"
import { setProductFamilyDeleted } from "@/features/products/lib/productWrites"
import { countActiveRequirements } from "@/features/products/lib/assetRequirements"
import { useProductFamily, useProductSkus } from "@/features/products/hooks/useProducts"
import { useProductComments, useProductDocuments, useProductSamples } from "@/features/products/hooks/useProductWorkspace"
import { useLinkedShots } from "@/features/products/hooks/useLinkedShots"
import { humanizeClassificationKey } from "@/features/products/lib/productClassifications"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { parseReturnToParam } from "@/shared/lib/returnTo"
import { toast } from "@/shared/hooks/use-toast"
import { compressSizeRange } from "@/shared/lib/sizeRange"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import {
  Activity as ActivityIcon,
  Box,
  Camera,
  ClipboardCheck,
  Clock,
  FileText,
  LayoutDashboard,
  Palette,
  Pencil,
  RotateCcw,
  Trash2,
} from "lucide-react"

/** Format a Firestore Timestamp to a relative time string. */
function formatRelativeTime(ts: { toDate?: () => Date } | undefined): string {
  if (!ts || typeof ts.toDate !== "function") return ""
  const date = ts.toDate()
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return "just now"
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay < 7) return `${diffDay}d ago`

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

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
  const { groups: linkedShotGroups, totalCount: linkedShotCount, loading: linkedShotsLoading, error: linkedShotsError } = useLinkedShots(fid ?? null, clientId)

  // Derived data
  const activeSkus = useMemo(() => skus.filter((s) => s.deleted !== true), [skus])
  const deletedSkus = useMemo(() => skus.filter((s) => s.deleted === true), [skus])
  const visibleSamples = useMemo(() => samples.filter((s) => s.deleted !== true), [samples])
  const visibleComments = useMemo(() => comments.filter((c) => c.deleted !== true), [comments])
  const visibleDocuments = useMemo(() => documents.filter((d) => d.deleted !== true && typeof d.storagePath === "string" && d.storagePath.trim().length > 0), [documents])

  const filesCount = visibleDocuments.length
  const skuPhotosCount = useMemo(
    () => activeSkus.filter((s) => typeof s.imagePath === "string" && s.imagePath.trim().length > 0).length,
    [activeSkus],
  )

  const visibleSkus = useMemo(() => {
    const source = showDeleted ? skus : activeSkus
    return [...source].sort((a, b) => {
      const aName = (a.colorName ?? a.name).toLowerCase()
      const bName = (b.colorName ?? b.name).toLowerCase()
      return aName.localeCompare(bName, undefined, { numeric: true })
    })
  }, [activeSkus, showDeleted, skus])

  const activeRequirementsCount = useMemo(() => {
    let count = 0
    for (const sku of activeSkus) {
      count += countActiveRequirements(sku.assetRequirements)
    }
    return count
  }, [activeSkus])

  // Nav items with count badges
  const navItems = useMemo(() => [
    { key: "overview" as const, label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: "colorways" as const, label: "Colorways", icon: <Palette className="h-4 w-4" />, count: activeSkus.length },
    { key: "samples" as const, label: "Samples", icon: <Box className="h-4 w-4" />, count: visibleSamples.length },
    { key: "files" as const, label: "Files", icon: <FileText className="h-4 w-4" />, count: filesCount },
    { key: "requirements" as const, label: "Requirements", icon: <ClipboardCheck className="h-4 w-4" />, count: activeRequirementsCount || undefined },
    { key: "shots" as const, label: "Shots", icon: <Camera className="h-4 w-4" />, count: linkedShotCount || undefined },
    { key: "activity" as const, label: "Activity", icon: <ActivityIcon className="h-4 w-4" />, count: visibleComments.length },
  ], [activeRequirementsCount, activeSkus.length, filesCount, linkedShotCount, visibleComments.length, visibleSamples.length])

  // Section routing — treat "assets" as backward-compat alias for "files"
  const sectionParam = searchParams.get("section")
  const resolvedSection = sectionParam === "assets" ? "files" : sectionParam
  const activeSection: ProductWorkspaceSectionKey =
    resolvedSection === "colorways" || resolvedSection === "samples" || resolvedSection === "files" || resolvedSection === "requirements" || resolvedSection === "shots" || resolvedSection === "activity" || resolvedSection === "overview"
      ? resolvedSection
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
          {(() => {
            const dominant = family.styleNumbers?.[0] ?? family.styleNumber
            const aliases = (family.styleNumbers ?? []).slice(1)
            const prev = family.previousStyleNumber
            // Combine aliases and previousStyleNumber, deduplicating
            const alsoNumbers = [...new Set([...aliases, ...(prev && prev !== dominant ? [prev] : [])])]
            return (
              <>
                {dominant && <span className="text-sm font-mono text-[var(--color-text-muted)]">{dominant}</span>}
                {alsoNumbers.length > 0 && (
                  <span className="text-xs text-[var(--color-text-subtle)]">Also: {alsoNumbers.join(", ")}</span>
                )}
              </>
            )
          })()}
          <div className="flex flex-wrap items-center gap-2">
            {categoryLabel && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-muted)]">{categoryLabel}</Badge>}
            {family.gender && family.gender.trim().length > 0 && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-muted)]">{family.gender}</Badge>}
            {family.archived && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-subtle)]">Archived</Badge>}
            {status !== "active" && <Badge variant="outline" className="w-fit text-xs font-normal text-[var(--color-text-subtle)]">{status.split("_").join(" ")}</Badge>}
          </div>
          {(() => {
            const sizeRange = compressSizeRange(family.sizeOptions ?? [])
            return sizeRange ? (
              <span className="text-xs text-[var(--color-text-muted)]">Sizes: {sizeRange}</span>
            ) : null
          })()}
          {family.updatedAt && (
            <div className="flex items-center gap-1.5 mt-1">
              <Clock className="w-3 h-3 text-[var(--color-text-subtle)]" />
              <span className="text-2xs text-[var(--color-text-subtle)]">
                Updated {formatRelativeTime(family.updatedAt)}{family.updatedBy ? ` by ${family.updatedBy}` : ""}
              </span>
            </div>
          )}
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
              <div>{filesCount} files</div>
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
              filesCount={filesCount}
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
              clientId={clientId}
              userId={user?.uid ?? null}
              user={user ?? undefined}
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
          {activeSection === "files" && (
            <ProductFilesSection
              family={family}
              documents={documents}
              documentsLoading={documentsLoading}
              documentsError={documentsError}
              canEdit={canEdit}
              clientId={clientId}
              userId={user?.uid ?? null}
              userName={user?.displayName ?? null}
              userAvatar={user?.photoURL ?? null}
              isFamilyDeleted={isFamilyDeleted}
              filesCount={filesCount}
            />
          )}
          {activeSection === "requirements" && (
            <ProductRequirementsSection
              family={family}
              activeSkus={activeSkus}
              visibleSamples={visibleSamples}
              canEdit={canEdit}
              clientId={clientId}
              userId={user?.uid ?? null}
              isFamilyDeleted={isFamilyDeleted}
              user={user ?? undefined}
            />
          )}
          {activeSection === "shots" && (
            <LinkedShotsSection
              groups={linkedShotGroups}
              totalCount={linkedShotCount}
              loading={linkedShotsLoading}
              error={linkedShotsError}
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
