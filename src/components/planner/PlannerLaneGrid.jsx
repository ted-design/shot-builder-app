import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy } from "@dnd-kit/sortable";

/**
 * Multi-column responsive grid for shots within a lane.
 * Wraps shots in a SortableContext for drag-and-drop reordering.
 */
function PlannerLaneGrid({
  laneId,
  shots,
  renderShot,
  density = "comfortable",
  className = "",
  emptyMessage = "No shots in this lane",
}) {
  const shotIds = shots.map((s) => s.id);

  // Make the entire grid area a droppable zone
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-grid-${laneId}`,
    data: { type: "lane", laneId },
  });

  const isCompact = density === "compact";

  // Responsive grid columns based on density
  const gridClasses = isCompact
    ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4";

  if (shots.length === 0) {
    return (
      <div
        ref={setNodeRef}
        className={`
          flex min-h-[200px] items-center justify-center rounded-xl border-2 border-dashed
          transition-colors duration-200
          ${isOver
            ? "border-primary bg-primary/5 dark:bg-primary/10"
            : "border-slate-300 bg-slate-50/50 dark:border-slate-600 dark:bg-slate-800/30"
          }
          ${className}
        `}
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isOver ? "Drop shot here" : emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={`
        relative rounded-xl transition-colors duration-200
        ${isOver ? "ring-2 ring-primary/50 ring-offset-2 dark:ring-offset-slate-900" : ""}
        ${className}
      `}
    >
      <SortableContext items={shotIds} strategy={rectSortingStrategy}>
        <div className={`grid ${gridClasses}`}>
          {shots.map((shot, index) => (
            <div key={shot.id} className="relative">
              {renderShot(shot, index)}
            </div>
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default PlannerLaneGrid;
