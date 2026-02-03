import { useState } from "react"
import { Package } from "lucide-react"
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
