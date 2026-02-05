import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageProducts } from "@/shared/lib/rbac"
import type { ProductFamily, ProductSku } from "@/shared/types"
import { createProductFamilyWithSkus, updateProductFamilyWithSkus, type ProductFamilyDraft, type ProductSkuDraft } from "@/features/products/lib/productWrites"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Checkbox } from "@/ui/checkbox"
import { Label } from "@/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { Separator } from "@/ui/separator"
import { Trash2, Plus, Image as ImageIcon, X } from "lucide-react"
import { ProductImage } from "@/features/products/components/ProductImage"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { toast } from "@/shared/hooks/use-toast"

type Mode = "create" | "edit"

interface ProductUpsertDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly mode: Mode
  readonly family?: ProductFamily
  readonly skus?: ReadonlyArray<ProductSku>
}

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
    notes: typeof existing?.notes === "string" ? existing.notes : "",
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

function SkuRow({
  sku,
  onChange,
  onRemoveExisting,
  onRemoveNew,
  onUndoRemove,
  disabled,
}: {
  readonly sku: ProductSkuFormState
  readonly onChange: (next: ProductSkuFormState) => void
  readonly onRemoveExisting: (id: string) => void
  readonly onRemoveNew: () => void
  readonly onUndoRemove: () => void
  readonly disabled: boolean
}) {
  const isDeleted = sku.deleted === true
  const previewUrl = useObjectUrl(sku.imageFile ?? null)

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 items-start gap-3">
          <ProductImage
            src={isDeleted ? undefined : previewUrl ?? sku.imagePath ?? undefined}
            alt={sku.colorName || "Colorway"}
            size="md"
            className={isDeleted ? "opacity-50" : undefined}
          />
          <div className="grid flex-1 gap-3 md:grid-cols-4">
            <div className="flex flex-col gap-2 md:col-span-2">
              <Label className="text-xs">Color name</Label>
              <Input
                value={sku.colorName}
                disabled={disabled || isDeleted}
                onChange={(e) => onChange({ ...sku, colorName: e.target.value })}
                placeholder="Black"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">SKU</Label>
              <Input
                value={sku.skuCode}
                disabled={disabled || isDeleted}
                onChange={(e) => onChange({ ...sku, skuCode: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-xs">Status</Label>
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

            <div className="flex flex-col gap-2 md:col-span-4">
              <Label className="text-xs">Sizes (CSV)</Label>
              <Input
                value={sku.sizesCsv}
                disabled={disabled || isDeleted}
                onChange={(e) => onChange({ ...sku, sizesCsv: e.target.value })}
                placeholder="S, M, L"
              />
              <p className="text-xs text-[var(--color-text-subtle)]">
                Leave blank to inherit family sizes.
              </p>
            </div>

            {!disabled && !isDeleted && (
              <div className="flex flex-col gap-2 md:col-span-4">
                <Label className="text-xs">Image</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      onChange({ ...sku, imageFile: file, removeImage: false })
                    }}
                  />
                  {(sku.imagePath || sku.imageFile) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() => onChange({ ...sku, imageFile: null, removeImage: true, imagePath: null })}
                    >
                      Remove image
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {!disabled && (
          <div className="flex items-center gap-2">
            {isDeleted ? (
              <Button type="button" variant="ghost" size="sm" onClick={onUndoRemove}>
                Undo
              </Button>
            ) : sku.id ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemoveExisting(sku.id!)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="button" variant="ghost" size="sm" onClick={onRemoveNew}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {isDeleted && (
        <p className="mt-2 text-xs text-[var(--color-text-subtle)]">
          This colorway will be marked deleted on save.
        </p>
      )}
    </div>
  )
}

export function ProductUpsertDialog({
  open,
  onOpenChange,
  mode,
  family,
  skus,
}: ProductUpsertDialogProps) {
  const { clientId, role, user } = useAuth()
  const isMobile = useIsMobile()
  const navigate = useNavigate()

  const canEdit = !isMobile && canManageProducts(role)
  const existingSkus = useMemo(() => (skus ?? []).filter((s) => s.deleted !== true), [skus])

  const [draft, setDraft] = useState<ProductFamilyDraft>(() => defaultFamilyDraft(family))
  const [skuDrafts, setSkuDrafts] = useState<ReadonlyArray<ProductSkuFormState>>(
    () => (existingSkus.length > 0 ? existingSkus.map(skuToDraft).map(toFormState) : [toFormState(emptySkuDraft())]),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingRemoveSkuId, setPendingRemoveSkuId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setDraft(defaultFamilyDraft(family))
    setSkuDrafts(existingSkus.length > 0 ? existingSkus.map(skuToDraft).map(toFormState) : [toFormState(emptySkuDraft())])
    setSaving(false)
    setError(null)
    setPendingRemoveSkuId(null)
    setConfirmOpen(false)
  }, [open, family, existingSkus])

  const isEditMode = mode === "edit"
  const title = isEditMode ? "Edit Product" : "New Product"
  const genderSelectValue = draft.gender.trim().length > 0 ? draft.gender : "__unset__"

  const canSave = canEdit && Boolean(clientId) && draft.styleName.trim().length > 0 &&
    skuDrafts.some((s) => s.deleted !== true && s.colorName.trim().length > 0)

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

      if (isEditMode) {
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
        onOpenChange(false)
        return
      }

      const familyId = await createProductFamilyWithSkus({
        clientId,
        userId: user?.uid ?? null,
        family: normalizedDraft,
        skus: normalizedSkus.filter((s) => s.deleted !== true),
      })
      toast({ title: "Created", description: "Product created." })
      onOpenChange(false)
      navigate(`/products/${familyId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product")
    } finally {
      setSaving(false)
    }
  }

  const requestRemoveSku = (skuId: string | undefined) => {
    if (!skuId) return
    setPendingRemoveSkuId(skuId)
    setConfirmOpen(true)
  }

  const applyRemoveSku = () => {
    if (!pendingRemoveSkuId) return
    setSkuDrafts((prev) =>
      prev.map((s) => (s.id === pendingRemoveSkuId ? { ...s, deleted: true } : s)),
    )
    setPendingRemoveSkuId(null)
  }

  const addSku = () => {
    setSkuDrafts((prev) => [...prev, toFormState(emptySkuDraft())])
  }

  const removeNewSkuRow = (idx: number) => {
    setSkuDrafts((prev) => prev.filter((_, i) => i !== idx))
  }

  const headerPreview = useObjectUrl(draft.headerImageFile ?? null)
  const thumbPreview = useObjectUrl(draft.thumbnailImageFile ?? null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!canEdit && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Editing is available on desktop for producers/admins.
          </p>
        )}

        <div className="flex flex-col gap-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="styleName">Style name</Label>
              <Input
                id="styleName"
                value={draft.styleName}
                onChange={(e) => setDraft((p) => ({ ...p, styleName: e.target.value }))}
                placeholder="e.g. Merino Short Sleeve Henley"
                disabled={!canEdit}
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
                  placeholder="e.g. UM2026-1026"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(value) => setDraft((p) => ({ ...p, status: value }))}
                  disabled={!canEdit}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="gender">Gender</Label>
                <Select
                  value={genderSelectValue}
                  onValueChange={(value) =>
                    setDraft((p) => ({ ...p, gender: value === "__unset__" ? "" : value }))
                  }
                  disabled={!canEdit}
                >
                  <SelectTrigger id="gender">
                    <SelectValue placeholder="Unspecified" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unset__">Unspecified</SelectItem>
                    <SelectItem value="unisex">Unisex</SelectItem>
                    <SelectItem value="men">Men</SelectItem>
                    <SelectItem value="women">Women</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sizes">Sizes (CSV)</Label>
                <Input
                  id="sizes"
                  value={draft.sizesCsv}
                  onChange={(e) => setDraft((p) => ({ ...p, sizesCsv: e.target.value }))}
                  placeholder="XS, S, M, L, XL"
                  disabled={!canEdit}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-border)] px-3 py-2">
              <Checkbox
                id="archived"
                checked={draft.archived}
                disabled={!canEdit}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="type">Type</Label>
                <Input
                  id="type"
                  value={draft.productType}
                  onChange={(e) => setDraft((p) => ({ ...p, productType: e.target.value }))}
                  placeholder="tops"
                  disabled={!canEdit}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Input
                  id="subcategory"
                  value={draft.productSubcategory}
                  onChange={(e) => setDraft((p) => ({ ...p, productSubcategory: e.target.value }))}
                  placeholder="tshirts"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Header image</Label>
                {canEdit && (draft.headerImagePath || draft.headerImageFile) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        headerImageFile: null,
                        removeHeaderImage: true,
                      }))
                    }
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ProductImage
                  src={draft.removeHeaderImage ? undefined : headerPreview ?? draft.headerImagePath ?? undefined}
                  alt="Header"
                  size="md"
                />
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={!canEdit}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setDraft((p) => ({
                        ...p,
                        headerImageFile: file,
                        removeHeaderImage: false,
                      }))
                    }}
                  />
                  <p className="text-xs text-[var(--color-text-subtle)]">
                    WebP upload · 1600px max
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Thumbnail image</Label>
                {canEdit && (draft.thumbnailImagePath || draft.thumbnailImageFile) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() =>
                      setDraft((p) => ({
                        ...p,
                        thumbnailImageFile: null,
                        removeThumbnailImage: true,
                      }))
                    }
                  >
                    <X className="h-4 w-4" />
                    Remove
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-3">
                <ProductImage
                  src={draft.removeThumbnailImage ? undefined : thumbPreview ?? draft.thumbnailImagePath ?? undefined}
                  alt="Thumbnail"
                  size="md"
                />
                <div className="flex flex-col gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    disabled={!canEdit}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      setDraft((p) => ({
                        ...p,
                        thumbnailImageFile: file,
                        removeThumbnailImage: false,
                      }))
                    }}
                  />
                  <p className="text-xs text-[var(--color-text-subtle)]">
                    Used on list cards
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-[var(--color-text-subtle)]" />
                <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
                  Colorways
                </h3>
              </div>
              {canEdit && (
                <Button type="button" variant="outline" size="sm" onClick={addSku}>
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {skuDrafts.map((sku, idx) => (
                <SkuRow
                  key={sku.localId}
                  sku={sku}
                  disabled={!canEdit}
                  onChange={(next) =>
                    setSkuDrafts((prev) => prev.map((s, i) => (i === idx ? next : s)))
                  }
                  onRemoveExisting={(id) => requestRemoveSku(id)}
                  onRemoveNew={() => removeNewSkuRow(idx)}
                  onUndoRemove={() =>
                    setSkuDrafts((prev) =>
                      prev.map((s, i) => (i === idx ? { ...s, deleted: false } : s)),
                    )
                  }
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!canSave || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove colorway?"
        description="This will mark the colorway as deleted. You can still restore it later if needed."
        confirmLabel="Remove"
        destructive
        onConfirm={applyRemoveSku}
      />
    </Dialog>
  )
}
