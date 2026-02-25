import React from "react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Clock, GripVertical } from "lucide-react";
import { cn } from "../../../lib/utils";

/**
 * Single draggable item in the Unscheduled tray
 */
function UnscheduledItem({ entry, onEdit }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: entry.id,
    data: { ...entry, fromUnscheduled: true },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 bg-white border border-slate-200 rounded-md shadow-sm cursor-grab",
        "hover:border-slate-300 hover:shadow transition-all",
        isDragging && "shadow-lg ring-2 ring-blue-200"
      )}
      onClick={() => onEdit?.(entry)}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="text-slate-300 hover:text-slate-500 cursor-grab"
      >
        <GripVertical className="h-3 w-3" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-700 truncate">
          {entry.resolvedTitle || entry.customData?.title || "Untitled"}
        </div>
        {entry.duration && (
          <div className="text-2xs text-slate-400 font-mono">
            {entry.duration}m
          </div>
        )}
      </div>

      {/* Track badge if entry has appliesToTrackIds */}
      {entry.appliesToTrackIds?.length > 0 && (
        <span className="text-3xs px-1 py-0.5 bg-slate-100 text-slate-500 rounded">
          {entry.appliesToTrackIds.length === 1
            ? "1 track"
            : `${entry.appliesToTrackIds.length} tracks`}
        </span>
      )}
    </div>
  );
}

/**
 * UnscheduledTray
 *
 * A compact tray that displays schedule entries that are not yet placed
 * in the timeline (entries with trackId === null or undefined).
 *
 * Supports:
 * - Displaying unscheduled entries with title and duration
 * - Drag and drop to reorder within tray
 * - Drag to a swimlane to assign trackId and placement
 * - Click to open editor modal
 */
export default function UnscheduledTray({
  entries = [],
  onEditEntry,
}) {
  // Droppable zone for the tray itself
  const { setNodeRef, isOver } = useDroppable({
    id: "__unscheduled__",
    data: { type: "unscheduled" },
  });

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border border-dashed border-slate-200 rounded-lg p-3 bg-slate-50/50 transition-colors",
        isOver && "border-blue-300 bg-blue-50/30"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Clock className="h-3.5 w-3.5 text-slate-400" />
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          Unscheduled
        </span>
        <span className="text-2xs text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded-full">
          {entries.length}
        </span>
      </div>

      {/* Hint */}
      <p className="text-2xs text-slate-400 mb-2">
        Drag items below into the timeline to schedule them.
      </p>

      {/* Sortable list of unscheduled items */}
      <SortableContext
        items={entries.map((e) => e.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-1.5">
          {entries.map((entry) => (
            <UnscheduledItem
              key={entry.id}
              entry={entry}
              onEdit={onEditEntry}
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}
