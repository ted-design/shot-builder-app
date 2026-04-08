interface PortfolioThumbnailStripProps {
  readonly urls: readonly string[]
  readonly talentName: string
  readonly onThumbnailClick: (index: number) => void
}

const MAX_VISIBLE = 4

/**
 * Horizontal thumbnail strip showing up to 4 images with an overflow count
 * on the last visible slot when there are more than MAX_VISIBLE images.
 */
export function PortfolioThumbnailStrip({
  urls,
  talentName,
  onThumbnailClick,
}: PortfolioThumbnailStripProps) {
  if (urls.length === 0) return null

  const visibleUrls = urls.slice(0, MAX_VISIBLE)
  const overflowCount = urls.length - MAX_VISIBLE

  return (
    <div className="flex gap-1.5">
      {visibleUrls.map((url, i) => {
        const isLastVisible = i === MAX_VISIBLE - 1 && overflowCount > 0
        return (
          <button
            key={url}
            type="button"
            onClick={() => onThumbnailClick(i)}
            className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded"
            aria-label={
              isLastVisible
                ? `View all ${urls.length} images for ${talentName}`
                : `View image ${i + 1} for ${talentName}`
            }
          >
            <img
              src={url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {isLastVisible && (
              <div className="absolute inset-0 flex items-center justify-center rounded bg-black/60">
                <span className="text-2xs font-semibold text-white">
                  +{overflowCount}
                </span>
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
