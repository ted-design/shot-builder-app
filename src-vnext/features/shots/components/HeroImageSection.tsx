import { useRef, useState } from "react"
import { uploadHeroImage } from "@/shared/lib/uploadImage"
import { updateShotField } from "@/features/shots/lib/updateShot"
import { useAuth } from "@/app/providers/AuthProvider"
import { Button } from "@/ui/button"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { ImagePlus, Loader2, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"

interface HeroImageSectionProps {
  readonly heroImage: Shot["heroImage"]
  readonly shotId: string
  readonly canUpload: boolean
}

export function HeroImageSection({
  heroImage,
  shotId,
  canUpload,
}: HeroImageSectionProps) {
  const { clientId } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const heroCandidate = heroImage?.downloadURL ?? heroImage?.path
  const resolvedHeroUrl = useStorageUrl(heroCandidate)
  const canResetManual = !!heroImage?.path && heroImage.path.includes("/hero.webp")

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !clientId) return

    // Reset input so same file can be re-selected
    e.target.value = ""

    setUploading(true)
    try {
      const result = await uploadHeroImage(file, clientId, shotId)
      await updateShotField(shotId, clientId, { heroImage: result })
    } catch {
      toast.error("Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {resolvedHeroUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-[var(--color-border)]">
          <img
            src={resolvedHeroUrl}
            alt="Hero"
            className="w-full object-cover"
            style={{ maxHeight: 320 }}
          />
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
                      await updateShotField(shotId, clientId, { heroImage: null })
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
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
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
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      )}
    </div>
  )
}
