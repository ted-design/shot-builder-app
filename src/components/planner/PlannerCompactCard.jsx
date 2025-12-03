import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil } from "lucide-react";
import Thumb from "../Thumb";
import { shotStatusOptions } from "../../lib/shotStatus";

const STATUS_COLORS = {
  todo: "bg-slate-400",
  in_progress: "bg-amber-500",
  complete: "bg-emerald-500",
  on_hold: "bg-red-500",
};

/**
 * Compact shot card for the simplified Planner view.
 * Fixed layout with all fields visible (not configurable).
 * Designed for drag-and-drop within lanes.
 */
function PlannerCompactCard({
  shot,
  imagePath: overrideImagePath = null,
  shotNumber = "",
  talentNames = [],
  productNames = [],
  scheduledTime = "",
  canEdit = true,
  onEdit,
  onChangeStatus,
  isDragging: externalDragging,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableDragging,
  } = useSortable({
    id: shot.id,
    data: {
      type: "shot",
      shot,
    },
  });

  const isDragging = externalDragging ?? sortableDragging;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const status = shot.status || "todo";
  const statusColor = STATUS_COLORS[status] || STATUS_COLORS.todo;
  const statusLabel = shotStatusOptions.find((opt) => opt.value === status)?.label || "To do";

  // Image path - prefer provided value, then attachments, then common legacy fields
  const imagePath =
    overrideImagePath ||
    shot.attachments?.[0]?.path ||
    shot.referenceImagePath ||
    shot.previewImageUrl ||
    shot.thumbnailUrl ||
    shot.imageUrl ||
    null;

  const talentDisplay = talentNames.length > 0 ? talentNames.join(", ") : "No talent";
  const productDisplay = productNames.length > 0 ? productNames.join(", ") : "No products";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group overflow-hidden rounded-lg border bg-white transition-all dark:bg-slate-800
        ${isDragging
          ? "border-primary shadow-lg ring-2 ring-primary/30 opacity-90 scale-[1.02]"
          : "border-slate-200 hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:hover:border-slate-600"
        }
      `}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center justify-center border-b border-slate-100 bg-slate-50 py-1.5 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-700/50"
      >
        <GripVertical className="h-4 w-4 text-slate-400 dark:text-slate-500" />
      </div>

      {/* Thumbnail - Aspect-aware with invisible letterboxing */}
      <div className="flex h-[120px] items-center justify-center bg-slate-50 dark:bg-slate-700/30">
        {imagePath ? (
          <Thumb
            path={imagePath}
            preferredSize={256}
            className="max-h-full max-w-full"
            imageClassName="max-h-[120px] max-w-full object-contain rounded-md"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-md bg-slate-200 dark:bg-slate-600">
            <span className="text-2xl text-slate-400 dark:text-slate-500">
              {shot.name?.charAt(0)?.toUpperCase() || "S"}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-2.5">
        {/* Shot Number + Status Indicator */}
        <div className="mb-1.5 flex items-center justify-between">
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary dark:bg-primary/20">
            {shotNumber || "--"}
          </span>
          <span
            className={`h-2.5 w-2.5 rounded-full ${statusColor}`}
            title={statusLabel}
          />
        </div>

        {/* Shot Name */}
        <h4 className="mb-1 truncate text-sm font-medium text-slate-900 dark:text-slate-100">
          {shot.name || "Untitled shot"}
        </h4>

        {/* Talent */}
        <p className="mb-0.5 truncate text-xs text-slate-600 dark:text-slate-400">
          {talentDisplay}
        </p>

        {/* Products */}
        <p className="mb-0.5 truncate text-xs text-slate-500 dark:text-slate-500">
          {productDisplay}
        </p>

        {/* Scheduled Time */}
        <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
          {scheduledTime || "--"}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1.5 border-t border-slate-100 pt-2 dark:border-slate-700">
          <select
            value={status}
            onChange={(e) => canEdit && onChangeStatus?.(shot, e.target.value)}
            disabled={!canEdit}
            className="flex-1 rounded border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-700 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            {shotStatusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => onEdit(shot)}
              className="rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Edit shot"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlannerCompactCard;
