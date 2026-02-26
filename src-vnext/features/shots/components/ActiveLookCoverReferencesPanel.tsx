import { useEffect, useMemo, useRef, useState } from "react"
import { uploadShotReferenceImage, validateImageFileForUpload } from "@/shared/lib/uploadImage"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { useAuth } from "@/app/providers/AuthProvider"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { ImagePlus, Loader2, Star, X, EyeOff } from "lucide-react"
import { toast } from "sonner"
import type { Shot, ShotLook, ShotReferenceImage } from "@/shared/types"

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

function getActiveLookIdForCover(
  looks: ReadonlyArray<ShotLook>,
  activeLookId: string | null | undefined,
): string | null {
  if (activeLookId && looks.some((l) => l.id === activeLookId)) return activeLookId
  return looks.length > 0 ? looks[0]!.id : null
}

function generateReferenceId(): string {
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function ActiveLookCoverReferencesPanel({
  shot,
  canEdit,
}: {
  readonly shot: Shot
  readonly canEdit: boolean
}) {
  const { clientId, user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  const looks = useMemo(
    () => (shot.looks ? [...shot.looks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)) : []),
    [shot.looks],
  )

  const activeLookIdForCover = useMemo(
    () => getActiveLookIdForCover(looks, shot.activeLookId ?? null),
    [looks, shot.activeLookId],
  )

  const activeLook = looks.find((l) => l.id === activeLookIdForCover) ?? null
  const refs = activeLook?.references ?? []
  const displayImageId = activeLook?.displayImageId ?? null

  const manualOverrideEnabled = !!shot.heroImage?.path && shot.heroImage.path.includes("/hero.webp")

  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null)

  const requestRemove = (refId: string) => {
    setPendingRemoveId(refId)
    setConfirmRemoveOpen(true)
  }

  const saveLooks = async (nextLooks: ReadonlyArray<ShotLook>): Promise<void> => {
    if (!clientId) throw new Error("Missing clientId.")
    setSaving(true)
    try {
      const sanitized = sanitizeForFirestore(nextLooks)
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: { looks: sanitized },
        shot,
        user,
        source: "ActiveLookCoverReferencesPanel.saveLooks",
      })
    } finally {
      setSaving(false)
    }
  }

  const setCoverRef = async (refId: string | null) => {
    if (!activeLook) return
    const nextLooks = looks.map((l) =>
      l.id === activeLook.id ? { ...l, displayImageId: refId } : l,
    )
    try {
      await saveLooks(nextLooks)
    } catch {
      toast.error("Failed to set cover image")
    }
  }

  const handleRemove = async () => {
    if (!activeLook || !pendingRemoveId) return
    const nextLooks = looks.map((l) => {
      if (l.id !== activeLook.id) return l
      const nextRefs = (l.references ?? []).filter((r) => r.id !== pendingRemoveId)
      const nextDisplay = l.displayImageId === pendingRemoveId ? null : (l.displayImageId ?? null)
      return { ...l, references: nextRefs, displayImageId: nextDisplay }
    })
    try {
      await saveLooks(nextLooks)
      setPendingRemoveId(null)
    } catch {
      toast.error("Failed to remove image")
    }
  }

  const onUpload = async (file: File) => {
    if (!clientId || !activeLook) return
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
        uploadedBy: user?.uid ?? undefined,
      }
      const nextLooks = looks.map((l) => {
        if (l.id !== activeLook.id) return l
        const nextRefs = [...(l.references ?? []), newRef]
        const nextDisplay = l.displayImageId ?? null
        return {
          ...l,
          references: nextRefs,
          // Default first uploaded reference to cover (only when unset).
          displayImageId: nextDisplay === null ? id : nextDisplay,
        }
      })
      try {
        await saveLooks(nextLooks)
      } catch (err) {
        toast.error("Uploaded but failed to save", { description: formatUploadError(err) })
      }
    } catch (err) {
      toast.error("Failed to add reference", { description: formatUploadError(err) })
    } finally {
      setUploading(false)
    }
  }

  const hideHeader = async () => {
    if (!clientId) {
      toast.error("Failed to hide header", { description: "Missing clientId." })
      return
    }
    if (!activeLook) return

    const nextLooks = looks.map((l) =>
      l.id === activeLook.id ? { ...l, displayImageId: null, heroProductId: null } : l,
    )

    setSaving(true)
    try {
      const sanitized = sanitizeForFirestore(nextLooks)
      await updateShotWithVersion({
        clientId,
        shotId: shot.id,
        patch: { heroImage: null, looks: sanitized, activeLookId: activeLook.id },
        shot,
        user,
        source: "ActiveLookCoverReferencesPanel.hideHeader",
      })
      toast.success("Header hidden")
    } catch (err) {
      toast.error("Failed to hide header", { description: formatUploadError(err) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="h-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-[var(--color-text-subtle)]">
            Cover images / references
          </p>
          {displayImageId && (
            <Badge variant="secondary" className="text-2xs">
              Reference cover set
            </Badge>
          )}
          {saving && (
            <span className="flex items-center gap-1 text-xs text-[var(--color-text-subtle)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}
        </div>

        {canEdit && activeLook && (
          <div className="flex flex-wrap items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 rounded-md px-2 text-xxs font-medium"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || saving || refs.length >= 10}
            >
              <ImagePlus className="mr-1.5 h-4 w-4" />
              Add image
            </Button>
            {displayImageId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-md px-2 text-xxs font-medium text-[var(--color-text-subtle)]"
                onClick={() => setCoverRef(null)}
                disabled={uploading || saving}
              >
                Clear cover
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 rounded-md px-2 text-xxs font-medium text-[var(--color-text-subtle)]"
              onClick={() => void hideHeader()}
              disabled={uploading || saving}
              title="Hides the header image without deleting references or products"
            >
              <EyeOff className="mr-1.5 h-4 w-4" />
              Hide header
            </Button>
          </div>
        )}
      </div>

      {!activeLook ? (
        <p className="mt-1.5 text-xs text-[var(--color-text-subtle)]">
          Create a Primary look to add reference images and set a cover.
        </p>
      ) : manualOverrideEnabled ? (
        <p className="mt-1.5 text-xs text-[var(--color-text-subtle)]">
          A manual cover image is enabled. Reset the cover to use reference/product cover selection.
        </p>
      ) : refs.length === 0 ? (
        <p className="mt-1.5 text-xs text-[var(--color-text-subtle)]">
          No reference images in the active look.
        </p>
      ) : (
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {refs.map((ref) => (
            <ReferenceTile
              key={ref.id}
              refImage={ref}
              isCover={ref.id === displayImageId}
              canEdit={canEdit}
              onSetCover={() => setCoverRef(ref.id)}
              onRemove={() => requestRemove(ref.id)}
              disabled={uploading || saving}
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
            onUpload(file)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title="Remove reference image?"
        description="This removes the reference image from the active look."
        confirmLabel="Remove"
        destructive
        confirmDisabled={saving || uploading}
        cancelDisabled={saving || uploading}
        closeOnConfirm={false}
        onConfirm={() => {
          void handleRemove().finally(() => setConfirmRemoveOpen(false))
        }}
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
  disabled,
}: {
  readonly refImage: ShotReferenceImage
  readonly isCover: boolean
  readonly canEdit: boolean
  readonly onSetCover: () => void
  readonly onRemove: () => void
  readonly disabled: boolean
}) {
  const resolved = useStorageUrl(refImage.downloadURL ?? refImage.path)
  const [errored, setErrored] = useState(false)

  useEffect(() => setErrored(false), [resolved])

  return (
    <div
      className={[
        "group relative overflow-hidden rounded-md border bg-[var(--color-surface-subtle)]",
        isCover ? "border-[var(--color-border-strong)]" : "border-[var(--color-border)]",
      ].join(" ")}
    >
      {resolved && !errored ? (
        <div className="aspect-square w-full bg-[var(--color-surface-subtle)]">
          <img
            src={resolved}
            alt="Reference"
            className="h-full w-full object-contain"
            onError={() => setErrored(true)}
          />
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center text-xs text-[var(--color-text-subtle)]">
          —
        </div>
      )}

      {/* Hover-reveal action bar */}
      {canEdit && (
        <div className="absolute bottom-0 left-0 right-0 flex border-t border-[var(--color-border)] bg-[var(--color-surface)]/90 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
          <button
            type="button"
            className="flex flex-1 items-center justify-center py-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)] disabled:opacity-50"
            onClick={onSetCover}
            title="Set as cover"
            disabled={disabled}
          >
            <Star className="h-3.5 w-3.5" />
          </button>
          <div className="w-px bg-[var(--color-border)]" />
          <button
            type="button"
            className="flex flex-1 items-center justify-center py-1 text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-error)] disabled:opacity-50"
            onClick={onRemove}
            title="Remove"
            disabled={disabled}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Cover indicator — text strip below image, not overlay */}
      {isCover && (
        <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] py-0.5 text-center text-2xs font-medium text-[var(--color-text-muted)]">
          Cover
        </div>
      )}
    </div>
  )
}
