import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/ui/dialog"

interface ImageLightboxProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly images: readonly string[]
  readonly initialIndex?: number
  readonly alt?: string
}

export function ImageLightbox({
  open,
  onOpenChange,
  images,
  initialIndex = 0,
  alt = "Image",
}: ImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex)
  const touchStartX = useRef<number | null>(null)

  // Reset index when dialog opens or initialIndex changes
  useEffect(() => {
    if (open) setIndex(initialIndex)
  }, [open, initialIndex])

  const count = images.length
  const canPrev = index > 0
  const canNext = index < count - 1

  const goPrev = useCallback(() => {
    if (canPrev) setIndex((i) => i - 1)
  }, [canPrev])

  const goNext = useCallback(() => {
    if (canNext) setIndex((i) => i + 1)
  }, [canNext])

  // Keyboard navigation
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault()
        goPrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, goPrev, goNext])

  // Touch swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return
    const endX = e.changedTouches[0]?.clientX ?? 0
    const delta = endX - touchStartX.current
    touchStartX.current = null

    if (Math.abs(delta) > 50) {
      if (delta < 0) goNext()
      else goPrev()
    }
  }

  // Preload adjacent images
  useEffect(() => {
    if (!open || count <= 1) return
    const toPreload: string[] = []
    if (index > 0) toPreload.push(images[index - 1]!)
    if (index < count - 1) toPreload.push(images[index + 1]!)
    for (const src of toPreload) {
      const img = new Image()
      img.src = src
    }
  }, [open, index, images, count])

  if (count === 0) return null

  const currentSrc = images[index] ?? images[0]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-w-[95vw] items-center justify-center border-none bg-black/95 p-0 shadow-none sm:max-w-4xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <DialogTitle className="sr-only">
          {alt} — {index + 1} of {count}
        </DialogTitle>

        {/* Close button */}
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Previous button */}
        {canPrev && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Next button */}
        {canNext && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Image */}
        <img
          src={currentSrc}
          alt={`${alt} — ${index + 1} of ${count}`}
          className="max-h-[85vh] w-full rounded object-contain"
        />

        {/* Counter */}
        {count > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white/70">
            {index + 1} of {count}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
