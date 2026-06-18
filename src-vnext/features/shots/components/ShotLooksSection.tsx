import { useEffect, useMemo, useRef, useState } from "react"
import { sanitizeForFirestore } from "@/shared/lib/firestoreSanitize"
import { ProductAssignmentPicker } from "@/features/shots/components/ProductAssignmentPicker"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { uploadShotReferenceImage, validateImageFileForUpload } from "@/shared/lib/uploadImage"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { canManageProducts } from "@/shared/lib/rbac"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { firstHeroProductId, lookHeroIndexes, reconcileHeroProductId } from "@/features/shots/lib/lookHeroes"
import { Image, ImagePlus, Plus, Star, Trash2, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import type { ProductAssignment, Shot, ShotLook, ShotReferenceImage } from "@/shared/types"

function formatUploadError(err: unknown): string {
  if (err instanceof Error) {
    const anyErr = err as Error & { readonly code?: unknown }
    if (typeof anyErr.code === "string" && anyErr.code.length > 0) {
      return `${anyErr.code}: ${err.message}`
    }
    return err.message
  }
  if (typeof err === "string") return err
  return "Unknown error"
}

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

function normalizeLooksForWrite(looks: ReadonlyArray<ShotLook>): ShotLook[] {
  const sorted = [...looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  return sorted.map((look, index) => ({
    ...look,
    order: index,
    label: getLookLabel(index),
    products: look.products ?? [],
    heroProductId: look.heroProductId,
    references: look.references ?? [],
    displayImageId: look.displayImageId ?? null,
  }))
}

export function ShotLooksSection({
  shot,
  canEdit,
  showReferencesSection = true,
}: {
  readonly shot: Shot
  readonly canEdit: boolean
  readonly showReferencesSection?: boolean
}) {
  const { clientId, user, role } = useAuth()
  // PINNED to the GLOBAL claim (the canManageProducts(role) half): catalog
  // writes hit the org-scoped products backend — productFamilies
  // (firestore.rules:566-574) and skus (:571-574) require a global
  // isAdmin()||isProducer(), so a project promotion cannot grant catalog
  // writes and the UI must not advertise them from the effective role. The
  // canEdit prop half IS effective-role-driven by the parent
  // (ShotDetailPageUnified → ShotDetailSidebar).
  const canManageCatalog = canEdit && canManageProducts(role)
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

  const heroIndexes = useMemo<ReadonlySet<number>>(
    () => new Set(selectedLook ? lookHeroIndexes(selectedLook) : []),
    [selectedLook],
  )

  const saveLooks = async (
    nextLooks: ReadonlyArray<ShotLook>,
    nextActiveLookId?: string | null,
  ): Promise<boolean> => {
    if (!clientId) return false
    setSaving(true)
    try {
      const normalized = normalizeLooksForWrite(nextLooks)
      const sanitized = sanitizeForFirestore(normalized)
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: { looks: sanitized, activeLookId: nextActiveLookId },
        shot,
        user,
        source: "ShotLooksSection.saveLooks",
      })
      return true
    } catch {
      toast.error("Failed to save look options")
      return false
    } finally {
      setSaving(false)
    }
  }

  // Toggle a product's hero star, persist explicit isHero flags, and keep the
  // legacy cover pointer (heroProductId) following the first star.
  const handleToggleHero = async (index: number) => {
    if (!selectedLook) return
    const nextHeroes = new Set(lookHeroIndexes(selectedLook))
    if (nextHeroes.has(index)) nextHeroes.delete(index)
    else nextHeroes.add(index)
    const nextProducts: ProductAssignment[] = selectedLook.products.map((p, i) => ({
      ...p,
      isHero: nextHeroes.has(i) ? true : undefined,
    }))
    const nextLooks = looks.map((l) =>
      l.id === selectedLook.id
        ? { ...l, products: nextProducts, heroProductId: firstHeroProductId(nextProducts) }
        : l,
    )
    await saveLooks(nextLooks)
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
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: { activeLookId: lookId },
        shot,
        user,
        source: "ShotLooksSection.setActiveLookForCover",
      })
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
                <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                  Active
                </Badge>
              )}
              <span className="text-2xs opacity-80">
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
              <p className="mt-0.5 text-xxs text-[var(--color-text-subtle)]">
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
            disabled={!canEdit || saving}
            canManageCatalog={canManageCatalog}
            heroIndexes={heroIndexes}
            onToggleHero={handleToggleHero}
            onSave={async (products) => {
              const next = looks.map((l) =>
                l.id === selectedLook.id
                  ? { ...l, products, heroProductId: reconcileHeroProductId(products, l.heroProductId) }
                  : l,
              )
              return saveLooks(next)
            }}
          />

          {selectedLook.products.length > 0 && (
            <p className="flex items-center gap-1.5 text-xxs text-[var(--color-text-subtle)]">
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              Star hero product(s) — used for the Capture One filename. The cover image follows the first starred product.
            </p>
          )}

          {/* References live in the hero/header rail for this layout mode. */}
          {showReferencesSection && (
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
          )}
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

    try {
      validateImageFileForUpload(file)
    } catch (err) {
      toast.error("Upload failed", { description: formatUploadError(err) })
      return
    }

    setUploading(true)
    try {
      const id = generateReferenceId()
      let result: { path: string; downloadURL: string }
      try {
        result = await uploadShotReferenceImage(file, clientId, shot.id, id)
      } catch (err) {
        toast.error("Upload failed", { description: formatUploadError(err) })
        return
      }

      const newRef: ShotReferenceImage = {
        id,
        path: result.path,
        downloadURL: result.downloadURL,
        uploadedAt: Date.now(),
        uploadedBy: userId ?? undefined,
      }
      const nextLooks = looks.map((l) => {
        if (l.id !== look.id) return l
        const nextRefs = [...(l.references ?? []), newRef]
        const nextDisplay = l.displayImageId ?? null
        return {
          ...l,
          references: nextRefs,
          // Default uploaded reference to cover when this is the active look and cover isn't set yet.
          displayImageId: isActiveForCover && nextDisplay === null ? id : nextDisplay,
        }
      })
      try {
        await onSaveLooks(nextLooks)
      } catch (err) {
        toast.error("Uploaded but failed to save", { description: formatUploadError(err) })
      }
    } catch (err) {
      toast.error("Failed to add reference", { description: formatUploadError(err) })
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
            <Badge variant="secondary" className="text-2xs">
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
        <InlineEmpty
          icon={<Image className="h-8 w-8" />}
          title="No reference images yet"
        />
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
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            void onUpload(file)
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
        <div className="h-20 w-full bg-[var(--color-surface-subtle)]">
          <img
            src={resolved}
            alt="Reference"
            className="h-full w-full object-contain"
            onError={() => setErrored(true)}
          />
        </div>
      ) : (
        <div className="flex h-20 w-full items-center justify-center text-xs text-[var(--color-text-subtle)]">
          —
        </div>
      )}

      {isCover && (
        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-2xs text-[var(--color-text-inverted)]">
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
