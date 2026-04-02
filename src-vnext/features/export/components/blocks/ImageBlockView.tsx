import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { ImagePlus, Loader2 } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useParams } from "react-router-dom"
import type { ImageBlock } from "../../types/exportBuilder"
import { uploadExportImage } from "../../lib/uploadExportImage"

interface ImageBlockViewProps {
  readonly block: ImageBlock
  readonly onImageUploaded?: (src: string) => void
  readonly onWidthChange?: (width: number) => void
}

const ALIGNMENT_CLASSES: Record<string, string> = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
}

const MIN_WIDTH_PERCENT = 10
const MAX_WIDTH_PERCENT = 100

export function ImageBlockView({ block, onImageUploaded, onWidthChange }: ImageBlockViewProps) {
  const { clientId } = useAuth()
  const { id: projectId } = useParams<{ id: string }>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Resize state
  const [isResizing, setIsResizing] = useState(false)
  const [liveWidth, setLiveWidth] = useState(block.width ?? 100)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)
  const parentWidthRef = useRef(0)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => { cleanupRef.current?.() }
  }, [])

  const alignment = block.alignment ?? "center"
  const width = block.width ?? 100

  const handleResizeStart = useCallback(
    (e: React.PointerEvent) => {
      if (!onWidthChange) return
      e.preventDefault()
      e.stopPropagation()

      const parent = containerRef.current?.parentElement
      parentWidthRef.current = parent?.offsetWidth ?? 1
      startXRef.current = e.clientX
      startWidthRef.current = block.width ?? 100
      setIsResizing(true)

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const deltaX = moveEvent.clientX - startXRef.current
        const deltaPercent = (deltaX / parentWidthRef.current) * 100
        const newWidth = Math.round(
          Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, startWidthRef.current + deltaPercent)),
        )
        setLiveWidth(newWidth)
      }

      const handlePointerUp = (upEvent: PointerEvent) => {
        const deltaX = upEvent.clientX - startXRef.current
        const deltaPercent = (deltaX / parentWidthRef.current) * 100
        const finalWidth = Math.round(
          Math.min(MAX_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, startWidthRef.current + deltaPercent)),
        )
        setIsResizing(false)
        setLiveWidth(finalWidth)
        onWidthChange(finalWidth)
        cleanup()
      }

      const cleanup = () => {
        document.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("pointerup", handlePointerUp)
        cleanupRef.current = null
      }
      cleanupRef.current = cleanup

      document.addEventListener("pointermove", handlePointerMove)
      document.addEventListener("pointerup", handlePointerUp)
    },
    [block.width, onWidthChange],
  )

  const handleUpload = useCallback(
    async (file: File) => {
      if (!clientId || !projectId || !onImageUploaded) return

      setUploading(true)
      try {
        const url = await uploadExportImage(file, clientId, projectId)
        onImageUploaded(url)
        toast.success("Image uploaded")
      } catch (err) {
        const message = err instanceof Error ? err.message : "Upload failed"
        toast.error(message)
      } finally {
        setUploading(false)
      }
    },
    [clientId, projectId, onImageUploaded],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        void handleUpload(file)
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [handleUpload],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setDragOver(false)

      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith("image/")) {
        void handleUpload(file)
      }
    },
    [handleUpload],
  )

  if (!block.src) {
    return (
      <div
        data-testid="image-block"
        className={`flex ${ALIGNMENT_CLASSES[alignment] ?? "justify-center"}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFileSelect}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => onImageUploaded && fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          disabled={uploading || !onImageUploaded}
          className={`flex flex-col items-center justify-center gap-2 rounded border-2 border-dashed transition-colors ${
            dragOver
              ? "border-[var(--color-accent)] bg-[var(--color-accent-subtle)]"
              : "border-[var(--color-border)] bg-[var(--color-surface-subtle)]"
          } ${onImageUploaded ? "cursor-pointer hover:border-[var(--color-text-muted)]" : "cursor-default"}`}
          style={{ width: `${String(width)}%`, height: "120px" }}
        >
          {uploading ? (
            <Loader2 className="h-6 w-6 animate-spin text-[var(--color-text-muted)]" />
          ) : (
            <ImagePlus className="h-6 w-6 text-[var(--color-text-subtle)]" />
          )}
          <span className="text-2xs text-[var(--color-text-subtle)]">
            {uploading ? "Uploading..." : "Drop image or click to upload"}
          </span>
        </button>
      </div>
    )
  }

  const displayWidth = isResizing ? liveWidth : width

  return (
    <div
      ref={containerRef}
      data-testid="image-block"
      className={`flex ${ALIGNMENT_CLASSES[alignment] ?? "justify-center"}`}
    >
      <div className="group relative" style={{ width: `${String(displayWidth)}%` }}>
        <img
          src={block.src}
          alt={block.alt ?? ""}
          className="w-full rounded"
        />
        {onWidthChange && (
          <div
            onPointerDown={handleResizeStart}
            className="absolute right-0 top-0 bottom-0 w-2 cursor-e-resize opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-[var(--color-accent)]" />
          </div>
        )}
        {isResizing && (
          <div className="absolute -right-8 top-1/2 -translate-y-1/2 rounded bg-[var(--color-surface)] px-1.5 py-0.5 text-2xs text-[var(--color-text)] shadow">
            {liveWidth}%
          </div>
        )}
      </div>
    </div>
  )
}
