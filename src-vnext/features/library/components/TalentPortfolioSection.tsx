import { useRef, useState } from "react"
import type { ChangeEvent } from "react"
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import type { useSensors } from "@dnd-kit/core"
import { Upload } from "lucide-react"
import { Button } from "@/ui/button"
import { ImageLightbox } from "@/shared/components/ImageLightbox"
import { SortableImageTile } from "@/features/library/components/SortableImageTile"
import type { TalentImage } from "@/features/library/components/talentUtils"

interface TalentPortfolioSectionProps {
  readonly canEdit: boolean
  readonly busy: boolean
  readonly portfolioImages: TalentImage[]
  readonly sensors: ReturnType<typeof useSensors>
  readonly updateGallery: (
    next: TalentImage[],
    removedPaths?: readonly (string | null | undefined)[],
    successLabel?: string,
  ) => Promise<void>
  readonly onPortfolioFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
  readonly setGalleryRemoveOpen: (open: boolean) => void
  readonly setGalleryRemoveTarget: (target: TalentImage | null) => void
}

export function TalentPortfolioSection({
  canEdit,
  busy,
  portfolioImages,
  sensors,
  updateGallery,
  onPortfolioFiles,
  setGalleryRemoveOpen,
  setGalleryRemoveTarget,
}: TalentPortfolioSectionProps) {
  const portfolioInputRef = useRef<HTMLInputElement>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Build lightbox image URLs from downloadURL (direct) with path as fallback
  const lightboxUrls = portfolioImages
    .map((img) => img.downloadURL ?? img.path ?? "")
    .filter(Boolean)

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="heading-subsection">Portfolio</span>
          {portfolioImages.length > 0 ? (
            <span className="inline-flex items-center rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-2xs font-medium text-[var(--color-text-muted)]">
              {portfolioImages.length}
            </span>
          ) : null}
        </div>
        {canEdit ? (
          <>
            <input
              ref={portfolioInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={onPortfolioFiles}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => portfolioInputRef.current?.click()}
            >
              <Upload className="h-3 w-3 mr-1.5" />
              Upload
            </Button>
          </>
        ) : null}
      </div>

      {portfolioImages.length === 0 ? (
        <div className="mt-3 text-sm text-[var(--color-text-muted)]">
          {canEdit ? "Upload images to build a portfolio for this talent." : "No portfolio images."}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event: DragEndEvent) => {
            const { active, over } = event
            if (!over || active.id === over.id) return
            const oldIndex = portfolioImages.findIndex((i) => i.id === active.id)
            const newIndex = portfolioImages.findIndex((i) => i.id === over.id)
            if (oldIndex === -1 || newIndex === -1) return
            const reordered = arrayMove([...portfolioImages], oldIndex, newIndex)
            void updateGallery(reordered)
          }}
        >
          <SortableContext
            items={portfolioImages.map((i) => i.id)}
            strategy={rectSortingStrategy}
          >
            <div className="mt-4 grid grid-cols-2 gap-3">
              {portfolioImages.map((img, idx) => (
                <div
                  key={img.id}
                  onClick={() => {
                    setLightboxIndex(idx)
                    setLightboxOpen(true)
                  }}
                  className="cursor-pointer"
                >
                  <SortableImageTile
                    image={img}
                    disabled={!canEdit || busy}
                    onCaptionSave={(next) => {
                      const nextImages = portfolioImages.map((i) =>
                        i.id === img.id ? { ...i, description: next || null } : i,
                      )
                      void updateGallery(nextImages)
                    }}
                    onDelete={() => {
                      setGalleryRemoveTarget(img)
                      setGalleryRemoveOpen(true)
                    }}
                  />
                </div>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {lightboxUrls.length > 0 ? (
        <ImageLightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          images={lightboxUrls}
          initialIndex={lightboxIndex}
          alt="Portfolio image"
        />
      ) : null}
    </div>
  )
}
