import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2 } from "lucide-react"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import type { TalentImage } from "@/features/library/components/talentUtils"

function ImageThumb({ image, alt }: { readonly image: TalentImage; readonly alt: string }) {
  const url = useStorageUrl(image.downloadURL ?? image.path)
  return (
    <div className="aspect-square overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xs text-[var(--color-text-muted)]">
          —
        </div>
      )}
    </div>
  )
}

export function SortableImageTile({
  image,
  disabled,
  onDelete,
  onCaptionSave,
}: {
  readonly image: TalentImage
  readonly disabled: boolean
  readonly onDelete: () => void
  readonly onCaptionSave: (next: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div className="absolute left-2 top-2 z-10 flex items-center gap-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          disabled={disabled}
          className="rounded bg-black/40 p-1 text-[var(--color-text-inverted)] hover:bg-black/55 disabled:opacity-40"
          aria-label="Reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      <div className="absolute right-2 top-2 z-10">
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          className="rounded bg-black/40 p-1 text-[var(--color-text-inverted)] hover:bg-black/55 disabled:opacity-40"
          aria-label="Remove image"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ImageThumb image={image} alt="Talent image" />

      <div className="mt-2">
        <InlineEdit
          value={(image.description ?? "").trim()}
          disabled={disabled}
          placeholder="Add caption"
          onSave={onCaptionSave}
          className="text-xs text-[var(--color-text-muted)]"
        />
      </div>
    </div>
  )
}
