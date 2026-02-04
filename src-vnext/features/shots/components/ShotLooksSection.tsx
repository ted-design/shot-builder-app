import { useEffect, useMemo, useRef, useState } from "react"
import { ProductAssignmentPicker } from "@/features/shots/components/ProductAssignmentPicker"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { updateShotField } from "@/features/shots/lib/updateShot"
import { uploadShotReferenceImage } from "@/shared/lib/uploadImage"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { ImagePlus, Plus, Star, Trash2, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import type { ProductAssignment, Shot, ShotLook, ShotReferenceImage } from "@/shared/types"

const HERO_NONE_VALUE = "__none__"

function getLookLabel(order: number): string {
  if (order === 0) return "Primary"
  return `Alt ${String.fromCharCode(64 + order)}`
}

function generateLookId(): string {
  return `look_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function generateReferenceId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function sanitizeForFirestore(value: unknown): unknown {
  if (value === undefined) return null
  if (value === null) return null
  if (Array.isArray(value)) return value.map(sanitizeForFirestore)
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined) continue
      out[k] = sanitizeForFirestore(v)
    }
    return out
  }
  return value
}

function normalizeLooksForWrite(looks: ReadonlyArray<ShotLook>): ShotLook[] {
  const sorted = [...looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return sorted.map((look, index) => ({
    ...look,
    order: index,
    label: getLookLabel(index),
    products: look.products ?? [],
    heroProductId: look.heroProductId ?? null,
    references: look.references ?? [],
    displayImageId: look.displayImageId ?? null,
  }))
}

function productHeroOptions(products: ReadonlyArray<ProductAssignment>) {
  const seen = new Set<string>()
  const options: Array<{ readonly familyId: string; readonly label: string }> = []
  for (const p of products) {
    const id = p.familyId
    if (!id || seen.has(id)) continue
    seen.add(id)
    const label = p.familyName ?? id
    options.push({ familyId: id, label })
  }
  options.sort((a, b) => a.label.localeCompare(b.label))
  return options
}

export function ShotLooksSection({
  shot,
  canEdit,
}: {
  readonly shot: Shot
  readonly canEdit: boolean
}) {
  const { clientId, user } = useAuth()
  const looks = useMemo(
    () => (shot.looks ? [...shot.looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []),
    [shot.looks],
  )

  const activeLookIdForCover = useMemo(() => {
    if (shot.activeLookId && looks.some((l) => l.id === shot.activeLookId)) {
      return shot.activeLookId
    }
    return looks.length > 0 ? looks[0]!.id : null
  }, [looks, shot.activeLookId])

  const [selectedLookId, setSelectedLookId] = useState<string | null>(() => activeLookIdForCover)

  useEffect(() => {
    setSelectedLookId((prev) => {
      if (looks.length === 0) return null
      if (prev && looks.some((l) => l.id === prev)) return prev
      return activeLookIdForCover
    })
  }, [looks, activeLookIdForCover])

  const selectedLook = looks.find((l) => l.id === selectedLookId) ?? null

  const [saving, setSaving] = useState(false)

  const saveLooks = async (
    nextLooks: ReadonlyArray<ShotLook>,
    nextActiveLookId?: string | null,
  ): Promise<boolean> => {
    if (!clientId) return false
    setSaving(true)
    try {
      const normalized = normalizeLooksForWrite(nextLooks)
      const sanitized = sanitizeForFirestore(normalized)
      await updateShotField(shot.id, clientId, {
        looks: sanitized,
        activeLookId: nextActiveLookId,
      })
      return true
    } catch {
      toast.error("Failed to save look options")
      return false
    } finally {
      setSaving(false)
    }
  }

  const [confirmDeleteLookOpen, setConfirmDeleteLookOpen] = useState(false)
  const [pendingDeleteLookId, setPendingDeleteLookId] = useState<string | null>(null)

  const requestDeleteLook = (lookId: string) => {
    setPendingDeleteLookId(lookId)
    setConfirmDeleteLookOpen(true)
  }

  const deleteLook = async () => {
    if (!pendingDeleteLookId) return
    const next = looks.filter((l) => l.id !== pendingDeleteLookId)
    const nextActive =
      pendingDeleteLookId === activeLookIdForCover
        ? (next[0]?.id ?? null)
        : undefined
    const ok = await saveLooks(next, nextActive)
    if (ok) {
      setPendingDeleteLookId(null)
    }
  }

  const addLook = async () => {
    const order = looks.length
    const nextId = generateLookId()
    const next: ShotLook[] = [
      ...looks,
      {
        id: nextId,
        order,
        label: getLookLabel(order),
        products: [],
        heroProductId: null,
        references: [],
        displayImageId: null,
      },
    ]
    const setActive = looks.length === 0 ? nextId : undefined
    const ok = await saveLooks(next, setActive)
    if (ok) {
      setSelectedLookId(next[next.length - 1]!.id)
    }
  }

  const setActiveLookForCover = async (lookId: string) => {
    if (!clientId) return
    setSaving(true)
    try {
      await updateShotField(shot.id, clientId, { activeLookId: lookId })
    } catch {
      toast.error("Failed to set active look")
    } finally {
      setSaving(false)
    }
  }

  if (looks.length === 0) {
    return (
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)]">Look options</p>
            <p className="mt-0.5 text-xs text-[var(--color-text-subtle)]">
              Create a Primary look and optional alternates. Each look can have products and references.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" onClick={addLook} disabled={saving}>
              <Plus className="mr-1.5 h-4 w-4" />
              Add Primary
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--color-text)]">Look options</p>
          {saving && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-subtle)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}
        </div>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={addLook} disabled={saving}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add Alt
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {looks.map((look) => {
          const isSelected = look.id === selectedLookId
          const isActiveForCover = look.id === activeLookIdForCover
          const label = getLookLabel(look.order ?? 0)
          const productsCount = look.products?.length ?? 0
          const refsCount = look.references?.length ?? 0
          return (
            <button
              key={look.id}
              type="button"
              onClick={() => setSelectedLookId(look.id)}
              className={[
                "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                isSelected
                  ? "border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]",
              ].join(" ")}
            >
              <span className="font-medium">{label}</span>
              {isActiveForCover && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  Active
                </Badge>
              )}
              <span className="text-[10px] opacity-80">
                {productsCount}P · {refsCount}R
              </span>
            </button>
          )
        })}
      </div>

      {selectedLook && (
        <div className="mt-4 flex flex-col gap-4">
          {/* Active look control */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--color-text)]">
                Cover follows Active look
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-subtle)]">
                Active: {getLookLabel((looks.find((l) => l.id === activeLookIdForCover)?.order ?? 0))}
              </p>
            </div>
            {canEdit && selectedLook.id !== activeLookIdForCover && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setActiveLookForCover(selectedLook.id)}
                disabled={saving}
              >
                Make active
              </Button>
            )}
          </div>

          {/* Products */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-[var(--color-text-subtle)]">Products</p>
            {canEdit && looks.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-[var(--color-text-subtle)]"
                onClick={() => requestDeleteLook(selectedLook.id)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Delete look
              </Button>
            )}
          </div>

          <ProductAssignmentPicker
            selected={selectedLook.products ?? []}
            disabled={!canEdit}
            onSave={async (products) => {
              const next = looks.map((l) =>
                l.id === selectedLook.id ? { ...l, products } : l,
              )
              return saveLooks(next)
            }}
          />

          {/* Hero product */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-[var(--color-text-subtle)]" />
              <p className="text-xs font-medium text-[var(--color-text-subtle)]">Hero product (optional)</p>
            </div>

            {selectedLook.products.length === 0 ? (
              <p className="text-xs text-[var(--color-text-subtle)]">Add products to enable hero selection.</p>
            ) : (
              <Select
                value={selectedLook.heroProductId ?? HERO_NONE_VALUE}
                onValueChange={async (value) => {
                  const heroProductId = value === HERO_NONE_VALUE ? null : value
                  const next = looks.map((l) =>
                    l.id === selectedLook.id ? { ...l, heroProductId } : l,
                  )
                  await saveLooks(next)
                }}
                disabled={!canEdit}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No hero product" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={HERO_NONE_VALUE}>No hero product</SelectItem>
                  {productHeroOptions(selectedLook.products).map((o) => (
                    <SelectItem key={o.familyId} value={o.familyId}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-[var(--color-text-subtle)]">
              Cover prefers a selected reference image; otherwise it can fall back to the hero product image.
            </p>
          </div>

          {/* References */}
          <ReferencesSection
            shot={shot}
            look={selectedLook}
            looks={looks}
            canEdit={canEdit}
            saving={saving}
            onSaveLooks={saveLooks}
            userId={user?.uid ?? null}
            isActiveForCover={selectedLook.id === activeLookIdForCover}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmDeleteLookOpen}
        onOpenChange={setConfirmDeleteLookOpen}
        title="Delete look?"
        description="This removes the look option, its products, and its reference images."
        confirmLabel="Delete"
        destructive
        onConfirm={deleteLook}
      />
    </div>
  )
}

function ReferencesSection({
  shot,
  look,
  looks,
  canEdit,
  saving,
  onSaveLooks,
  userId,
  isActiveForCover,
}: {
  readonly shot: Shot
  readonly look: ShotLook
  readonly looks: ReadonlyArray<ShotLook>
  readonly canEdit: boolean
  readonly saving: boolean
  readonly onSaveLooks: (nextLooks: ReadonlyArray<ShotLook>) => Promise<boolean>
  readonly userId: string | null
  readonly isActiveForCover: boolean
}) {
  const { clientId } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const refs = look.references ?? []
  const displayImageId = look.displayImageId ?? null

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  const requestRemove = (refId: string) => {
    setPendingRemoveId(refId)
    setConfirmRemoveOpen(true)
  }

  const handleRemove = async () => {
    if (!pendingRemoveId) return
    const nextLooks = looks.map((l) => {
      if (l.id !== look.id) return l
      const nextRefs = (l.references ?? []).filter((r) => r.id !== pendingRemoveId)
      const nextDisplay = l.displayImageId === pendingRemoveId ? null : (l.displayImageId ?? null)
      return { ...l, references: nextRefs, displayImageId: nextDisplay }
    })
    const ok = await onSaveLooks(nextLooks)
    if (ok) setPendingRemoveId(null)
  }

  const setCoverRef = async (refId: string | null) => {
    const nextLooks = looks.map((l) =>
      l.id === look.id ? { ...l, displayImageId: refId } : l,
    )
    await onSaveLooks(nextLooks)
  }

  const onUpload = async (file: File) => {
    if (!clientId) return
    if (refs.length >= 10) {
      toast.error("Maximum 10 reference images per look")
      return
    }

    setUploading(true)
    try {
      const id = generateReferenceId()
      const result = await uploadShotReferenceImage(file, clientId, shot.id, id)
      const newRef: ShotReferenceImage = {
        id,
        path: result.path,
        downloadURL: result.downloadURL,
        uploadedAt: Date.now(),
        uploadedBy: userId ?? undefined,
      }
      const nextLooks = looks.map((l) =>
        l.id === look.id ? { ...l, references: [...(l.references ?? []), newRef] } : l,
      )
      await onSaveLooks(nextLooks)
    } catch {
      toast.error("Failed to upload reference image")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-[var(--color-text-subtle)]">References</p>
          {displayImageId && (
            <Badge variant="secondary" className="text-[10px]">
              {isActiveForCover ? "Cover (active)" : "Cover set"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => fileRef.current?.click()}
                disabled={saving || uploading || refs.length >= 10}
              >
                <ImagePlus className="mr-1.5 h-4 w-4" />
                Add image
              </Button>
              {displayImageId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2 text-[var(--color-text-subtle)]"
                  onClick={() => setCoverRef(null)}
                >
                  Clear cover
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {refs.length === 0 ? (
        <p className="text-xs text-[var(--color-text-subtle)]">
          No reference images yet.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {refs.map((ref) => (
            <ReferenceTile
              key={ref.id}
              refImage={ref}
              isCover={ref.id === displayImageId}
              canEdit={canEdit}
              onSetCover={() => setCoverRef(ref.id)}
              onRemove={() => requestRemove(ref.id)}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            onUpload(file)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Remove reference image?"
        description="This removes the reference image from the look."
        confirmLabel="Remove"
        destructive
        onConfirm={handleRemove}
      />
    </div>
  )
}

function ReferenceTile({
  refImage,
  isCover,
  canEdit,
  onSetCover,
  onRemove,
}: {
  readonly refImage: ShotReferenceImage
  readonly isCover: boolean
  readonly canEdit: boolean
  readonly onSetCover: () => void
  readonly onRemove: () => void
}) {
  const resolved = useStorageUrl(refImage.downloadURL ?? refImage.path)
  const [errored, setErrored] = useState(false)

  useEffect(() => setErrored(false), [resolved])

  return (
    <div
      className={[
        "relative overflow-hidden rounded-md border bg-[var(--color-surface-subtle)]",
        isCover ? "border-[var(--color-border-strong)]" : "border-[var(--color-border)]",
      ].join(" ")}
    >
      {resolved && !errored ? (
        <img
          src={resolved}
          alt="Reference"
          className="h-20 w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex h-20 w-full items-center justify-center text-xs text-[var(--color-text-subtle)]">
          —
        </div>
      )}

      {isCover && (
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
          Cover
        </span>
      )}

      {canEdit && (
        <div className="absolute right-1 top-1 flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-7 w-7 opacity-90 hover:opacity-100"
            onClick={onSetCover}
            title="Set as cover"
          >
            <Star className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-7 w-7 opacity-90 hover:opacity-100"
            onClick={onRemove}
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}
