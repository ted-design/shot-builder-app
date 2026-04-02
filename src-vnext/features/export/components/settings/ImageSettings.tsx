import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Upload,
  X,
} from "lucide-react"
import { Button } from "@/ui/button"
import type { ImageBlock } from "../../types/exportBuilder"
import { uploadExportImage } from "../../lib/uploadExportImage"

export function ImageSettings({
  block,
  onUpdate,
  clientId,
  projectId,
}: {
  readonly block: ImageBlock
  readonly onUpdate: (updates: Partial<ImageBlock>) => void
  readonly clientId: string | null | undefined
  readonly projectId: string | undefined
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const alignment = block.alignment ?? "center"
  const width = block.width ?? 100

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      if (!clientId || !projectId) {
        toast.error("Missing project context for upload.")
        return
      }

      setUploading(true)
      try {
        const url = await uploadExportImage(file, clientId, projectId)
        onUpdate({ src: url })
        toast.success("Image uploaded")
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed"
        toast.error(message)
      } finally {
        setUploading(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    },
    [clientId, projectId, onUpdate],
  )

  const handleWidthChange = useCallback(
    (value: string) => {
      const parsed = parseInt(value, 10)
      if (Number.isNaN(parsed) || parsed < 10 || parsed > 100) return
      onUpdate({ width: parsed })
    },
    [onUpdate],
  )

  const handleAlignChange = useCallback(
    (align: "left" | "center" | "right") => {
      onUpdate({ alignment: align })
    },
    [onUpdate],
  )

  const alignButtons: readonly {
    readonly value: "left" | "center" | "right"
    readonly Icon: typeof AlignLeft
  }[] = [
    { value: "left", Icon: AlignLeft },
    { value: "center", Icon: AlignCenter },
    { value: "right", Icon: AlignRight },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Image
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
          data-testid="image-file-input"
        />
        <div className="mt-1 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex-1"
            data-testid="image-upload-btn"
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-4 w-4" />
            )}
            {block.src ? "Replace" : "Choose Image"}
          </Button>
          {block.src && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onUpdate({ src: undefined })}
              data-testid="image-remove-btn"
              className="text-[var(--color-error)] hover:bg-[var(--color-error-subtle)] hover:text-[var(--color-error)]"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {block.src && (
          <img
            src={block.src}
            alt={block.alt ?? ""}
            className="mt-2 max-h-24 rounded border border-[var(--color-border)] object-contain"
          />
        )}
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Width (%)
        </label>
        <input
          type="number"
          min={10}
          max={100}
          value={width}
          onChange={(e) => handleWidthChange(e.target.value)}
          data-testid="image-width-input"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
        />
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Alignment
        </label>
        <div className="mt-1 flex gap-1">
          {alignButtons.map(({ value, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleAlignChange(value)}
              data-testid={`image-align-${value}`}
              className={`rounded-md p-1.5 transition-colors ${
                alignment === value
                  ? "bg-[var(--color-surface-muted)] text-[var(--color-text)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Alt Text
        </label>
        <input
          type="text"
          value={block.alt ?? ""}
          onChange={(e) => onUpdate({ alt: e.target.value })}
          placeholder="Describe this image..."
          data-testid="image-alt-input"
          className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-sm text-[var(--color-text)]"
        />
      </div>
    </div>
  )
}
