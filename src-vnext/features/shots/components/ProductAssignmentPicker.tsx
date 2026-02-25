import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Separator } from "@/ui/separator"
import { Badge } from "@/ui/badge"
import {
  useProductFamilies,
  useProductSkus,
  useProductFamilyDoc,
  useProductSkuDoc,
} from "@/features/shots/hooks/usePickerData"
import { ProductUpsertDialog } from "@/features/products/components/ProductUpsertDialog"
import { Package, Plus, X, ChevronLeft, Loader2, Search } from "lucide-react"
import { resolveStoragePath } from "@/shared/lib/resolveStoragePath"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { getTagColorClasses } from "@/shared/lib/tagColors"
import { toast } from "sonner"
import type { ProductAssignment, ProductFamily, ProductSku, SizeScope } from "@/shared/types"

interface ProductAssignmentPickerProps {
  readonly selected: ReadonlyArray<ProductAssignment>
  readonly onSave: (products: ProductAssignment[]) => Promise<boolean>
  readonly disabled?: boolean
  readonly canManageCatalog?: boolean
}

type AddStep = "family" | "sku" | "details"

interface DraftAssignment {
  readonly family: ProductFamily | null
  readonly sku: ProductSku | null
  readonly sizeScope: SizeScope
  readonly size: string
  readonly quantity: number
}

const EMPTY_DRAFT: DraftAssignment = {
  family: null,
  sku: null,
  sizeScope: "all",
  size: "",
  quantity: 1,
}

/** Remove undefined values from an object so Firestore doesn't reject the write. */
function stripUndefined(obj: ProductAssignment): ProductAssignment {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as unknown as ProductAssignment
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function canonicalGenderKey(value: unknown): string {
  const raw = normalizeText(value)?.toLowerCase() ?? null
  if (!raw) return "unknown"
  if (raw === "women" || raw === "woman" || raw === "womens" || raw === "female" || raw === "w") return "women"
  if (raw === "men" || raw === "man" || raw === "mens" || raw === "male" || raw === "m") return "men"
  if (raw === "unisex") return "unisex"
  return raw
}

function humanizeLabel(value: string): string {
  return value
    .split(/[\s_-]+/)
    .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
    .join(" ")
}

function genderLabel(key: string): string {
  if (key === "women") return "Women"
  if (key === "men") return "Men"
  if (key === "unisex") return "Unisex"
  if (key === "unknown") return "Unknown"
  return humanizeLabel(key)
}

function genderTagClass(key: string): string {
  if (key === "men") {
    return getTagColorClasses("blue")
  }
  if (key === "women") {
    return getTagColorClasses("pink")
  }
  if (key === "unisex") {
    return getTagColorClasses("purple")
  }
  return getTagColorClasses("gray")
}

function taxonomyLabelForFamily(family: ProductFamily): string {
  const parts = [normalizeText(family.productType), normalizeText(family.productSubcategory)].filter(Boolean) as string[]
  return parts.join(" · ")
}

export function ProductAssignmentPicker({
  selected,
  onSave,
  disabled,
  canManageCatalog = false,
}: ProductAssignmentPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState<AddStep>("family")
  const [draft, setDraft] = useState<DraftAssignment>(EMPTY_DRAFT)
  const [editIndex, setEditIndex] = useState<number | null>(null)

  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [pendingCreatedFamilyId, setPendingCreatedFamilyId] = useState<string | null>(null)
  const [manageColorwayPayload, setManageColorwayPayload] = useState<{
    readonly family: ProductFamily
    readonly skus: ReadonlyArray<ProductSku>
  } | null>(null)

  const openAdd = () => {
    setDraft(EMPTY_DRAFT)
    setEditIndex(null)
    setStep("family")
    setDialogOpen(true)
  }

  const openEdit = (index: number) => {
    const assignment = selected[index]
    if (!assignment) return
    setEditIndex(index)
    setDraft({
      family: { id: assignment.familyId, styleName: assignment.familyName ?? "", clientId: "" },
      sku: assignment.skuId
        ? { id: assignment.skuId, name: assignment.skuName ?? assignment.colourName ?? "" }
        : null,
      sizeScope: assignment.sizeScope ?? "pending",
      size: assignment.size ?? "",
      quantity: assignment.quantity ?? 1,
    })
    setStep("details")
    setDialogOpen(true)
  }

  const handleRemove = async (index: number) => {
    const next = selected.filter((_, i) => i !== index).map(stripUndefined)
    const ok = await onSave([...next])
    if (!ok) {
      toast.error("Failed to remove product. Try again.")
    }
  }

  const [confirming, setConfirming] = useState(false)

  const handleConfirm = async () => {
    if (!draft.family) return
    setConfirming(true)

    try {
      const rawSkuImage = draft.sku?.imagePath ?? undefined
      const rawFamilyImage = draft.family.headerImagePath ?? draft.family.thumbnailImagePath ?? undefined

      const [skuImageUrl, familyImageUrl] = await Promise.all([
        rawSkuImage ? resolveStoragePath(rawSkuImage).catch(() => undefined) : Promise.resolve(undefined),
        rawFamilyImage ? resolveStoragePath(rawFamilyImage).catch(() => undefined) : Promise.resolve(undefined),
      ])

      const thumbUrl = skuImageUrl ?? familyImageUrl

      // Build patch with only defined fields — Firestore rejects `undefined` values.
      const patch: Record<string, unknown> = {
        familyId: draft.family.id,
        familyName: draft.family.styleName,
        sizeScope: draft.sizeScope,
        quantity: draft.quantity,
      }
      if (draft.sku?.id) {
        patch.skuId = draft.sku.id
        patch.colourId = draft.sku.id
        patch.skuName = draft.sku.name
        patch.colourName = draft.sku.colorName ?? draft.sku.name
      }
      if (draft.sizeScope === "single" && draft.size) {
        patch.size = draft.size
      }
      if (thumbUrl) patch.thumbUrl = thumbUrl
      if (skuImageUrl) patch.skuImageUrl = skuImageUrl
      if (familyImageUrl) patch.familyImageUrl = familyImageUrl

      let next: ProductAssignment[]
      if (editIndex !== null) {
        const existing = selected[editIndex]
        next = selected.map((item, i) =>
          i === editIndex
            ? stripUndefined({ ...existing, ...patch } as unknown as ProductAssignment)
            : stripUndefined(item),
        )
      } else {
        next = [
          ...selected.map(stripUndefined),
          stripUndefined(patch as unknown as ProductAssignment),
        ]
      }

      const ok = await onSave(next)
      if (ok) {
        setDialogOpen(false)
      } else {
        toast.error("Failed to save product assignment. Try again.")
      }
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Read-only list of current assignments */}
      {selected.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          {selected.map((p, index) => (
            <AssignmentRow
              key={`${p.familyId}-${p.colourId ?? ""}-${index}`}
              assignment={p}
              disabled={disabled}
              onEdit={() => openEdit(index)}
              onRemove={() => handleRemove(index)}
            />
          ))}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-[var(--color-text-subtle)]">
          <Package className="h-4 w-4" />
          No products assigned
        </p>
      )}

      {!disabled && (
        <Button variant="outline" size="sm" className="w-fit" onClick={openAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add product
        </Button>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[calc(100vh-1.5rem)] w-[min(960px,calc(100vw-1rem))] max-w-none overflow-hidden p-0">
          <DialogHeader className="border-b border-[var(--color-border)] px-4 py-3">
            <DialogTitle>
              {editIndex !== null ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[var(--color-text-subtle)]">
              Search first, refine with chips, then set colorway and sizing.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(100vh-8.5rem)] overflow-y-auto px-4 py-3">
            {step === "family" && (
              <FamilyStep
                canManageCatalog={canManageCatalog}
                autoSelectFamilyId={pendingCreatedFamilyId}
                onAutoSelectHandled={() => setPendingCreatedFamilyId(null)}
                onCreateProduct={() => setCreateDialogOpen(true)}
                onSelect={(family) => {
                  setDraft({ ...EMPTY_DRAFT, family })
                  setStep("sku")
                }}
              />
            )}

            {step === "sku" && draft.family && (
              <SkuStep
                family={draft.family}
                familyImageUrl={draft.family.headerImagePath ?? draft.family.thumbnailImagePath}
                canManageCatalog={canManageCatalog}
                onManageColorways={(family, skus) => {
                  setManageColorwayPayload({ family, skus })
                }}
                onBack={() => setStep("family")}
                onSelect={(sku) => {
                  setDraft({ ...draft, sku })
                  setStep("details")
                }}
                onSkip={() => {
                  setDraft({ ...draft, sku: null })
                  setStep("details")
                }}
              />
            )}

            {step === "details" && draft.family && (
              <DetailsStep
                draft={draft}
                confirming={confirming}
                onBack={() => {
                  setStep("sku")
                }}
                onChange={(updates) => setDraft({ ...draft, ...updates })}
                onConfirm={handleConfirm}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {createDialogOpen && (
        <ProductUpsertDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          mode="create"
          redirectOnCreate={false}
          onSaved={({ mode, familyId }) => {
            if (mode !== "create") return
            setPendingCreatedFamilyId(familyId)
            setStep("family")
            setDraft(EMPTY_DRAFT)
            setDialogOpen(true)
          }}
        />
      )}

      {manageColorwayPayload && (
        <ProductUpsertDialog
          open
          onOpenChange={(open) => {
            if (!open) setManageColorwayPayload(null)
          }}
          mode="edit"
          family={manageColorwayPayload.family}
          skus={manageColorwayPayload.skus}
          redirectOnCreate={false}
        />
      )}
    </div>
  )
}

/* ─── Assignment row (read-only display) ─── */

function AssignmentRow({
  assignment,
  disabled,
  onEdit,
  onRemove,
}: {
  readonly assignment: ProductAssignment
  readonly disabled?: boolean
  readonly onEdit: () => void
  readonly onRemove: () => void
}) {
  const needsLookup =
    !assignment.thumbUrl && !assignment.skuImageUrl && !assignment.familyImageUrl

  const familyId =
    needsLookup && assignment.familyId && assignment.familyId.length > 0
      ? assignment.familyId
      : null

  const skuId =
    needsLookup
      ? (assignment.skuId ?? assignment.colourId ?? null)
      : null

  const { data: family } = useProductFamilyDoc(familyId)
  const { data: sku } = useProductSkuDoc(familyId, skuId)

  const label = assignment.familyName ?? assignment.familyId
  const colourLabel = assignment.colourName
  const sizeLabel = assignment.sizeScope === "single" && assignment.size
    ? assignment.size
    : assignment.sizeScope === "all"
    ? "All sizes"
    : assignment.sizeScope === "pending"
    ? "Size TBD"
    : null
  const qty = assignment.quantity ?? 1

  const meta: string[] = []
  if (colourLabel) meta.push(colourLabel)
  if (sizeLabel) meta.push(sizeLabel)
  if (qty > 1) meta.push(`×${qty}`)

  const thumbSrc =
    assignment.thumbUrl ??
    assignment.skuImageUrl ??
    assignment.familyImageUrl ??
    sku?.imagePath ??
    family?.thumbnailImagePath ??
    family?.headerImagePath

  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-2.5 py-1.5">
      <CollapsibleThumb src={thumbSrc} alt={label} />
      <div
        className="flex min-w-0 flex-1 cursor-pointer flex-col"
        onClick={disabled ? undefined : onEdit}
      >
        <span className="truncate text-sm font-medium text-[var(--color-text)]">{label}</span>
        {meta.length > 0 && (
          <span className="truncate text-xs text-[var(--color-text-subtle)]">
            {meta.join(" · ")}
          </span>
        )}
      </div>
      {!disabled && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-[var(--color-text-subtle)]"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  )
}

/* ─── Collapsible thumbnail: renders nothing when src is missing or broken ─── */

function CollapsibleThumb({
  src,
  alt,
}: {
  readonly src: string | undefined
  readonly alt: string
}) {
  const resolvedSrc = useStorageUrl(src)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    setErrored(false)
  }, [src])

  if (!resolvedSrc || errored) return null

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] object-cover"
      onError={() => setErrored(true)}
    />
  )
}

function StepBadge({
  label,
  value,
  onClear,
}: {
  readonly label: string
  readonly value: string
  readonly onClear: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs text-[var(--color-text)]"
      title={`Clear ${label}`}
    >
      <span className="text-[var(--color-text-subtle)]">{label}:</span>
      <span className="font-medium">{value}</span>
      <X className="h-3 w-3 text-[var(--color-text-subtle)]" />
    </button>
  )
}

/* ─── Step 1: Family selection ─── */

function FamilyStep({
  onSelect,
  canManageCatalog,
  onCreateProduct,
  autoSelectFamilyId,
  onAutoSelectHandled,
}: {
  readonly onSelect: (family: ProductFamily) => void
  readonly canManageCatalog: boolean
  readonly onCreateProduct: () => void
  readonly autoSelectFamilyId: string | null
  readonly onAutoSelectHandled: () => void
}) {
  const { data: families } = useProductFamilies()
  const [query, setQuery] = useState("")
  const [gender, setGender] = useState<string>("__all__")
  const [productType, setProductType] = useState<string>("__all__")
  const [subcategory, setSubcategory] = useState<string>("__all__")

  const genderOptions = useMemo(() => {
    const explicitOrder = new Map<string, number>([
      ["men", 0],
      ["women", 1],
      ["unisex", 2],
    ])
    const keys = new Set<string>()
    for (const family of families) keys.add(canonicalGenderKey(family.gender))
    return Array.from(keys)
      .sort((a, b) => {
        const aRank = explicitOrder.get(a)
        const bRank = explicitOrder.get(b)
        if (aRank !== undefined && bRank !== undefined) return aRank - bRank
        if (aRank !== undefined) return -1
        if (bRank !== undefined) return 1
        return genderLabel(a).localeCompare(genderLabel(b))
      })
      .map((key) => ({ key, label: genderLabel(key) }))
  }, [families])

  const typeOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const family of families) {
      const familyGender = canonicalGenderKey(family.gender)
      if (gender !== "__all__" && familyGender !== gender) continue
      const type = normalizeText(family.productType)
      if (type) keys.add(type)
    }
    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, label: humanizeLabel(key) }))
  }, [families, gender])

  const subcategoryOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const family of families) {
      const familyGender = canonicalGenderKey(family.gender)
      if (gender !== "__all__" && familyGender !== gender) continue
      const type = normalizeText(family.productType) ?? null
      if (productType !== "__all__" && type !== productType) continue
      const sub = normalizeText(family.productSubcategory)
      if (sub) keys.add(sub)
    }
    return Array.from(keys)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, label: humanizeLabel(key) }))
  }, [families, gender, productType])

  const visibleFamilies = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return families.filter((family) => {
      const familyGender = canonicalGenderKey(family.gender)
      const familyType = normalizeText(family.productType) ?? "__unknown__"
      const familySubcategory = normalizeText(family.productSubcategory) ?? "__unknown__"

      if (gender !== "__all__" && familyGender !== gender) return false
      if (productType !== "__all__" && familyType !== productType) return false
      if (subcategory !== "__all__" && familySubcategory !== subcategory) return false

      if (!normalizedQuery) return true

      const haystack = [
        family.styleName,
        family.styleNumber,
        family.gender,
        family.productType,
        family.productSubcategory,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()

      return haystack.includes(normalizedQuery)
    })
  }, [families, gender, productType, subcategory, query])

  useEffect(() => {
    if (!autoSelectFamilyId) return
    const created = families.find((family) => family.id === autoSelectFamilyId)
    if (!created) return
    onSelect(created)
    onAutoSelectHandled()
  }, [autoSelectFamilyId, families, onSelect, onAutoSelectHandled])

  const hasActiveFilters =
    gender !== "__all__" ||
    productType !== "__all__" ||
    subcategory !== "__all__" ||
    query.trim().length > 0

  const canPickType = gender !== "__all__"
  const canPickSubcategory = canPickType && productType !== "__all__" && subcategoryOptions.length > 0

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-subtle)]" />
          <Input
            placeholder="Search product families..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        {canManageCatalog && (
          <Button variant="outline" size="sm" onClick={onCreateProduct}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create product
          </Button>
        )}
      </div>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {gender === "__all__" ? (
            <Select
              value={gender}
              onValueChange={(next) => {
                setGender(next)
                setProductType("__all__")
                setSubcategory("__all__")
              }}
            >
              <SelectTrigger className="h-8 w-[190px] bg-[var(--color-surface)] text-xs">
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Gender</SelectItem>
                {genderOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <StepBadge
              label="Gender"
              value={genderLabel(gender)}
              onClear={() => {
                setGender("__all__")
                setProductType("__all__")
                setSubcategory("__all__")
              }}
            />
          )}

          {canPickType && (
            productType === "__all__" ? (
              <Select
                value={productType}
              onValueChange={(next) => {
                setProductType(next)
                setSubcategory("__all__")
              }}
            >
              <SelectTrigger className="h-8 w-[210px] bg-[var(--color-surface)] text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Type</SelectItem>
                {typeOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <StepBadge
                label="Type"
                value={humanizeLabel(productType)}
                onClear={() => {
                  setProductType("__all__")
                  setSubcategory("__all__")
                }}
              />
            )
          )}

          {canPickSubcategory && (
            subcategory === "__all__" ? (
              <Select
              value={subcategory}
              onValueChange={setSubcategory}
            >
              <SelectTrigger className="h-8 w-[230px] bg-[var(--color-surface)] text-xs">
                <SelectValue placeholder="Subcategory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Subcategory</SelectItem>
                {subcategoryOptions.map((option) => (
                  <SelectItem key={option.key} value={option.key}>
                    {option.label}
                  </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <StepBadge
                label="Subcategory"
                value={humanizeLabel(subcategory)}
                onClear={() => setSubcategory("__all__")}
              />
            )
          )}

          {!canPickType && (
            <span className="text-xs text-[var(--color-text-subtle)]">
              Choose a gender to unlock type filters.
            </span>
          )}
          {canPickType && productType === "__all__" && (
            <span className="text-xs text-[var(--color-text-subtle)]">
              Choose a type to unlock subcategory.
            </span>
          )}
          {canPickType && productType !== "__all__" && subcategoryOptions.length === 0 && (
            <span className="text-xs text-[var(--color-text-subtle)]">
              No subcategories available for this type.
            </span>
          )}

          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-[var(--color-text-subtle)]"
              onClick={() => {
                setQuery("")
                setGender("__all__")
                setProductType("__all__")
                setSubcategory("__all__")
              }}
            >
              Clear all
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-[var(--color-text-subtle)]">
        <span>{visibleFamilies.length} families</span>
        <span className="truncate">
          {gender !== "__all__" ? genderLabel(gender) : "All"}
          {productType !== "__all__" ? ` > ${humanizeLabel(productType)}` : ""}
          {subcategory !== "__all__" ? ` > ${humanizeLabel(subcategory)}` : ""}
        </span>
      </div>

      <div className="max-h-[340px] overflow-y-auto rounded-md border border-[var(--color-border)]">
        {visibleFamilies.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <p className="text-sm font-medium text-[var(--color-text)]">No product families found</p>
            <p className="text-xs text-[var(--color-text-subtle)]">
              Try a broader search or clear filters.
            </p>
            {canManageCatalog && (
              <Button variant="outline" size="sm" onClick={onCreateProduct}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Create new product
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {visibleFamilies.map((family) => {
              const taxonomy = taxonomyLabelForFamily(family)
              const genderBadge = genderLabel(canonicalGenderKey(family.gender))
              return (
                <button
                  key={family.id}
                  type="button"
                  onClick={() => onSelect(family)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[var(--color-surface-subtle)]"
                >
                  <CollapsibleThumb
                    src={family.thumbnailImagePath ?? family.headerImagePath}
                    alt={family.styleName}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-baseline gap-2">
                      <span className="truncate text-sm font-medium text-[var(--color-text)]">{family.styleName}</span>
                      {family.styleNumber && (
                        <span className="shrink-0 text-xs text-[var(--color-text-subtle)]">
                          ({family.styleNumber})
                        </span>
                      )}
                    </div>
                    {taxonomy.length > 0 && (
                      <p className="truncate text-xs text-[var(--color-text-subtle)]">{taxonomy}</p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 border text-2xs ${genderTagClass(canonicalGenderKey(family.gender))}`}
                  >
                    {genderBadge}
                  </Badge>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Step 2: SKU / Colorway selection ─── */

function SkuStep({
  family,
  familyImageUrl,
  canManageCatalog,
  onManageColorways,
  onBack,
  onSelect,
  onSkip,
}: {
  readonly family: ProductFamily
  readonly familyImageUrl: string | undefined
  readonly canManageCatalog: boolean
  readonly onManageColorways: (family: ProductFamily, skus: ReadonlyArray<ProductSku>) => void
  readonly onBack: () => void
  readonly onSelect: (sku: ProductSku) => void
  readonly onSkip: () => void
}) {
  const { data: skus, loading } = useProductSkus(family.id)
  const [query, setQuery] = useState("")

  const visibleSkus = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return skus
    return skus.filter((sku) => {
      const haystack = [
        sku.colorName ?? sku.name,
        sku.skuCode,
        sku.colorKey,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
      return haystack.includes(normalizedQuery)
    })
  }, [skus, query])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="truncate text-sm font-medium">{family.styleName}</span>
        </div>
        {canManageCatalog && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onManageColorways(family, skus)}
            disabled={loading}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add colorway
          </Button>
        )}
      </div>

      {loading ? (
        <p className="px-2 py-4 text-center text-sm text-[var(--color-text-subtle)]">
          Loading colorways...
        </p>
      ) : skus.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-sm text-[var(--color-text-subtle)]">No colorways found</p>
          {canManageCatalog && (
            <Button variant="outline" size="sm" onClick={() => onManageColorways(family, skus)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add new colorway
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Continue without colorway
          </Button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-text-subtle)]" />
            <Input
              placeholder="Search colorways..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <div className="max-h-[280px] overflow-y-auto rounded-md border border-[var(--color-border)]">
            {visibleSkus.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--color-text-subtle)]">
                No colorways match.
              </p>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {visibleSkus.map((sku) => (
                  <button
                    key={sku.id}
                    type="button"
                    onClick={() => onSelect(sku)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--color-surface-subtle)]"
                  >
                    <CollapsibleThumb
                      src={sku.imagePath ?? familyImageUrl}
                      alt={sku.colorName ?? sku.name}
                    />
                    {(sku.hexColor ?? sku.colourHex) && (
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--color-border)]"
                        style={{ backgroundColor: sku.hexColor ?? sku.colourHex }}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text)]">
                      {sku.colorName ?? sku.name}
                    </span>
                    {sku.skuCode && (
                      <span className="shrink-0 text-xs text-[var(--color-text-subtle)]">
                        ({sku.skuCode})
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" className="self-start" onClick={onSkip}>
            Skip — no specific colorway
          </Button>
        </>
      )}
    </div>
  )
}

/* ─── Step 3: Details (sizeScope, size, quantity) ─── */

function DetailsStep({
  draft,
  confirming,
  onBack,
  onChange,
  onConfirm,
}: {
  readonly draft: DraftAssignment
  readonly confirming: boolean
  readonly onBack: () => void
  readonly onChange: (updates: Partial<DraftAssignment>) => void
  readonly onConfirm: () => void
}) {
  const { data: skus } = useProductSkus(draft.family?.id ?? null)

  const availableSizes = useMemo(() => {
    if (draft.sku?.sizes && draft.sku.sizes.length > 0) {
      return draft.sku.sizes
    }
    // Fallback: collect sizes from all SKUs of this family
    const allSizes = new Set<string>()
    for (const sku of skus) {
      if (sku.sizes) {
        for (const size of sku.sizes) {
          allSizes.add(size)
        }
      }
    }
    return Array.from(allSizes)
  }, [draft.sku, skus])

  const canConfirm =
    draft.family !== null &&
    (draft.sizeScope !== "single" || draft.size !== "") &&
    draft.quantity >= 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{draft.family?.styleName}</span>
          {draft.sku && (
            <span className="text-xs text-[var(--color-text-subtle)]">
              {draft.sku.colorName ?? draft.sku.name}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Size scope */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium">Size Scope</Label>
        <Select
          value={draft.sizeScope}
          onValueChange={(value) => onChange({ sizeScope: value as SizeScope, size: "" })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sizes (Bulk)</SelectItem>
            <SelectItem value="single">Single size</SelectItem>
            <SelectItem value="pending">Pending (TBD)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Size picker — only when sizeScope is "single" */}
      {draft.sizeScope === "single" && (
        <div>
          <Label className="mb-1.5 block text-xs font-medium">Size</Label>
          {availableSizes.length > 0 ? (
            <Select value={draft.size} onValueChange={(value) => onChange({ size: value })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select size..." />
              </SelectTrigger>
              <SelectContent>
                {availableSizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              placeholder="Enter size..."
              value={draft.size}
              onChange={(e) => onChange({ size: e.target.value })}
              className="text-sm"
            />
          )}
        </div>
      )}

      {/* Quantity */}
      <div>
        <Label className="mb-1.5 block text-xs font-medium">Quantity</Label>
        <Input
          type="number"
          min={1}
          value={draft.quantity}
          onChange={(e) => onChange({ quantity: Math.max(1, Number(e.target.value) || 1) })}
          className="w-24 text-sm"
        />
      </div>

      <Button
        onClick={onConfirm}
        disabled={!canConfirm || confirming}
        className="self-end"
        data-testid="picker-confirm"
      >
        {confirming && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
        {confirming ? "Saving…" : draft.family ? "Confirm" : "Select a product first"}
      </Button>
    </div>
  )
}
