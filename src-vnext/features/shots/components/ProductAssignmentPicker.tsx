import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/ui/command"
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
import {
  useProductFamilies,
  useProductSkus,
} from "@/features/shots/hooks/usePickerData"
import { Package, Plus, X, ChevronLeft, Loader2 } from "lucide-react"
import { resolveStoragePath } from "@/shared/lib/resolveStoragePath"
import { toast } from "sonner"
import type { ProductAssignment, ProductFamily, ProductSku, SizeScope } from "@/shared/types"

interface ProductAssignmentPickerProps {
  readonly selected: ReadonlyArray<ProductAssignment>
  readonly onSave: (products: ProductAssignment[]) => Promise<boolean>
  readonly disabled?: boolean
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

export function ProductAssignmentPicker({
  selected,
  onSave,
  disabled,
}: ProductAssignmentPickerProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [step, setStep] = useState<AddStep>("family")
  const [draft, setDraft] = useState<DraftAssignment>(EMPTY_DRAFT)
  const [editIndex, setEditIndex] = useState<number | null>(null)

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

  const [removing, setRemoving] = useState<number | null>(null)

  const handleRemove = async (index: number) => {
    const next = selected.filter((_, i) => i !== index).map(stripUndefined)
    setRemoving(index)
    try {
      const ok = await onSave([...next])
      if (!ok) {
        toast.error("Failed to remove product. Try again.")
      }
    } finally {
      setRemoving(null)
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editIndex !== null ? "Edit Product" : "Add Product"}
            </DialogTitle>
          </DialogHeader>

          {step === "family" && (
            <FamilyStep
              onSelect={(family) => {
                setDraft({ ...EMPTY_DRAFT, family })
                setStep("sku")
              }}
            />
          )}

          {step === "sku" && draft.family && (
            <SkuStep
              familyId={draft.family.id}
              familyName={draft.family.styleName}
              familyImageUrl={draft.family.headerImagePath ?? draft.family.thumbnailImagePath}
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
                if (editIndex !== null) {
                  setDialogOpen(false)
                } else {
                  setStep("sku")
                }
              }}
              onChange={(updates) => setDraft({ ...draft, ...updates })}
              onConfirm={handleConfirm}
            />
          )}
        </DialogContent>
      </Dialog>
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

  return (
    <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] px-2.5 py-1.5">
      <CollapsibleThumb src={assignment.thumbUrl} alt={label} />
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
  const [errored, setErrored] = useState(false)

  if (!src || errored) return null

  return (
    <img
      src={src}
      alt={alt}
      className="h-10 w-10 shrink-0 rounded-[var(--radius-md)] border border-[var(--color-border)] object-cover"
      onError={() => setErrored(true)}
    />
  )
}

/* ─── Step 1: Family selection ─── */

function FamilyStep({
  onSelect,
}: {
  readonly onSelect: (family: ProductFamily) => void
}) {
  const { data: families } = useProductFamilies()

  return (
    <Command className="max-h-[300px]">
      <CommandInput placeholder="Search product families..." />
      <CommandList>
        <CommandEmpty>No product families found.</CommandEmpty>
        <CommandGroup>
          {families.map((f) => (
            <CommandItem
              key={f.id}
              onSelect={() => onSelect(f)}
              className="flex items-center gap-2"
            >
              <span>{f.styleName}</span>
              {f.styleNumber && (
                <span className="text-xs text-[var(--color-text-subtle)]">
                  ({f.styleNumber})
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

/* ─── Step 2: SKU / Colorway selection ─── */

function SkuStep({
  familyId,
  familyName,
  familyImageUrl,
  onBack,
  onSelect,
  onSkip,
}: {
  readonly familyId: string
  readonly familyName: string
  readonly familyImageUrl: string | undefined
  readonly onBack: () => void
  readonly onSelect: (sku: ProductSku) => void
  readonly onSkip: () => void
}) {
  const { data: skus, loading } = useProductSkus(familyId)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">{familyName}</span>
      </div>

      {loading ? (
        <p className="px-2 py-4 text-center text-sm text-[var(--color-text-subtle)]">
          Loading colorways...
        </p>
      ) : skus.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-sm text-[var(--color-text-subtle)]">No colorways found</p>
          <Button variant="outline" size="sm" onClick={onSkip}>
            Continue without colorway
          </Button>
        </div>
      ) : (
        <>
          <Command className="max-h-[250px]">
            <CommandInput placeholder="Search colorways..." />
            <CommandList>
              <CommandEmpty>No colorways match.</CommandEmpty>
              <CommandGroup>
                {skus.map((sku) => (
                  <CommandItem
                    key={sku.id}
                    onSelect={() => onSelect(sku)}
                    className="flex min-h-[44px] items-center gap-2"
                  >
                    <CollapsibleThumb
                      src={sku.imagePath ?? familyImageUrl}
                      alt={sku.colorName ?? sku.name}
                    />
                    {sku.colourHex && (
                      <span
                        className="inline-block h-3 w-3 shrink-0 rounded-full border border-[var(--color-border)]"
                        style={{ backgroundColor: sku.colourHex }}
                      />
                    )}
                    <span className="min-w-0 truncate">{sku.colorName ?? sku.name}</span>
                    {sku.skuCode && (
                      <span className="shrink-0 text-xs text-[var(--color-text-subtle)]">
                        ({sku.skuCode})
                      </span>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
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
        for (const s of sku.sizes) {
          allSizes.add(s)
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
          onValueChange={(v) => onChange({ sizeScope: v as SizeScope, size: "" })}
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
            <Select value={draft.size} onValueChange={(v) => onChange({ size: v })}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select size..." />
              </SelectTrigger>
              <SelectContent>
                {availableSizes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
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
