import { useState } from "react"
import { ImageOff, Package } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"

interface ProductImageProps {
  /** URL or Firebase Storage path */
  readonly src: string | undefined
  /** URL or Firebase Storage path */
  readonly fallbackSrc?: string | undefined
  readonly alt: string
  readonly className?: string
  readonly size?: "sm" | "md" | "lg"
  /** Says why there is no image (e.g. a colourway with no photo of its own): visible at md/lg, tooltip + accessible name at every size. */
  readonly emptyLabel?: string
}

const sizeClasses = {
  sm: "h-10 w-10",
  md: "h-20 w-20",
  lg: "h-40 w-40",
} as const

export function ProductImage({
  src,
  fallbackSrc,
  alt,
  className,
  size = "md",
  emptyLabel,
}: ProductImageProps) {
  const resolvedSrc = useStorageUrl(src)
  const resolvedFallback = useStorageUrl(fallbackSrc)
  const [imgError, setImgError] = useState(false)
  const [fallbackError, setFallbackError] = useState(false)

  const activeSrc = !resolvedSrc || imgError
    ? !resolvedFallback || fallbackError
      ? null
      : resolvedFallback
    : resolvedSrc

  // The label claims there is no image, so only show it when no source exists —
  // not while a path is still resolving or after a load error.
  if (!activeSrc && emptyLabel && !src && !fallbackSrc) {
    return <EmptyProductImage label={emptyLabel} alt={alt} size={size} className={className} />
  }

  if (!activeSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)]",
          sizeClasses[size],
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <Package className="h-1/3 w-1/3 text-[var(--color-text-subtle)]" />
      </div>
    )
  }

  return (
    <img
      src={activeSrc}
      alt={alt}
      className={cn(
        "rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] object-cover",
        sizeClasses[size],
        className,
      )}
      onError={() => {
        if (activeSrc === resolvedSrc) {
          setImgError(true)
        } else {
          setFallbackError(true)
        }
      }}
    />
  )
}

function EmptyProductImage({
  label,
  alt,
  size,
  className,
}: {
  readonly label: string
  readonly alt: string
  readonly size: keyof typeof sizeClasses
  readonly className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 text-center",
        sizeClasses[size],
        className,
      )}
      role="img"
      aria-label={`${alt}: ${label}`}
      title={label}
    >
      <ImageOff
        className={cn("shrink-0 text-[var(--color-text-subtle)]", size === "sm" ? "h-4 w-4" : "h-5 w-5")}
      />
      {size !== "sm" && (
        <span className="text-2xs leading-tight text-[var(--color-text-subtle)]">{label}</span>
      )}
    </div>
  )
}
