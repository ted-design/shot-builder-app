import { useRef } from "react"
import { Camera, Trash2 } from "lucide-react"
import { ProductImage } from "@/features/products/components/ProductImage"
import { Button } from "@/ui/button"
import { cn } from "@/shared/lib/utils"

interface EditableProductImageProps {
  readonly src: string | undefined
  readonly fallbackSrc?: string | undefined
  readonly alt: string
  readonly size?: "sm" | "md" | "lg"
  readonly className?: string
  readonly canEdit: boolean
  readonly onReplace: (file: File) => void
  readonly onRemove?: () => void
  readonly label?: string
}

export function EditableProductImage({
  src,
  fallbackSrc,
  alt,
  size = "md",
  className,
  canEdit,
  onReplace,
  onRemove,
  label,
}: EditableProductImageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      onReplace(file)
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  if (!canEdit) {
    return (
      <div className={cn("flex flex-col items-center gap-1", className)}>
        <ProductImage src={src} fallbackSrc={fallbackSrc} alt={alt} size={size} />
        {label && (
          <span className="text-2xs text-[var(--color-text-muted)]">{label}</span>
        )}
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <div className="group relative">
        <ProductImage src={src} fallbackSrc={fallbackSrc} alt={alt} size={size} />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 rounded-[var(--radius-lg)] bg-black/50 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
            onClick={() => fileInputRef.current?.click()}
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="sr-only">Replace image</span>
          </Button>
          {onRemove && src && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-white hover:bg-white/20 hover:text-white"
              onClick={onRemove}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Remove image</span>
            </Button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      {label && (
        <span className="text-2xs text-[var(--color-text-muted)]">{label}</span>
      )}
    </div>
  )
}
