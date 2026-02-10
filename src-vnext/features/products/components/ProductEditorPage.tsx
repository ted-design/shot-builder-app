import type { ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import type { ProductFamily, ProductSku } from "@/shared/types"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import { parseReturnToParam } from "@/shared/lib/returnTo"
import { PageHeader } from "@/shared/components/PageHeader"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { ProductImage } from "@/features/products/components/ProductImage"
import {
  useProductFamily,
  useProductFamilies,
  useProductSkus,
} from "@/features/products/hooks/useProducts"
import { useProductClassifications } from "@/features/products/hooks/useProductClassifications"
import {
  createProductFamilyWithSkus,
  updateProductFamilyWithSkus,
  type ProductFamilyDraft,
  type ProductSkuDraft,
} from "@/features/products/lib/productWrites"
import {
  deriveProductClassificationScaffold,
  humanizeClassificationKey,
  normalizeClassificationGender,
  normalizeClassificationKey,
  slugifyClassificationKey,
} from "@/features/products/lib/productClassifications"
import {
  createSubcategoryClassification,
  createTypeClassification,
} from "@/features/products/lib/productClassificationWrites"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Separator } from "@/ui/separator"
import { Textarea } from "@/ui/textarea"
import { cn } from "@/shared/lib/utils"
import { toast } from "@/shared/hooks/use-toast"
import { Package, Plus, Save, X } from "lucide-react"

type Mode = "create" | "edit"
type EditorSection = "basics" | "notes" | "colorways"

function makeLocalId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeCsv(value: string): string {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ")
}

function parseColorwayQuickAdd(value: string): string[] {
  const seen = new Set<string>()
  const output: string[] = []
  const tokens = value
    .split(/[\n,]+/g)
    .map((item) => item.trim())
    .filter(Boolean)

  for (const token of tokens) {
    const key = token.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    output.push(token)
  }

  return output
}

function notesToText(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (Array.isArray(value)) {
    return value
      .flatMap((v) => (typeof v === "string" ? [v] : []))
      .map((v) => v.trim())
      .filter(Boolean)
      .join("\n")
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ""
  }
}

function skuToDraft(sku: ProductSku): ProductSkuDraft {
  return {
    id: sku.id,
    colorName: sku.colorName ?? sku.name,
    skuCode: sku.skuCode ?? "",
    sizesCsv: Array.isArray(sku.sizes) ? sku.sizes.join(", ") : "",
    status: sku.status ?? "active",
    archived: sku.archived ?? false,
    imagePath: sku.imagePath ?? null,
    imageFile: null,
    removeImage: false,
    colorKey: sku.colorKey ?? "",
    hexColor: sku.hexColor ?? sku.colourHex ?? "",
    deleted: sku.deleted ?? false,
  }
}

function emptySkuDraft(): ProductSkuDraft {
  return {
    id: undefined,
    colorName: "",
    skuCode: "",
    sizesCsv: "",
    status: "active",
    archived: false,
    imagePath: null,
    imageFile: null,
    removeImage: false,
    colorKey: "",
    hexColor: "",
    deleted: false,
  }
}

function defaultFamilyDraft(existing?: ProductFamily): ProductFamilyDraft {
  return {
    styleName: existing?.styleName ?? "",
    styleNumber: existing?.styleNumber ?? "",
    previousStyleNumber: existing?.previousStyleNumber ?? "",
    gender: (existing?.gender ?? "") as string,
    productType: existing?.productType ?? "",
    productSubcategory: existing?.productSubcategory ?? "",
    status: existing?.status ?? "active",
    archived: existing?.archived ?? false,
    sizesCsv: Array.isArray(existing?.sizes) ? existing!.sizes!.join(", ") : "",
    notes: notesToText(existing?.notes),
    headerImagePath: existing?.headerImagePath ?? null,
    thumbnailImagePath: existing?.thumbnailImagePath ?? null,
    headerImageFile: null,
    thumbnailImageFile: null,
    removeHeaderImage: false,
    removeThumbnailImage: false,
  }
}

interface ProductSkuFormState extends ProductSkuDraft {
  readonly localId: string
}

function toFormState(draft: ProductSkuDraft): ProductSkuFormState {
  return { ...draft, localId: draft.id ?? makeLocalId() }
}

function useObjectUrl(file: File | null | undefined): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file])
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])
  return url
}

function EditorNav({
  section,
  onChange,
  disabled,
}: {
  readonly section: EditorSection
  readonly onChange: (next: EditorSection) => void
  readonly disabled: boolean
}) {
  return (
    <nav className="flex flex-col gap-1">
      {([
        { key: "basics", label: "Basics", description: "Identity, classification, sizing, images." },
        { key: "notes", label: "Notes", description: "Producer context and product-specific guidance." },
        { key: "colorways", label: "Colorways", description: "SKUs, sizes, status, images." },
      ] as const).map((item) => (
        <button
          key={item.key}
          type="button"
          className={cn(
            "w-full rounded-md border px-3 py-2 text-left transition-colors",
            section === item.key
              ? "border-[var(--color-border-strong)] bg-[var(--color-surface)]"
              : "border-transparent hover:bg-[var(--color-surface-subtle)]",
            disabled && "opacity-60",
          )}
          onClick={() => onChange(item.key)}
          disabled={disabled}
        >
          <div className="text-sm font-medium text-[var(--color-text)]">{item.label}</div>
          <div className="text-xs text-[var(--color-text-muted)]">{item.description}</div>
        </button>
      ))}
    </nav>
  )
}

function SectionCard({
  title,
  description,
  children,
}: {
  readonly title: string
  readonly description?: string
  readonly children: ReactNode
}) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-4 py-3">
        <div className="text-sm font-semibold text-[var(--color-text)]">{title}</div>
        {description && <div className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</div>}
      </div>
      <Separator />
      <div className="p-4">{children}</div>
    </div>
  )
}

function ColorwayRow({
  sku,
  familyImagePath,
  disabled,
  onChange,
  onRemoveExisting,
  onRemoveNew,
  onUndoRemove,
}: {
  readonly sku: ProductSkuFormState
  readonly familyImagePath: string | null
  readonly disabled: boolean
  readonly onChange: (next: ProductSkuFormState) => void
  readonly onRemoveExisting: (id: string) => void
  readonly onRemoveNew: () => void
  readonly onUndoRemove: () => void
}) {
  const isDeleted = sku.deleted === true
  const previewUrl = useObjectUrl(sku.imageFile ?? null)
  const sizesSummary = sku.sizesCsv.trim().length > 0 ? sku.sizesCsv.trim() : "Inherit family sizes"

  return (
    <details
      className={cn(
        "group rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]",
        isDeleted ? "opacity-75" : "",
      )}
      open={false}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <ProductImage
          src={isDeleted ? undefined : previewUrl ?? (sku.imagePath ?? undefined)}
          fallbackSrc={familyImagePath ?? undefined}
          alt={sku.colorName || "Colorway"}
          size="sm"
          className="mt-0.5 shrink-0"
        />

        <div className="grid flex-1 gap-2 md:grid-cols-12 md:items-center">
          <div className="md:col-span-4">
            <div className="text-sm font-medium text-[var(--color-text)]">
              {sku.colorName.trim().length > 0 ? sku.colorName : "Untitled colorway"}
            </div>
            <div className="text-xs text-[var(--color-text-muted)]">{sizesSummary}</div>
          </div>

          <div className="grid gap-2 md:col-span-8 md:grid-cols-3">
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-widest text-[var(--color-text-subtle)]">SKU</Label>
              <Input
                value={sku.skuCode}
                disabled={disabled || isDeleted}
                onChange={(e) => onChange({ ...sku, skuCode: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[10px] uppercase tracking-widest text-[var(--color-text-subtle)]">Status</Label>
              <Select
                value={sku.status}
                onValueChange={(value) => onChange({ ...sku, status: value })}
                disabled={disabled || isDeleted}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="phasing_out">Phasing out</SelectItem>
                  <SelectItem value="coming_soon">Coming soon</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="discontinued">Discontinued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-end gap-2">
              {!disabled && (
                <>
                  {isDeleted ? (
                    <Button type="button" variant="outline" size="sm" className="h-9" onClick={onUndoRemove}>
                      Undo remove
                    </Button>
                  ) : sku.id ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={(e) => {
                        e.preventDefault()
                        onRemoveExisting(sku.id!)
                      }}
                    >
                      Remove
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={(e) => {
                        e.preventDefault()
                        onRemoveNew()
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </summary>

      <div className="px-4 pb-4">
        <Separator />
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Color name</Label>
            <Input
              value={sku.colorName}
              disabled={disabled || isDeleted}
              onChange={(e) => onChange({ ...sku, colorName: e.target.value })}
              placeholder="Black"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Sizes (CSV)</Label>
            <Input
              value={sku.sizesCsv}
              disabled={disabled || isDeleted}
              onChange={(e) => onChange({ ...sku, sizesCsv: e.target.value })}
              placeholder="XS, S, M, L"
            />
            <p className="text-xs text-[var(--color-text-subtle)]">Leave blank to inherit family sizes.</p>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Image</Label>
            <Input
              type="file"
              accept="image/*"
              disabled={disabled || isDeleted}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                onChange({ ...sku, imageFile: file, removeImage: false })
              }}
            />
            {!disabled && !isDeleted && (sku.imagePath || sku.imageFile) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-fit px-2 text-xs"
                onClick={() => onChange({ ...sku, imageFile: null, removeImage: true, imagePath: null })}
              >
                Remove image
              </Button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Color key</Label>
              <Input
                value={sku.colorKey ?? ""}
                disabled={disabled || isDeleted}
                onChange={(e) => onChange({ ...sku, colorKey: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Hex color</Label>
              <Input
                value={sku.hexColor ?? ""}
                disabled={disabled || isDeleted}
                onChange={(e) => onChange({ ...sku, hexColor: e.target.value })}
                placeholder="#000000"
              />
            </div>
          </div>

          {!disabled && !isDeleted && (
            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 lg:col-span-2">
              <Checkbox
                checked={sku.archived}
                disabled={disabled}
                onCheckedChange={(checked) => onChange({ ...sku, archived: checked === true })}
              />
              <span className="text-sm text-[var(--color-text)]">Archived</span>
              <span className="text-xs text-[var(--color-text-subtle)]">
                Hidden from default pickers and lists.
              </span>
            </div>
          )}
        </div>

        {isDeleted && (
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            This colorway will be marked deleted on save.
          </p>
        )}
      </div>
    </details>
  )
}

export default function ProductEditorPage() {
  const { fid } = useParams<{ fid: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { clientId, role, user } = useAuth()
  const isMobile = useIsMobile()
  const canEdit = !isMobile && canManageProducts(role)

  const mode: Mode = fid ? "edit" : "create"
  const returnTo = parseReturnToParam(searchParams.get("returnTo"))
  const productsReturnTo = parseReturnToParam(searchParams.get("productsReturnTo"))

  const { data: family, loading: familyLoading, error: familyError } = useProductFamily(
    mode === "edit" ? (fid ?? null) : null,
  )
  const { data: families } = useProductFamilies()
  const { data: skus, loading: skuLoading } = useProductSkus(mode === "edit" ? (fid ?? null) : null)
  const { data: classifications } = useProductClassifications()

  const existingSkus = useMemo(
    () => (skus ?? []).filter((s) => s.deleted !== true),
    [skus],
  )

  const [section, setSection] = useState<EditorSection>("basics")
  const [draft, setDraft] = useState<ProductFamilyDraft>(() => defaultFamilyDraft())
  const [skuDrafts, setSkuDrafts] = useState<ReadonlyArray<ProductSkuFormState>>(
    () => [toFormState(emptySkuDraft())],
  )
  const [quickColorways, setQuickColorways] = useState("")
  const [newTypeLabel, setNewTypeLabel] = useState("")
  const [newSubcategoryLabel, setNewSubcategoryLabel] = useState("")
  const [creatingType, setCreatingType] = useState(false)
  const [creatingSubcategory, setCreatingSubcategory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== "edit") return
    if (!family) return
    setDraft(defaultFamilyDraft(family))
    setSkuDrafts(existingSkus.length > 0 ? existingSkus.map(skuToDraft).map(toFormState) : [toFormState(emptySkuDraft())])
    setError(null)
  }, [existingSkus, family, mode])

  const classificationScaffold = useMemo(
    () => deriveProductClassificationScaffold({ classifications, families }),
    [classifications, families],
  )

  const draftGenderKey = normalizeClassificationGender(draft.gender) ?? ""
  const draftTypeKey = normalizeClassificationKey(draft.productType) ?? ""
  const draftSubcategoryKey = normalizeClassificationKey(draft.productSubcategory) ?? ""

  const genderOptions = useMemo(() => {
    const base = [...classificationScaffold.genders]
    if (draftGenderKey.length > 0 && !base.some((g) => g.key === draftGenderKey)) {
      base.push({ key: draftGenderKey, label: humanizeClassificationKey(draftGenderKey) })
    }
    return base.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
  }, [classificationScaffold.genders, draftGenderKey])

  const typeOptions = useMemo(() => {
    if (!draftGenderKey) return [] as Array<{ key: string; label: string }>
    const base = [...(classificationScaffold.typesByGender[draftGenderKey] ?? [])]
    if (draftTypeKey.length > 0 && !base.some((t) => t.key === draftTypeKey)) {
      base.push({ key: draftTypeKey, label: humanizeClassificationKey(draftTypeKey) })
    }
    return base.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
  }, [classificationScaffold.typesByGender, draftGenderKey, draftTypeKey])

  const subcategoryOptions = useMemo(() => {
    if (!draftGenderKey || !draftTypeKey) return [] as Array<{ key: string; label: string }>
    const base = [...(classificationScaffold.subcategoriesByGenderAndType[draftGenderKey]?.[draftTypeKey] ?? [])]
    if (draftSubcategoryKey.length > 0 && !base.some((s) => s.key === draftSubcategoryKey)) {
      base.push({ key: draftSubcategoryKey, label: humanizeClassificationKey(draftSubcategoryKey) })
    }
    return base.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
  }, [classificationScaffold.subcategoriesByGenderAndType, draftGenderKey, draftTypeKey, draftSubcategoryKey])

  const genderSelectValue = draftGenderKey.length > 0 ? draftGenderKey : "__unset__"
  const typeSelectValue = draftTypeKey.length > 0 ? draftTypeKey : "__unset__"
  const subcategorySelectValue = draftSubcategoryKey.length > 0 ? draftSubcategoryKey : "__unset__"
  const selectedTypeLabel = typeOptions.find((option) => option.key === draftTypeKey)?.label ?? null
  const activeColorwayCount = skuDrafts.filter((sku) => sku.deleted !== true).length
  const removedColorwayCount = skuDrafts.filter((sku) => sku.deleted === true).length
  const existingColorwayNames = useMemo(
    () =>
      new Set(
        skuDrafts
          .filter((sku) => sku.deleted !== true)
          .map((sku) => sku.colorName.trim().toLowerCase())
          .filter(Boolean),
      ),
    [skuDrafts],
  )
  const quickParsedColorways = useMemo(
    () => parseColorwayQuickAdd(quickColorways),
    [quickColorways],
  )
  const quickOverlapCount = useMemo(
    () =>
      quickParsedColorways.filter((name) =>
        existingColorwayNames.has(name.toLowerCase()),
      ).length,
    [existingColorwayNames, quickParsedColorways],
  )
  const quickNewCount = Math.max(quickParsedColorways.length - quickOverlapCount, 0)

  const canSave = canEdit &&
    Boolean(clientId) &&
    draft.styleName.trim().length > 0 &&
    skuDrafts.some((s) => s.deleted !== true && s.colorName.trim().length > 0)

  const headerPreview = useObjectUrl(draft.headerImageFile ?? null)
  const thumbPreview = useObjectUrl(draft.thumbnailImageFile ?? null)

  const cancelTo = useMemo(() => {
    if (returnTo?.path) return returnTo.path
    if (mode === "edit" && fid) return `/products/${fid}`
    return "/products"
  }, [fid, mode, returnTo?.path])

  const title = mode === "edit" ? "Edit product" : "New product"
  const productsCrumbTo = productsReturnTo?.path ?? "/products"
  const breadcrumbs = useMemo(() => {
    if (mode === "edit" && family) {
      return [
        { label: "Products", to: productsCrumbTo },
        { label: family.styleName, to: `/products/${family.id}` },
        { label: "Edit" },
      ] as const
    }
    return [
      { label: "Products", to: productsCrumbTo },
      { label: "New product" },
    ] as const
  }, [family, mode, productsCrumbTo])

  if (isMobile) {
    return (
      <EmptyState
        icon={<Package className="h-10 w-10" />}
        title="Editing is desktop-only"
        description="Products editing is available on desktop to keep this surface calm and reliable."
      />
    )
  }

  if (mode === "edit" && familyLoading) return <LoadingState loading />

  if (mode === "edit" && familyError) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{familyError}</p>
      </div>
    )
  }

  if (mode === "edit" && !family) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Product not found.</p>
      </div>
    )
  }

  const handleSave = async () => {
    if (!clientId) return
    if (!canEdit) return

    setSaving(true)
    setError(null)

    try {
      const normalizedDraft: ProductFamilyDraft = {
        ...draft,
        styleName: draft.styleName.trim(),
        styleNumber: draft.styleNumber.trim(),
        previousStyleNumber: draft.previousStyleNumber.trim(),
        gender: draft.gender.trim(),
        productType: draft.productType.trim(),
        productSubcategory: draft.productSubcategory.trim(),
        status: draft.status.trim() || "active",
        sizesCsv: normalizeCsv(draft.sizesCsv),
        notes: draft.notes,
      }

      const normalizedSkus = skuDrafts.map((s) => ({
        ...s,
        colorName: s.colorName.trim(),
        skuCode: s.skuCode.trim(),
        sizesCsv: normalizeCsv(s.sizesCsv),
        status: s.status.trim() || "active",
        colorKey: s.colorKey?.trim() || "",
        hexColor: s.hexColor?.trim() || "",
      }))

      if (mode === "edit") {
        if (!family?.id) throw new Error("Missing product id.")
        await updateProductFamilyWithSkus({
          clientId,
          userId: user?.uid ?? null,
          familyId: family.id,
          family: normalizedDraft,
          skus: normalizedSkus,
          existingSkus,
        })
        toast({ title: "Saved", description: "Product updated." })
        navigate(cancelTo)
        return
      }

      const familyId = await createProductFamilyWithSkus({
        clientId,
        userId: user?.uid ?? null,
        family: normalizedDraft,
        skus: normalizedSkus.filter((s) => s.deleted !== true),
      })
      toast({ title: "Created", description: "Product created." })
      navigate(`/products/${familyId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product")
    } finally {
      setSaving(false)
    }
  }

  const requestRemoveSku = (skuId: string | undefined) => {
    if (!skuId) return
    setSkuDrafts((prev) => prev.map((s) => (s.id === skuId ? { ...s, deleted: true } : s)))
  }

  const undoRemoveSku = (skuId: string | undefined) => {
    if (!skuId) return
    setSkuDrafts((prev) => prev.map((s) => (s.id === skuId ? { ...s, deleted: false } : s)))
  }

  const addSku = () => setSkuDrafts((prev) => [...prev, toFormState(emptySkuDraft())])

  const addTypeFromToolbar = async () => {
    if (!clientId || !canEdit || !draftGenderKey) return
    const label = newTypeLabel.trim()
    if (!label) return

    setCreatingType(true)
    try {
      await createTypeClassification({
        clientId,
        userId: user?.uid ?? null,
        gender: draftGenderKey,
        typeLabel: label,
      })
      const key = slugifyClassificationKey(label)
      setDraft((prev) => ({ ...prev, productType: key, productSubcategory: "" }))
      setNewTypeLabel("")
      toast({ title: "Type added", description: `${label} is now available.` })
    } catch (err) {
      toast({
        title: "Unable to add type",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setCreatingType(false)
    }
  }

  const addSubcategoryFromToolbar = async () => {
    if (!clientId || !canEdit || !draftGenderKey || !draftTypeKey) return
    const label = newSubcategoryLabel.trim()
    if (!label) return

    setCreatingSubcategory(true)
    try {
      await createSubcategoryClassification({
        clientId,
        userId: user?.uid ?? null,
        gender: draftGenderKey,
        typeKey: draftTypeKey,
        typeLabel: selectedTypeLabel ?? humanizeClassificationKey(draftTypeKey),
        subcategoryLabel: label,
      })
      const key = slugifyClassificationKey(label)
      setDraft((prev) => ({ ...prev, productSubcategory: key }))
      setNewSubcategoryLabel("")
      toast({ title: "Subcategory added", description: `${label} is now available.` })
    } catch (err) {
      toast({
        title: "Unable to add subcategory",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      })
    } finally {
      setCreatingSubcategory(false)
    }
  }

  const addColorwaysFromQuickList = () => {
    const parsed = quickParsedColorways
    if (parsed.length === 0) {
      toast({
        title: "No colorways added",
        description: "Enter one or more names, separated by commas or line breaks.",
      })
      return
    }

    const toCreate = parsed.filter((name) => !existingColorwayNames.has(name.toLowerCase()))
    if (toCreate.length === 0) {
      toast({
        title: "No new colorways",
        description: "All entered names already exist in this product.",
      })
      return
    }

    setSkuDrafts((prev) => [
      ...prev,
      ...toCreate.map((name) =>
        toFormState({
          ...emptySkuDraft(),
          colorName: name,
        }),
      ),
    ])
    setQuickColorways("")
    toast({
      title: "Colorways added",
      description: `${toCreate.length} colorway${toCreate.length === 1 ? "" : "s"} added.`,
    })
  }

  const familyImagePath = (draft.thumbnailImagePath || draft.headerImagePath) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => navigate(cancelTo)}
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!canSave || saving}
              onClick={() => void handleSave()}
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center gap-3">
              <ProductImage
                src={thumbPreview ?? draft.thumbnailImagePath ?? undefined}
                fallbackSrc={headerPreview ?? draft.headerImagePath ?? undefined}
                alt={draft.styleName || "Product"}
                size="md"
              />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--color-text)]">
                  {draft.styleName.trim().length > 0 ? draft.styleName : "Untitled product"}
                </div>
                <div className="truncate text-xs text-[var(--color-text-muted)]">
                  {draft.styleNumber.trim().length > 0 ? `Style ${draft.styleNumber}` : "No style # yet"}
                </div>
              </div>
            </div>
          </div>

          <EditorNav section={section} onChange={setSection} disabled={saving} />
          {error && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
              {error}
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          {section === "basics" ? (
            <>
              <SectionCard title="Identity" description="Keep this predictable: how producers find it at 1am.">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="styleName">Style name</Label>
                    <Input
                      id="styleName"
                      value={draft.styleName}
                      onChange={(e) => setDraft((p) => ({ ...p, styleName: e.target.value }))}
                      placeholder="e.g. Compact Travel Hoodie"
                      disabled={!canEdit || saving}
                      autoFocus
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="styleNumber">Style #</Label>
                      <Input
                        id="styleNumber"
                        value={draft.styleNumber}
                        onChange={(e) => setDraft((p) => ({ ...p, styleNumber: e.target.value }))}
                        placeholder="Optional"
                        disabled={!canEdit || saving}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={draft.status}
                        onValueChange={(value) => setDraft((p) => ({ ...p, status: value }))}
                        disabled={!canEdit || saving}
                      >
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="phasing_out">Phasing out</SelectItem>
                          <SelectItem value="coming_soon">Coming soon</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="discontinued">Discontinued</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Classification" description="Scaffolded values power calm filters in the library.">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={genderSelectValue}
                      onValueChange={(value) => {
                        setDraft((p) => ({
                          ...p,
                          gender: value === "__unset__" ? "" : value,
                          productType: "",
                          productSubcategory: "",
                        }))
                      }}
                      disabled={!canEdit || saving}
                    >
                      <SelectTrigger id="gender">
                        <SelectValue placeholder="Unspecified" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">Unspecified</SelectItem>
                        {genderOptions.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="type">Type</Label>
                    <Select
                      value={typeSelectValue}
                      onValueChange={(value) =>
                        setDraft((p) => ({
                          ...p,
                          productType: value === "__unset__" ? "" : value,
                          productSubcategory: "",
                        }))
                      }
                      disabled={!canEdit || saving || !draftGenderKey}
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder={draftGenderKey ? "Select type" : "Select gender first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">Unspecified</SelectItem>
                        {typeOptions.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="subcategory">Subcategory</Label>
                    <Select
                      value={subcategorySelectValue}
                      onValueChange={(value) =>
                        setDraft((p) => ({
                          ...p,
                          productSubcategory: value === "__unset__" ? "" : value,
                        }))
                      }
                      disabled={!canEdit || saving || !draftGenderKey || !draftTypeKey}
                    >
                      <SelectTrigger id="subcategory">
                        <SelectValue placeholder={draftTypeKey ? "Select subcategory" : "Select type first"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__unset__">Unspecified</SelectItem>
                        {subcategoryOptions.map((option) => (
                          <SelectItem key={option.key} value={option.key}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-3">
                  <div className="text-xs text-[var(--color-text-muted)]">
                    Reclassifying this family updates the classification used across all colorways.
                  </div>
                  <div className="mt-2 grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]">
                    <Input
                      value={newTypeLabel}
                      onChange={(e) => setNewTypeLabel(e.target.value)}
                      placeholder={draftGenderKey ? "Create new type…" : "Select gender first"}
                      disabled={!canEdit || saving || creatingType || !draftGenderKey}
                      className="h-8 bg-[var(--color-surface)] text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canEdit || saving || creatingType || !draftGenderKey || newTypeLabel.trim().length === 0}
                      onClick={() => {
                        void addTypeFromToolbar()
                      }}
                    >
                      {creatingType ? "Adding…" : "Add type"}
                    </Button>
                    <Input
                      value={newSubcategoryLabel}
                      onChange={(e) => setNewSubcategoryLabel(e.target.value)}
                      placeholder={draftTypeKey ? "Create new subcategory…" : "Select type first"}
                      disabled={!canEdit || saving || creatingSubcategory || !draftGenderKey || !draftTypeKey}
                      className="h-8 bg-[var(--color-surface)] text-sm"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canEdit || saving || creatingSubcategory || !draftGenderKey || !draftTypeKey || newSubcategoryLabel.trim().length === 0}
                      onClick={() => {
                        void addSubcategoryFromToolbar()
                      }}
                    >
                      {creatingSubcategory ? "Adding…" : "Add subcategory"}
                    </Button>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Sizing + visibility">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sizes">Family sizes (CSV)</Label>
                    <Input
                      id="sizes"
                      value={draft.sizesCsv}
                      onChange={(e) => setDraft((p) => ({ ...p, sizesCsv: e.target.value }))}
                      placeholder="XS, S, M, L, XL"
                      disabled={!canEdit || saving}
                    />
                    <p className="text-xs text-[var(--color-text-subtle)]">
                      Leave blank if sizes vary by colorway.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2">
                    <Checkbox
                      id="archived"
                      checked={draft.archived}
                      disabled={!canEdit || saving}
                      onCheckedChange={(checked) =>
                        setDraft((p) => ({ ...p, archived: checked === true }))
                      }
                    />
                    <Label htmlFor="archived" className="text-sm">
                      Archived
                    </Label>
                    <span className="text-xs text-[var(--color-text-subtle)]">
                      Hidden by default on Products
                    </span>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Images" description="These are used in the product library and assignment pickers.">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label>Header image</Label>
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={headerPreview ?? draft.headerImagePath ?? undefined}
                        alt="Header"
                        size="md"
                      />
                      <div className="flex flex-1 flex-col gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={!canEdit || saving}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setDraft((p) => ({ ...p, headerImageFile: file, removeHeaderImage: false }))
                          }}
                        />
                        {(draft.headerImagePath || draft.headerImageFile) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-fit px-2 text-xs"
                            disabled={!canEdit || saving}
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                headerImagePath: null,
                                headerImageFile: null,
                                removeHeaderImage: true,
                              }))
                            }
                          >
                            Remove header
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label>Thumbnail</Label>
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={thumbPreview ?? draft.thumbnailImagePath ?? undefined}
                        fallbackSrc={headerPreview ?? draft.headerImagePath ?? undefined}
                        alt="Thumbnail"
                        size="md"
                      />
                      <div className="flex flex-1 flex-col gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={!canEdit || saving}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setDraft((p) => ({ ...p, thumbnailImageFile: file, removeThumbnailImage: false }))
                          }}
                        />
                        {(draft.thumbnailImagePath || draft.thumbnailImageFile) && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-fit px-2 text-xs"
                            disabled={!canEdit || saving}
                            onClick={() =>
                              setDraft((p) => ({
                                ...p,
                                thumbnailImagePath: null,
                                thumbnailImageFile: null,
                                removeThumbnailImage: true,
                              }))
                            }
                          >
                            Remove thumbnail
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </>
          ) : section === "notes" ? (
            <SectionCard
              title="Notes"
              description="Add producer-facing context. Keep it concise, actionable, and easy to scan."
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="notes">Product notes</Label>
                <Textarea
                  id="notes"
                  value={draft.notes}
                  onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Fit notes, fabric, special handling, key styling constraints…"
                  disabled={!canEdit || saving}
                />
                <p className="text-xs text-[var(--color-text-subtle)]">
                  Notes appear in the product cockpit overview for fast recall.
                </p>
              </div>
            </SectionCard>
          ) : (
            <SectionCard
              title="Colorways"
              description={skuLoading ? "Loading..." : "Expand a colorway for sizes and image controls."}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-[var(--color-text-muted)]">
                  {activeColorwayCount} active
                  {removedColorwayCount > 0 ? ` · ${removedColorwayCount} removed` : ""}
                </div>
                <Button type="button" variant="outline" onClick={addSku} disabled={!canEdit || saving}>
                  <Plus className="h-4 w-4" />
                  Add colorway
                </Button>
              </div>
              <div className="mt-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                <Label htmlFor="quickColorways" className="text-xs">
                  Quick add colorways
                </Label>
                <Textarea
                  id="quickColorways"
                  value={quickColorways}
                  onChange={(e) => setQuickColorways(e.target.value)}
                  placeholder="Forest, Oxblood, Navy"
                  disabled={!canEdit || saving}
                  className="mt-2 min-h-[72px] bg-[var(--color-surface)]"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--color-text-subtle)]">
                    Paste names separated by commas or line breaks.
                    {quickParsedColorways.length > 0 && (
                      <>
                        {" "}
                        {quickParsedColorways.length} parsed
                        {quickOverlapCount > 0 ? ` · ${quickOverlapCount} already exist` : ""}
                        {quickNewCount > 0 ? ` · ${quickNewCount} new` : ""}
                      </>
                    )}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={addColorwaysFromQuickList}
                    disabled={!canEdit || saving || quickNewCount === 0}
                  >
                    Add listed colorways
                  </Button>
                </div>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {skuDrafts.map((sku, idx) => (
                  <ColorwayRow
                    key={sku.localId}
                    sku={sku}
                    familyImagePath={familyImagePath}
                    disabled={!canEdit || saving}
                    onChange={(next) =>
                      setSkuDrafts((prev) => prev.map((s) => (s.localId === sku.localId ? next : s)))
                    }
                    onRemoveExisting={(id) => requestRemoveSku(id)}
                    onUndoRemove={() => undoRemoveSku(sku.id)}
                    onRemoveNew={() => setSkuDrafts((prev) => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>
            </SectionCard>
          )}
        </div>

      </div>
    </div>
  )
}
