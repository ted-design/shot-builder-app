import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronUp, ChevronDown, Inbox } from "lucide-react";

/**
 * Collapsible tray for unassigned shots.
 * Always renders as a drop zone, expands inline to show shots when clicked.
 */
function UnassignedShotsTray({
  laneId,
  shots,
  expanded,
  onToggleExpanded,
  renderShots,
  density = "comfortable",
}) {
  const shotCount = shots?.length || 0;

  // Always a droppable zone (even when collapsed)
  const { setNodeRef, isOver } = useDroppable({
    id: `unassigned-tray-${laneId}`,
    data: { type: "lane", laneId },
  });

  const isCompact = density === "compact";

  return (
    <div
      ref={setNodeRef}
      className={`
        rounded-xl border transition-all duration-200
        ${isOver
          ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md"
          : "border-dashed border-slate-300 bg-slate-50/80 dark:border-slate-600 dark:bg-slate-800/50"
        }
      `}
    >
      {/* Header - Always visible, clickable to expand */}
      <button
        type="button"
        onClick={onToggleExpanded}
        className={`
          flex w-full items-center justify-between gap-3 px-4
          ${isCompact ? "py-2.5" : "py-3"}
          text-left transition-colors
          hover:bg-slate-100/50 dark:hover:bg-slate-700/30
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-inset
          rounded-xl
        `}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          <div className={`
            flex items-center justify-center rounded-lg
            ${isOver ? "bg-primary/20 text-primary" : "bg-slate-200/80 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}
            ${isCompact ? "h-8 w-8" : "h-9 w-9"}
          `}>
            <Inbox className={isCompact ? "h-4 w-4" : "h-5 w-5"} />
          </div>
          <div className="flex flex-col">
            <span className={`font-medium text-slate-700 dark:text-slate-200 ${isCompact ? "text-sm" : "text-base"}`}>
              Unassigned
            </span>
            {shotCount > 0 && !expanded && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {shotCount} shot{shotCount !== 1 ? "s" : ""} awaiting assignment
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Count badge */}
          <span className={`
            rounded-full px-2.5 py-0.5 text-xs font-semibold
            ${shotCount > 0
              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
              : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
            }
          `}>
            {shotCount}
          </span>
          {/* Expand/Collapse chevron */}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 dark:text-slate-500" />
          )}
        </div>
      </button>

      {/* Expanded content - Shot grid */}
      {expanded && shotCount > 0 && (
        <div className={`
          border-t border-dashed border-slate-300 dark:border-slate-600
          ${isCompact ? "p-3" : "p-4"}
        `}>
          {/* Render shots using the provided render function */}
          {renderShots ? (
            renderShots(shots)
          ) : (
            <div className={`
              grid gap-3
              ${isCompact ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"}
            `}>
              {shots.map((shot) => (
                <div
                  key={shot.id}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  {shot.name || "Untitled Shot"}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Empty state when expanded but no shots */}
      {expanded && shotCount === 0 && (
        <div className={`
          border-t border-dashed border-slate-300 dark:border-slate-600
          ${isCompact ? "p-4" : "p-6"}
          text-center
        `}>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No unassigned shots. Drag shots here to remove them from lanes.
          </p>
        </div>
      )}

      {/* Drop hint when dragging over collapsed tray */}
      {isOver && !expanded && (
        <div className="border-t border-primary/30 bg-primary/5 px-4 py-2 text-center text-xs font-medium text-primary dark:bg-primary/10">
          Drop to unassign from lane
        </div>
      )}
    </div>
  );
}

export default UnassignedShotsTray;
