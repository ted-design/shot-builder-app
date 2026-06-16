import { useRef, useState } from "react"
import { uploadHeroImage } from "@/shared/lib/uploadImage"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { useAuth } from "@/app/providers/AuthProvider"
import { Button } from "@/ui/button"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { useProductFamilyDoc, useProductSkuDoc } from "@/features/shots/hooks/usePickerData"
import { findExplicitCoverAssignment } from "@/features/shots/lib/coverProductImage"
import { ImagePlus, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"
import { validateImageFileForUpload } from "@/shared/lib/uploadImage"

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

interface HeroImageSectionProps {
  readonly heroImage: Shot["heroImage"]
  readonly shot: Shot
  readonly shotId: string
  readonly canUpload: boolean
  /** "natural" renders the hero at the image's native aspect ratio (height-capped); default "fixed" keeps the legacy container. */
  readonly frame?: "fixed" | "natural"
}

export function HeroImageSection({
  heroImage,
  shot,
  shotId,
  canUpload,
  frame = "fixed",
}: HeroImageSectionProps) {
  const { clientId, user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Catalog-image fallback for an explicit cover product whose URL was never denormalized.
  const coverAssignment = heroImage ? null : findExplicitCoverAssignment(shot)
  const coverDenormalized = coverAssignment
    ? (coverAssignment.thumbUrl ?? coverAssignment.skuImageUrl ?? coverAssignment.familyImageUrl)
    : undefined
  // Only read catalog docs when the assignment carries no denormalized URL.
  const coverFamilyId = coverAssignment && !coverDenormalized ? coverAssignment.familyId : null
  const coverSkuId =
    coverAssignment && !coverDenormalized ? (coverAssignment.skuId ?? coverAssignment.colourId ?? null) : null
  const { data: coverFamily } = useProductFamilyDoc(coverFamilyId)
  const { data: coverSku } = useProductSkuDoc(coverFamilyId, coverSkuId)
  // Ignore doc data still carried over from a prior id.
  const coverSkuImage = coverSku?.id === coverSkuId ? coverSku?.imagePath : undefined
  const coverFamilyImage =
    coverFamily?.id === coverFamilyId ? (coverFamily?.thumbnailImagePath ?? coverFamily?.headerImagePath) : undefined
  const coverFallbackSrc = coverDenormalized ?? coverSkuImage ?? coverFamilyImage

  const heroCandidate = heroImage?.downloadURL ?? heroImage?.path ?? coverFallbackSrc
  const resolvedHeroUrl = useStorageUrl(heroCandidate)
  const canResetManual = !!heroImage?.path && heroImage.path.includes("/hero.webp")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !clientId) return

    // Reset input so same file can be re-selected
    e.target.value = ""

    try {
      validateImageFileForUpload(file)
    } catch (err) {
      toast.error("Upload failed", { description: formatUploadError(err) })
      return
    }

    setUploading(true)
    try {
      const result = await uploadHeroImage(file, clientId, shotId)
      await updateShotWithVersion({
        clientId,
        shotId,
        patch: { heroImage: result },
        shot,
        user,
        source: "HeroImageSection.upload",
      })
    } catch (err) {
      toast.error("Upload failed", { description: formatUploadError(err) })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {resolvedHeroUrl ? (
        <div
          className={
            frame === "natural"
              ? "relative w-fit max-w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
              : "relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
          }
        >
          <div className={frame === "natural" ? "max-h-[460px]" : "h-[clamp(210px,30vh,320px)] w-full"}>
            <img
              src={resolvedHeroUrl}
              alt="Hero"
              className={
                frame === "natural"
                  ? "block h-auto max-h-[460px] w-auto max-w-full object-contain"
                  : "h-full w-full object-contain"
              }
            />
          </div>
          {canUpload && !uploading && (
            <div className="absolute bottom-2 right-2 flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="opacity-80 hover:opacity-100"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
                Replace
              </Button>
              {canResetManual && (
                <Button
                  variant="secondary"
                  size="sm"
                  className="opacity-80 hover:opacity-100"
                  onClick={async () => {
                    if (!clientId) return
                    try {
                      await updateShotWithVersion({
                        clientId,
                        shotId,
                        patch: { heroImage: null },
                        shot,
                        user,
                        source: "HeroImageSection.reset",
                      })
                    } catch {
                      toast.error("Failed to reset cover")
                    }
                  }}
                  title="Reset cover to auto"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Reset
                </Button>
              )}
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-text)]/30">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-inverted)]" />
            </div>
          )}
        </div>
      ) : canUpload ? (
        <button
          type="button"
          className="flex h-32 w-full items-center justify-center rounded-lg border-2 border-dashed border-[var(--color-border)] text-[var(--color-text-subtle)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text)]"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <span className="flex items-center gap-2 text-sm">
              <ImagePlus className="h-5 w-5" />
              Add hero image
            </span>
          )}
        </button>
      ) : null}

      {canUpload && (
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          data-testid="hero-image-file-input"
          onChange={handleFileChange}
        />
      )}
    </div>
  )
}
