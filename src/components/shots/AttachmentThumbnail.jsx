import { Star, Pencil, Trash2, GripVertical } from "lucide-react";
import { Button } from "../ui/button";
import AppImage from "../common/AppImage";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/**
 * AttachmentThumbnail - Individual attachment thumbnail with controls
 *
 * @param {Object} props
 * @param {Object} props.attachment - Attachment object with id, path, isPrimary, cropData, order
 * @param {Function} props.onDelete - Delete handler
 * @param {Function} props.onSetPrimary - Set as primary handler
 * @param {Function} props.onEdit - Edit/crop handler
 * @param {boolean} props.disabled - Disable all controls
 * @param {number} props.index - Display index (1-based)
 */
export default function AttachmentThumbnail({
  attachment,
  onDelete,
  onSetPrimary,
  onEdit,
  disabled = false,
  index = 1,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: attachment.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Calculate CSS transforms for crop preview (if cropData exists)
  const getImageStyle = () => {
    if (!attachment.cropData) return {};

    const { x, y, zoom = 1, rotation = 0 } = attachment.cropData;

    return {
      transform: `translate(-${x}%, -${y}%) scale(${zoom}) rotate(${rotation}deg)`,
      transformOrigin: "center",
    };
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-10 cursor-grab rounded bg-slate-800/70 p-1 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="h-3 w-3 text-white" />
      </div>

      {/* Primary Badge */}
      {attachment.isPrimary && (
        <div className="absolute right-1 top-1 z-10 flex items-center gap-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm">
          <Star className="h-3 w-3 fill-current" />
          Primary
        </div>
      )}

      {/* Order Badge */}
      <div className="absolute bottom-1 left-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-slate-800/70 text-[10px] font-bold text-white">
        {index}
      </div>

      {/* Thumbnail Image */}
      <div className="relative aspect-square w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
        <AppImage
          src={attachment.downloadURL || attachment.path}
          alt={`Attachment ${index}`}
          preferredSize={240}
          className="h-full w-full"
          imageClassName="h-full w-full object-cover"
          style={getImageStyle()}
          placeholder={
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              Loading…
            </div>
          }
          fallback={
            <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
              No image
            </div>
          }
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 px-2 py-0 text-xs"
          onClick={onEdit}
          disabled={disabled}
          title="Edit crop"
        >
          <Pencil className="h-3 w-3" />
        </Button>

        {!attachment.isPrimary && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 flex-1 px-2 py-0 text-xs"
            onClick={onSetPrimary}
            disabled={disabled}
            title="Set as primary"
          >
            <Star className="h-3 w-3" />
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 flex-1 px-2 py-0 text-xs text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20"
          onClick={onDelete}
          disabled={disabled}
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
