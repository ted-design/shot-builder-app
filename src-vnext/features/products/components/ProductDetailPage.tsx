import { useMemo, useState } from "react"
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { ProductImage } from "@/features/products/components/ProductImage"
import { ProductSkuCard } from "@/features/products/components/ProductSkuCard"
import { setProductFamilyDeleted } from "@/features/products/lib/productWrites"
import {
  useProductFamily,
  useProductSkus,
} from "@/features/products/hooks/useProducts"
import {
  useProductComments,
  useProductDocuments,
  useProductSamples,
} from "@/features/products/hooks/useProductWorkspace"
import {
  createProductComment,
  createProductDocument,
  createProductSample,
  deleteProductDocument,
  setProductCommentDeleted,
  updateProductSample,
} from "@/features/products/lib/productWorkspaceWrites"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { Badge } from "@/ui/badge"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Separator } from "@/ui/separator"
import { Textarea } from "@/ui/textarea"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/ui/sheet"
import {
  Activity as ActivityIcon,
  Box,
  Download,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Palette,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { parseReturnToParam } from "@/shared/lib/returnTo"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { toast } from "@/shared/hooks/use-toast"
import { ProductWorkspaceNav, type ProductWorkspaceSectionKey } from "@/features/products/components/ProductWorkspaceNav"
import { Card, CardContent } from "@/ui/card"
import { cn } from "@/shared/lib/utils"
import type { Timestamp } from "firebase/firestore"
import type { ProductDocument, ProductSample, ProductSampleStatus, ProductSampleType } from "@/shared/types"
import { humanizeClassificationKey } from "@/features/products/lib/productClassifications"

type SampleStatusFilter = "all" | ProductSampleStatus
type SampleTypeFilter = "all" | ProductSampleType

const SCOPE_ALL_VALUE = "__all__"

function formatDateTime(ts: Timestamp | undefined | null): string {
  if (!ts) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(ts.toDate())
  } catch {
    return "—"
  }
}

function parseDateInput(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, month, day, 12, 0, 0, 0)
  return Number.isFinite(date.getTime()) ? date : null
}

function normalizeNotesSnippet(notes: unknown): string | null {
  if (!notes) return null
  if (typeof notes === "string") {
    const trimmed = notes.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (Array.isArray(notes)) {
    const parts = notes
      .flatMap((n) => (typeof n === "string" ? [n] : []))
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length === 0) return null
    return parts.join(" · ")
  }
  return null
}

function isDocumentUsable(doc: ProductDocument): boolean {
  return doc.deleted !== true && typeof doc.storagePath === "string" && doc.storagePath.trim().length > 0
}

function sampleSortKey(sample: ProductSample): number {
  const ts = sample.updatedAt ?? sample.createdAt
  if (!ts) return 0
  try {
    return ts.toDate().getTime()
  } catch {
    return 0
  }
}

function formatBytes(bytes: number | null | undefined): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes <= 0) return "—"
  const units = ["B", "KB", "MB", "GB"]
  let idx = 0
  let value = bytes
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  const rounded = idx === 0 ? Math.round(value) : Math.round(value * 10) / 10
  return `${rounded} ${units[idx]}`
}

function DocumentRow({
  doc,
  canEdit,
  deleting = false,
  onDelete,
}: {
  readonly doc: ProductDocument
  readonly canEdit: boolean
  readonly deleting?: boolean
  readonly onDelete: (doc: ProductDocument) => void
}) {
  const url = useStorageUrl(doc.storagePath)
  const uploadedAt = formatDateTime(doc.createdAt)
  const who = doc.createdByName ?? (doc.createdBy ? "Member" : "—")

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-[var(--color-text)]">{doc.name}</div>
        <div className="truncate text-xs text-[var(--color-text-muted)]">
          {who} · {uploadedAt} · {formatBytes(doc.sizeBytes)}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="outline" size="sm" className="h-9" disabled={!url || deleting} asChild>
          <a href={url ?? "#"} target="_blank" rel="noreferrer">
            <Download className="h-4 w-4" />
            Download
          </a>
        </Button>
        {canEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 text-[var(--color-error)] hover:text-[var(--color-error)]"
            disabled={deleting}
            onClick={() => onDelete(doc)}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>
    </div>
  )
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
  const [sampleStatusFilter, setSampleStatusFilter] = useState<SampleStatusFilter>("all")
  const [sampleTypeFilter, setSampleTypeFilter] = useState<SampleTypeFilter>("all")
  const [sampleScopeSkuId, setSampleScopeSkuId] = useState<string>("")
  const [sampleSheetOpen, setSampleSheetOpen] = useState(false)
  const [activeSample, setActiveSample] = useState<ProductSample | null>(null)
  const [sampleSaving, setSampleSaving] = useState(false)
  const [sampleMutatingId, setSampleMutatingId] = useState<string | null>(null)
  const [sampleDraft, setSampleDraft] = useState<{
    readonly type: ProductSampleType
    readonly status: ProductSampleStatus
    readonly sizeRunCsv: string
    readonly carrier: string
    readonly tracking: string
    readonly eta: string
    readonly notes: string
    readonly scopeSkuId: string
  }>({
    type: "shoot",
    status: "requested",
    sizeRunCsv: "",
    carrier: "",
    tracking: "",
    eta: "",
    notes: "",
    scopeSkuId: "",
  })
  const [commentDraft, setCommentDraft] = useState("")
  const [commentSaving, setCommentSaving] = useState(false)
  const [documentUploading, setDocumentUploading] = useState(false)
  const [documentMutatingId, setDocumentMutatingId] = useState<string | null>(null)
  const [docDeleteConfirmOpen, setDocDeleteConfirmOpen] = useState(false)
  const [docToDelete, setDocToDelete] = useState<ProductDocument | null>(null)
  const [sampleDeleteConfirmOpen, setSampleDeleteConfirmOpen] = useState(false)

  const { data: family, loading: famLoading, error: famError } = useProductFamily(fid ?? null)
  const { data: skus, loading: skuLoading } = useProductSkus(fid ?? null)
  const { data: samples, loading: samplesLoading, error: samplesError } = useProductSamples(fid ?? null)
  const { data: comments, loading: commentsLoading, error: commentsError } = useProductComments(fid ?? null)
  const { data: documents, loading: documentsLoading, error: documentsError } = useProductDocuments(fid ?? null)

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

  const visibleDocuments = useMemo(() => documents.filter(isDocumentUsable), [documents])
  const visibleSamples = useMemo(() => samples.filter((s) => s.deleted !== true), [samples])
  const visibleComments = useMemo(() => comments.filter((c) => c.deleted !== true), [comments])

  const imageAssetsCount = familyImages.length + skuImages.length
  const assetsCount = imageAssetsCount + visibleDocuments.length
  const skuPhotosCount = skuImages.length
  const notesSnippet = useMemo(() => normalizeNotesSnippet(family?.notes), [family?.notes])

  const navItems = useMemo(() => {
    return [
      { key: "overview", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
      { key: "colorways", label: "Colorways", icon: <Palette className="h-4 w-4" />, count: activeSkus.length },
      { key: "samples", label: "Samples", icon: <Box className="h-4 w-4" />, count: visibleSamples.length },
      { key: "assets", label: "Assets", icon: <FileText className="h-4 w-4" />, count: assetsCount },
      { key: "activity", label: "Activity", icon: <ActivityIcon className="h-4 w-4" />, count: visibleComments.length },
    ] as const
  }, [activeSkus.length, assetsCount, visibleComments.length, visibleSamples.length])

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

  const scopeSkuOptions = useMemo(() => {
    return activeSkus
      .map((sku) => ({
        id: sku.id,
        label: sku.colorName ?? sku.name,
      }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
  }, [activeSkus])

  const scopedSamples = useMemo(() => {
    if (!sampleScopeSkuId) return visibleSamples
    return visibleSamples.filter((s) => s.scopeSkuId === sampleScopeSkuId)
  }, [sampleScopeSkuId, visibleSamples])

  const sampleStatusCounts = useMemo(() => {
    const base = {
      all: scopedSamples.length,
      requested: 0,
      in_transit: 0,
      arrived: 0,
      returned: 0,
      issue: 0,
    } satisfies Record<SampleStatusFilter, number>

    for (const s of scopedSamples) {
      base[s.status] += 1
    }

    return base
  }, [scopedSamples])

  const filteredSamples = useMemo(() => {
    let out = [...scopedSamples]
    if (sampleStatusFilter !== "all") out = out.filter((s) => s.status === sampleStatusFilter)
    if (sampleTypeFilter !== "all") out = out.filter((s) => s.type === sampleTypeFilter)
    out.sort((a, b) => sampleSortKey(b) - sampleSortKey(a))
    return out
  }, [sampleStatusFilter, sampleTypeFilter, scopedSamples])

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
  const categoryRaw = family.productSubcategory ?? family.productType ?? family.category
  const categoryLabel = categoryRaw ? humanizeClassificationKey(categoryRaw) : null
  const returnTo = parseReturnToParam(searchParams.get("returnTo"))
  const isFamilyDeleted = family.deleted === true
  const detailUrl = `${location.pathname}${location.search}`
  const productsReturnTo = returnTo?.path ?? "/products"
  const sectionParam = searchParams.get("section")
  const activeSection: ProductWorkspaceSectionKey =
    sectionParam === "colorways" ||
    sectionParam === "samples" ||
    sectionParam === "assets" ||
    sectionParam === "activity" ||
    sectionParam === "overview"
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

  const openNewSample = () => {
    setActiveSample(null)
    setSampleDraft({
      type: "shoot",
      status: "requested",
      sizeRunCsv: "",
      carrier: "",
      tracking: "",
      eta: "",
      notes: "",
      scopeSkuId: sampleScopeSkuId || "",
    })
    setSampleDeleteConfirmOpen(false)
    setSampleSheetOpen(true)
  }

  const openEditSample = (sample: ProductSample) => {
    setActiveSample(sample)
    setSampleDraft({
      type: sample.type,
      status: sample.status,
      sizeRunCsv: (sample.sizeRun ?? []).join(", "),
      carrier: sample.carrier ?? "",
      tracking: sample.tracking ?? "",
      eta: sample.eta ? sample.eta.toDate().toISOString().slice(0, 10) : "",
      notes: sample.notes ?? "",
      scopeSkuId: sample.scopeSkuId ?? "",
    })
    setSampleDeleteConfirmOpen(false)
    setSampleSheetOpen(true)
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
            <h2 className="heading-section">
              {family.styleName}
            </h2>
            {family.styleNumber && (
              <span className="text-sm text-[var(--color-text-muted)]">
                Style {family.styleNumber}
              </span>
            )}
            {family.previousStyleNumber && (
              <span className="text-xs text-[var(--color-text-subtle)]">
                Previously: {family.previousStyleNumber}
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
              <div className="label-meta">
                Quick stats
              </div>
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
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Explore sections</h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Colorways, samples, assets, and activity—organized for fast scanning under pressure.
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
                    onClick={() => setSection("samples")}
                    role="button"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-[var(--color-surface-subtle)] p-2 text-[var(--color-text-muted)]">
                            <Box className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-text)]">Samples</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              Track requests, transit, arrivals, and issues.
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-[var(--color-text)]">{visibleSamples.length}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            tracked
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
                              Photos plus supporting documents (tech packs, specs).
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-[var(--color-text)]">{assetsCount}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            {imageAssetsCount} images · {visibleDocuments.length} docs
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card
                    className={cn("cursor-pointer transition-shadow hover:shadow-md")}
                    onClick={() => setSection("activity")}
                    role="button"
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="rounded-md bg-[var(--color-surface-subtle)] p-2 text-[var(--color-text-muted)]">
                            <ActivityIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-[var(--color-text)]">Activity</div>
                            <div className="text-xs text-[var(--color-text-muted)]">
                              Discussion thread and recent changes.
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-semibold text-[var(--color-text)]">{visibleComments.length}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">
                            comments
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="label-meta">
                    Classification
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <div>
                      <div className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Gender</div>
                      <div className="mt-0.5 text-sm text-[var(--color-text)]">
                        {family.gender ? humanizeClassificationKey(family.gender) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Type</div>
                      <div className="mt-0.5 text-sm text-[var(--color-text)]">
                        {family.productType ? humanizeClassificationKey(family.productType) : "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Subcategory</div>
                      <div className="mt-0.5 text-sm text-[var(--color-text)]">
                        {family.productSubcategory ? humanizeClassificationKey(family.productSubcategory) : "—"}
                      </div>
                    </div>
                  </div>
                  {notesSnippet && (
                    <div className="mt-3 rounded-md bg-[var(--color-surface-subtle)] p-3">
                      <div className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">Notes</div>
                      <div className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">{notesSnippet}</div>
                    </div>
                  )}
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
                  <InlineEmpty
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

            {activeSection === "samples" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">Samples</h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      Track sample requests, shipping, arrivals, and issues.
                    </p>
                  </div>
                  {canEdit && !isFamilyDeleted && (
                    <Button type="button" onClick={openNewSample} disabled={!clientId || sampleSaving || samplesLoading}>
                      <Plus className="h-4 w-4" />
                      Add sample
                    </Button>
                  )}
                </div>

                {samplesError && (
                  <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
                    {samplesError.message}
                  </div>
                )}

                {samplesLoading ? (
                  <LoadingState loading />
                ) : (
                  <>
                    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {(
                          [
                            { key: "all", label: "All" },
                            { key: "requested", label: "Requested" },
                            { key: "in_transit", label: "In transit" },
                            { key: "arrived", label: "Arrived" },
                            { key: "returned", label: "Returned" },
                            { key: "issue", label: "Issues" },
                          ] as const
                        ).map((opt) => (
                          <Button
                            key={opt.key}
                            type="button"
                            variant={sampleStatusFilter === opt.key ? "secondary" : "outline"}
                            size="sm"
                            className="h-8"
                            onClick={() => setSampleStatusFilter(opt.key)}
                          >
                            {opt.label}
                            <span className="ml-2 text-xs text-[var(--color-text-muted)]">
                              {sampleStatusCounts[opt.key]}
                            </span>
                          </Button>
                        ))}
                      </div>

                      <div className="grid gap-3 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                          <Label className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">
                            Scope
                          </Label>
                          <Select
                            value={sampleScopeSkuId || SCOPE_ALL_VALUE}
                            onValueChange={(value) => setSampleScopeSkuId(value === SCOPE_ALL_VALUE ? "" : value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="All colorways" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={SCOPE_ALL_VALUE}>All colorways</SelectItem>
                              {scopeSkuOptions.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">
                            Type
                          </Label>
                          <Select value={sampleTypeFilter} onValueChange={(value) => setSampleTypeFilter(value as SampleTypeFilter)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="shoot">Shoot</SelectItem>
                              <SelectItem value="pre_production">Pre-production</SelectItem>
                              <SelectItem value="bulk">Bulk</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <Label className="text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">
                            Showing
                          </Label>
                          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text)]">
                            {filteredSamples.length} {filteredSamples.length === 1 ? "sample" : "samples"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {filteredSamples.length === 0 ? (
                      <InlineEmpty
                        icon={<Box className="h-8 w-8" />}
                        title="No samples"
                        description="No samples match the current filters."
                      />
                    ) : (
                      <div className="flex flex-col gap-2">
                        {filteredSamples.map((sample) => (
                          <div
                            key={sample.id}
                            role="button"
                            tabIndex={0}
                            className="flex w-full items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-left transition-colors hover:bg-[var(--color-surface-subtle)]"
                            onClick={() => openEditSample(sample)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault()
                                openEditSample(sample)
                              }
                            }}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-[var(--color-text)]">
                                  {sample.type === "pre_production" ? "Pre-production" : sample.type === "bulk" ? "Bulk" : "Shoot"}
                                </span>
                                <Badge variant="outline" className="text-xs font-normal text-[var(--color-text-muted)]">
                                  {sample.status.split("_").join(" ")}
                                </Badge>
                                {sample.scopeSkuId && (
                                  <Badge variant="outline" className="text-xs font-normal text-[var(--color-text-muted)]">
                                    {scopeSkuOptions.find((o) => o.id === sample.scopeSkuId)?.label ?? "Colorway"}
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
                                Sizes: {(sample.sizeRun ?? []).join(", ") || "—"} · ETA: {formatDateTime(sample.eta)}
                                {sample.tracking ? ` · Tracking: ${sample.tracking}` : ""}
                              </div>
                            </div>

                            {canEdit && !isFamilyDeleted ? (
                              <div
                                className="flex shrink-0 items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <Select
                                  value={sample.status}
                                  onValueChange={(value) => {
                                    if (!clientId) return
                                    setSampleMutatingId(sample.id)
                                    const nextStatus = value as ProductSampleStatus
                                    void updateProductSample({
                                      clientId,
                                      familyId: family.id,
                                      sampleId: sample.id,
                                      userId: user?.uid ?? null,
                                      patch: {
                                        status: nextStatus,
                                        arrivedAt:
                                          nextStatus === "arrived" && !sample.arrivedAt ? new Date() : undefined,
                                      },
                                    })
                                      .catch((err) => {
                                        toast({
                                          title: "Update failed",
                                          description: err instanceof Error ? err.message : "Failed to update sample.",
                                        })
                                      })
                                      .finally(() => setSampleMutatingId(null))
                                  }}
                                  disabled={sampleMutatingId === sample.id}
                                >
                                  <SelectTrigger className="h-9 w-[160px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="requested">Requested</SelectItem>
                                    <SelectItem value="in_transit">In transit</SelectItem>
                                    <SelectItem value="arrived">Arrived</SelectItem>
                                    <SelectItem value="returned">Returned</SelectItem>
                                    <SelectItem value="issue">Issue</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div className="shrink-0 text-xs text-[var(--color-text-subtle)]">
                                Updated {formatDateTime(sample.updatedAt ?? sample.createdAt)}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeSection === "assets" && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)]">Assets</h3>
                    <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                      Photos and supporting documents attached to this product.
                    </p>
                  </div>
                  {canEdit && !isFamilyDeleted && (
                    <div className="flex items-center gap-2">
                      <label
                        className={cn(
                          "inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium text-[var(--color-text)] shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                          (documentUploading || !clientId) && "pointer-events-none opacity-50",
                        )}
                      >
                        <Upload className="h-4 w-4" />
                        Upload document
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          className="hidden"
                          disabled={documentUploading || !clientId}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            e.currentTarget.value = ""
                            if (!file || !clientId || !user?.uid) return
                            setDocumentUploading(true)
                            void createProductDocument({
                              clientId,
                              familyId: family.id,
                              userId: user.uid,
                              userName: user.displayName ?? null,
                              userAvatar: user.photoURL ?? null,
                              file,
                            })
                              .then(() => toast({ title: "Uploaded", description: "Document uploaded." }))
                              .catch((err) => {
                                toast({
                                  title: "Upload failed",
                                  description: err instanceof Error ? err.message : "Failed to upload document.",
                                })
                              })
                              .finally(() => setDocumentUploading(false))
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>

                {assetsCount === 0 ? (
                  <InlineEmpty
                    icon={<FileText className="h-8 w-8" />}
                    title="No assets"
                    description="No images or documents are currently attached to this product."
                  />
                ) : (
                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-3">
                      <div className="label-meta">
                        Documents
                      </div>
                      {documentsError && (
                        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
                          {documentsError.message}
                        </div>
                      )}
                      {documentsLoading ? (
                        <LoadingState loading />
                      ) : visibleDocuments.length === 0 ? (
                        <InlineEmpty
                          icon={<FileText className="h-8 w-8" />}
                          title="No documents"
                          description="No documents uploaded yet."
                        />
                      ) : (
                        <div className="flex flex-col gap-2">
                          {visibleDocuments.map((doc) => (
                            <DocumentRow
                              key={doc.id}
                              doc={doc}
                              canEdit={canEdit && !isFamilyDeleted}
                              deleting={documentMutatingId === doc.id}
                              onDelete={(target) => {
                                setDocToDelete(target)
                                setDocDeleteConfirmOpen(true)
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {familyImages.length > 0 && (
                      <div className="flex flex-col gap-3">
                        <div className="label-meta">
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
                        <div className="label-meta">
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

            {activeSection === "activity" && (
              <div className="flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text)]">Activity</h3>
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    Discussion and a lightweight timeline of recent changes.
                  </p>
                </div>

                {commentsError && (
                  <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
                    {commentsError.message}
                  </div>
                )}

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                      <MessageSquare className="h-4 w-4 text-[var(--color-text-muted)]" />
                      Comments
                    </div>
                  </div>

                  {canEdit && !isFamilyDeleted && (
                    <div className="mt-3 flex flex-col gap-2">
                      <Textarea
                        value={commentDraft}
                        disabled={commentSaving}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        placeholder="Leave a note for your team…"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => setCommentDraft("")}
                          disabled={commentSaving || commentDraft.trim().length === 0}
                        >
                          Clear
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9"
                          disabled={commentSaving || !clientId || commentDraft.trim().length === 0}
                          onClick={() => {
                            if (!clientId) return
                            setCommentSaving(true)
                            void createProductComment({
                              clientId,
                              familyId: family.id,
                              body: commentDraft,
                              userId: user?.uid ?? "",
                              userName: user?.displayName ?? null,
                              userAvatar: user?.photoURL ?? null,
                            })
                              .then(() => {
                                setCommentDraft("")
                                toast({ title: "Posted", description: "Comment added." })
                              })
                              .catch((err) => {
                                toast({
                                  title: "Post failed",
                                  description: err instanceof Error ? err.message : "Failed to post comment.",
                                })
                              })
                              .finally(() => setCommentSaving(false))
                          }}
                        >
                          Post
                        </Button>
                      </div>
                    </div>
                  )}

                  <Separator className="my-4" />

                  {commentsLoading ? (
                    <LoadingState loading />
                  ) : comments.length === 0 ? (
                    <InlineEmpty
                      icon={<MessageSquare className="h-8 w-8" />}
                      title="No comments yet"
                    />
                  ) : (
                    <div className="flex flex-col gap-3">
                      {comments.map((comment) => {
                        const mine = comment.createdBy && user?.uid && comment.createdBy === user.uid
                        const who = comment.createdByName ?? (comment.createdBy ? "Member" : "—")
                        const when = formatDateTime(comment.createdAt)
                        const deleted = comment.deleted === true
                        return (
                          <div key={comment.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs text-[var(--color-text-subtle)]">
                                  {who} · {when}
                                </div>
                                <div className={cn("mt-1 whitespace-pre-wrap text-sm", deleted ? "text-[var(--color-text-subtle)] italic" : "text-[var(--color-text)]")}>
                                  {deleted ? "Deleted" : comment.body}
                                </div>
                              </div>
                              {canEdit && mine && !deleted && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 px-2 text-xs text-[var(--color-error)] hover:text-[var(--color-error)]"
                                  onClick={() => {
                                    if (!clientId) return
                                    void setProductCommentDeleted({
                                      clientId,
                                      familyId: family.id,
                                      commentId: comment.id,
                                      deleted: true,
                                    }).catch((err) => {
                                      toast({
                                        title: "Delete failed",
                                        description: err instanceof Error ? err.message : "Failed to delete comment.",
                                      })
                                    })
                                  }}
                                >
                                  Delete
                                </Button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
                    <ActivityIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
                    Timeline
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    Created/updated metadata plus sample/doc activity. (Full version history is planned separately.)
                  </p>

                  <div className="mt-3 flex flex-col gap-2 text-sm">
                    <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[var(--color-text)]">Product created</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{formatDateTime(family.createdAt)}</div>
                      </div>
                    </div>
                    {family.updatedAt && family.createdAt && family.updatedAt.toMillis && family.createdAt.toMillis && family.updatedAt.toMillis() !== family.createdAt.toMillis() && (
                      <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--color-text)]">Product updated</div>
                          <div className="text-xs text-[var(--color-text-muted)]">{formatDateTime(family.updatedAt)}</div>
                        </div>
                      </div>
                    )}

                    {visibleDocuments.slice(0, 10).map((doc) => (
                      <div key={`doc-${doc.id}`} className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--color-text)]">Document uploaded</div>
                          <div className="truncate text-xs text-[var(--color-text-muted)]">{doc.name} · {formatDateTime(doc.createdAt)}</div>
                        </div>
                      </div>
                    ))}

                    {visibleSamples.slice(0, 10).map((s) => (
                      <div key={`sample-${s.id}`} className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--color-text)]">Sample updated</div>
                          <div className="truncate text-xs text-[var(--color-text-muted)]">
                            {s.type === "pre_production" ? "Pre-production" : s.type === "bulk" ? "Bulk" : "Shoot"} · {s.status.split("_").join(" ")} · {formatDateTime(s.updatedAt ?? s.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <Sheet
        open={sampleSheetOpen}
        onOpenChange={(open) => {
          setSampleSheetOpen(open)
          if (!open) setActiveSample(null)
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{activeSample ? "Edit sample" : "Add sample"}</SheetTitle>
          </SheetHeader>

          <div className="mt-4 grid gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={sampleDraft.type}
                  onValueChange={(value) => setSampleDraft((prev) => ({ ...prev, type: value as ProductSampleType }))}
                  disabled={sampleSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shoot">Shoot</SelectItem>
                    <SelectItem value="pre_production">Pre-production</SelectItem>
                    <SelectItem value="bulk">Bulk</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Status</Label>
                <Select
                  value={sampleDraft.status}
                  onValueChange={(value) => setSampleDraft((prev) => ({ ...prev, status: value as ProductSampleStatus }))}
                  disabled={sampleSaving}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="in_transit">In transit</SelectItem>
                    <SelectItem value="arrived">Arrived</SelectItem>
                    <SelectItem value="returned">Returned</SelectItem>
                    <SelectItem value="issue">Issue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Scope</Label>
                <Select
                  value={sampleDraft.scopeSkuId || SCOPE_ALL_VALUE}
                  onValueChange={(value) =>
                    setSampleDraft((prev) => ({ ...prev, scopeSkuId: value === SCOPE_ALL_VALUE ? "" : value }))
                  }
                  disabled={sampleSaving}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All colorways" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SCOPE_ALL_VALUE}>All colorways</SelectItem>
                    {scopeSkuOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">ETA</Label>
                <Input
                  type="date"
                  value={sampleDraft.eta}
                  disabled={sampleSaving}
                  onChange={(e) => setSampleDraft((prev) => ({ ...prev, eta: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Carrier</Label>
                <Input
                  value={sampleDraft.carrier}
                  disabled={sampleSaving}
                  onChange={(e) => setSampleDraft((prev) => ({ ...prev, carrier: e.target.value }))}
                  placeholder="UPS, FedEx…"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Tracking</Label>
                <Input
                  value={sampleDraft.tracking}
                  disabled={sampleSaving}
                  onChange={(e) => setSampleDraft((prev) => ({ ...prev, tracking: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Size run (CSV)</Label>
              <Input
                value={sampleDraft.sizeRunCsv}
                disabled={sampleSaving}
                onChange={(e) => setSampleDraft((prev) => ({ ...prev, sizeRunCsv: e.target.value }))}
                placeholder="XS, S, M"
              />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={sampleDraft.notes}
                disabled={sampleSaving}
                onChange={(e) => setSampleDraft((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Any context your team will need…"
              />
            </div>

            {activeSample && (
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-xs text-[var(--color-text-muted)]">
                Created {formatDateTime(activeSample.createdAt)} · Updated {formatDateTime(activeSample.updatedAt ?? activeSample.createdAt)}
              </div>
            )}
          </div>

          <SheetFooter className="mt-4">
            {activeSample && canEdit && !isFamilyDeleted && (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-[var(--color-error)] hover:text-[var(--color-error)]"
                disabled={sampleSaving}
                onClick={() => setSampleDeleteConfirmOpen(true)}
              >
                <Trash2 className="h-4 w-4" />
                Delete sample
              </Button>
            )}
            <Button type="button" variant="outline" onClick={() => setSampleSheetOpen(false)} disabled={sampleSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={sampleSaving || !clientId || isFamilyDeleted}
              onClick={() => {
                if (!clientId) return
                setSampleSaving(true)
                const eta = parseDateInput(sampleDraft.eta)
                const arrivedAt =
                  sampleDraft.status === "arrived" && !(activeSample?.arrivedAt) ? new Date() : null

                const op = activeSample
                  ? updateProductSample({
                      clientId,
                      familyId: family.id,
                      sampleId: activeSample.id,
                      userId: user?.uid ?? null,
                      patch: {
                        type: sampleDraft.type,
                        status: sampleDraft.status,
                        sizeRun: sampleDraft.sizeRunCsv
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                        carrier: sampleDraft.carrier || null,
                        tracking: sampleDraft.tracking || null,
                        eta,
                        arrivedAt: arrivedAt ?? undefined,
                        notes: sampleDraft.notes || null,
                        scopeSkuId: sampleDraft.scopeSkuId || null,
                      },
                    })
                  : createProductSample({
                      clientId,
                      familyId: family.id,
                      userId: user?.uid ?? null,
                      type: sampleDraft.type,
                      status: sampleDraft.status,
                      sizeRunCsv: sampleDraft.sizeRunCsv,
                      carrier: sampleDraft.carrier || null,
                      tracking: sampleDraft.tracking || null,
                      eta,
                      notes: sampleDraft.notes || null,
                      scopeSkuId: sampleDraft.scopeSkuId || null,
                    })

                void Promise.resolve(op)
                  .then(() => {
                    toast({ title: "Saved", description: "Sample saved." })
                    setSampleSheetOpen(false)
                  })
                  .catch((err) => {
                    toast({
                      title: "Save failed",
                      description: err instanceof Error ? err.message : "Failed to save sample.",
                    })
                  })
                  .finally(() => setSampleSaving(false))
              }}
            >
              Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

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

      <ConfirmDialog
        open={docDeleteConfirmOpen}
        onOpenChange={setDocDeleteConfirmOpen}
        title="Delete document?"
        description="This removes the metadata and attempts to delete the file from storage."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!clientId || !docToDelete) return
          setDocDeleteConfirmOpen(false)
          setDocumentMutatingId(docToDelete.id)
          void deleteProductDocument({
            clientId,
            familyId: family.id,
            documentId: docToDelete.id,
            storagePath: docToDelete.storagePath,
          })
            .then(() => toast({ title: "Deleted", description: "Document deleted." }))
            .catch((err) => {
              toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : "Failed to delete document.",
              })
            })
            .finally(() => {
              setDocumentMutatingId(null)
              setDocToDelete(null)
            })
        }}
      />

      <ConfirmDialog
        open={sampleDeleteConfirmOpen}
        onOpenChange={setSampleDeleteConfirmOpen}
        title="Delete sample?"
        description="This hides the sample from default views. You can restore it later."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!clientId || !activeSample) return
          setSampleSaving(true)
          void updateProductSample({
            clientId,
            familyId: family.id,
            sampleId: activeSample.id,
            userId: user?.uid ?? null,
            patch: { deleted: true },
          })
            .then(() => {
              toast({ title: "Deleted", description: "Sample deleted." })
              setSampleSheetOpen(false)
              setSampleDeleteConfirmOpen(false)
            })
            .catch((err) => {
              toast({
                title: "Delete failed",
                description: err instanceof Error ? err.message : "Failed to delete sample.",
              })
            })
            .finally(() => setSampleSaving(false))
        }}
      />
    </div>
  )
}
