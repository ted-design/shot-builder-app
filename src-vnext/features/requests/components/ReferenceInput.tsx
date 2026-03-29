import { useRef, useState } from "react"
import { Plus, X, Upload, Loader2 } from "lucide-react"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"
import { toast } from "sonner"
import { storage } from "@/shared/lib/firebase"
import { Input } from "@/ui/input"
import type { ShotRequestReference } from "@/shared/types"

const MAX_REFERENCES = 10

interface ReferenceInputProps {
  readonly clientId: string
  readonly requestId: string
  readonly references: readonly ShotRequestReference[]
  readonly onChange: (refs: readonly ShotRequestReference[]) => void
}

interface UploadingState {
  readonly [index: number]: boolean
}

export function ReferenceInput({
  clientId,
  requestId,
  references,
  onChange,
}: ReferenceInputProps) {
  const [uploading, setUploading] = useState<UploadingState>({})
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([])

  const handleUrlChange = (index: number, url: string) => {
    onChange(
      references.map((ref, i) => (i === index ? { ...ref, url } : ref)),
    )
  }

  const handleCaptionChange = (index: number, caption: string) => {
    onChange(
      references.map((ref, i) => (i === index ? { ...ref, caption } : ref)),
    )
  }

  const handleAdd = () => {
    onChange([...references, { url: "", imageUrl: null, caption: null }])
  }

  const handleRemove = (index: number) => {
    onChange(references.filter((_, i) => i !== index))
  }

  const handleImageUpload = async (index: number, file: File) => {
    setUploading((prev) => ({ ...prev, [index]: true }))
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const storagePath = `clients/${clientId}/request-references/${requestId}/${Date.now()}-${safeName}`
      const storageRef = ref(storage, storagePath)
      await uploadBytes(storageRef, file)
      const downloadUrl = await getDownloadURL(storageRef)
      onChange(
        references.map((r, i) =>
          i === index ? { ...r, imageUrl: downloadUrl } : r,
        ),
      )
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`Image upload failed: ${message}`)
    } finally {
      setUploading((prev) => ({ ...prev, [index]: false }))
    }
  }

  const handleFileChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    handleImageUpload(index, file).catch((err) => {
      const message = err instanceof Error ? err.message : "Upload failed"
      toast.error(message)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {references.map((refItem, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] p-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Reference {index + 1}
            </span>
            <button
              type="button"
              onClick={() => handleRemove(index)}
              aria-label={`Remove reference ${index + 1}`}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-red-50 hover:text-[var(--color-error)]"
            >
              <X size={14} />
            </button>
          </div>

          <Input
            type="url"
            value={refItem.url}
            onChange={(e) => handleUrlChange(index, e.target.value)}
            placeholder="https://..."
            aria-label={`Reference ${index + 1} URL`}
          />

          <Input
            type="text"
            value={refItem.caption ?? ""}
            onChange={(e) => handleCaptionChange(index, e.target.value)}
            placeholder="Caption (optional)"
            aria-label={`Reference ${index + 1} caption`}
          />

          <div className="flex items-center gap-2">
            {refItem.imageUrl ? (
              <div className="flex items-center gap-2">
                <img
                  src={refItem.imageUrl}
                  alt="Reference preview"
                  className="h-10 w-10 rounded object-cover"
                />
                <button
                  type="button"
                  onClick={() =>
                    onChange(
                      references.map((r, i) =>
                        i === index ? { ...r, imageUrl: null } : r,
                      ),
                    )
                  }
                  className="text-xs text-[var(--color-text-muted)] underline hover:text-[var(--color-error)]"
                >
                  Remove image
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRefs.current[index]?.click()}
                disabled={uploading[index] ?? false}
                className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)] disabled:opacity-50"
              >
                {uploading[index] ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                {uploading[index] ? "Uploading..." : "Attach image"}
              </button>
            )}
            <input
              ref={(el) => {
                fileInputRefs.current[index] = el
              }}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label={`Upload image for reference ${index + 1}`}
              onChange={(e) => handleFileChange(index, e)}
            />
          </div>
        </div>
      ))}

      {references.length < MAX_REFERENCES && (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
        >
          <Plus size={14} />
          Add reference
        </button>
      )}
    </div>
  )
}
