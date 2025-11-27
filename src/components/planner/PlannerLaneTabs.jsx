import React, { useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";

/**
 * A single droppable tab for a lane.
 * When dragging a shot, hovering over a tab makes it a drop target.
 */
function DroppableLaneTab({ laneId, laneName, shotCount, isSelected, onSelect, isOver: parentIsOver }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane-tab-${laneId}`,
    data: { type: "lane-tab", laneId },
  });

  const showDropHighlight = isOver || parentIsOver;

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onSelect(laneId)}
      className={`
        relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium
        transition-all duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60
        ${isSelected
          ? "bg-primary text-white shadow-sm"
          : showDropHighlight
            ? "bg-primary/20 text-primary ring-2 ring-primary dark:bg-primary/30"
            : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        }
      `}
      aria-selected={isSelected}
      role="tab"
    >
      <span className="truncate max-w-[120px]" title={laneName}>
        {laneName}
      </span>
      <span className={`
        rounded-full px-1.5 py-0.5 text-xs font-semibold
        ${isSelected
          ? "bg-white/20 text-white"
          : "bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300"
        }
      `}>
        {shotCount}
      </span>
    </button>
  );
}

/**
 * Horizontal scrollable tab bar for lanes.
 * Each tab is a droppable zone for cross-lane drag-and-drop.
 */
function PlannerLaneTabs({
  lanes,
  shotsByLane,
  selectedLaneId,
  onSelectLane,
  onAddLane,
  className = "",
}) {
  const scrollContainerRef = useRef(null);
  const selectedTabRef = useRef(null);

  // Scroll to selected tab when it changes
  useEffect(() => {
    if (selectedTabRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const tab = selectedTabRef.current;
      const containerRect = container.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();

      // Check if tab is outside visible area
      if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
        tab.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [selectedLaneId]);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -200, behavior: "smooth" });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 200, behavior: "smooth" });
  };

  return (
    <div className={`relative flex items-center gap-2 ${className}`}>
      {/* Scroll left button */}
      <button
        type="button"
        onClick={scrollLeft}
        className="hidden sm:flex shrink-0 h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
        aria-label="Scroll tabs left"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Scrollable tabs container */}
      <div
        ref={scrollContainerRef}
        className="flex flex-1 items-center gap-2 overflow-x-auto scrollbar-hide scroll-smooth"
        role="tablist"
        aria-label="Lane tabs"
      >
        {lanes.map((lane) => {
          const isSelected = lane.id === selectedLaneId;
          const shotCount = shotsByLane[lane.id]?.length || 0;

          return (
            <div
              key={lane.id}
              ref={isSelected ? selectedTabRef : null}
            >
              <DroppableLaneTab
                laneId={lane.id}
                laneName={lane.name}
                shotCount={shotCount}
                isSelected={isSelected}
                onSelect={onSelectLane}
              />
            </div>
          );
        })}

        {/* Add lane button */}
        {onAddLane && (
          <button
            type="button"
            onClick={onAddLane}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:border-primary hover:bg-primary/5 hover:text-primary dark:border-slate-600 dark:text-slate-400 dark:hover:border-primary dark:hover:text-primary"
            aria-label="Add new lane"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Lane</span>
          </button>
        )}
      </div>

      {/* Scroll right button */}
      <button
        type="button"
        onClick={scrollRight}
        className="hidden sm:flex shrink-0 h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
        aria-label="Scroll tabs right"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export default PlannerLaneTabs;
