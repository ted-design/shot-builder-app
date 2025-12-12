// src/components/callsheet/timeline/TimelineCanvas.jsx
// Main timeline canvas with ruler and tracks

import React, { useRef, useEffect, useState, useMemo } from "react";
import TimelineRuler, { BASE_HOUR_WIDTH } from "./TimelineRuler";
import TimelineTrack from "./TimelineTrack";
import { parseTimeToMinutes, getCurrentTime } from "../../../lib/timeUtils";
import { cn } from "../../../lib/utils";

// Track label column width
const TRACK_LABEL_WIDTH = 120;

/**
 * TimelineCanvas - Main container for the swimlane timeline view
 *
 * @param {object} props
 * @param {Array} props.tracks - Track configurations
 * @param {Map} props.entriesByTrack - Map of trackId -> entries
 * @param {object} props.settings - Schedule settings
 * @param {number} props.zoomLevel - Current zoom level
 * @param {string} props.selectedEntryId - Currently selected entry ID
 * @param {string} props.draggingEntryId - Currently dragging entry ID
 * @param {Function} props.onEntryClick - Entry click handler
 * @param {Function} props.onEntryDoubleClick - Entry double-click handler
 * @param {Function} props.onEntryResize - Entry resize handler
 * @param {Function} props.onTimeChange - Time change handler
 * @param {Array} props.columnConfig - Column configuration (for future list view)
 */
function TimelineCanvas({
  tracks = [],
  entriesByTrack = new Map(),
  settings = {},
  zoomLevel = 1,
  selectedEntryId,
  draggingEntryId,
  onEntryClick,
  onEntryDoubleClick,
  onEntryResize,
  onTimeChange,
  columnConfig = [],
}) {
  const scrollContainerRef = useRef(null);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // Day bounds from settings
  const dayStart = settings.dayStartTime || "06:00";
  const dayEnd = "22:00"; // Could make this configurable

  // Calculate total width
  const dayStartMinutes = parseTimeToMinutes(dayStart);
  const dayEndMinutes = parseTimeToMinutes(dayEnd);
  const totalMinutes = dayEndMinutes - dayStartMinutes;
  const hourWidth = BASE_HOUR_WIDTH * zoomLevel;
  const totalWidth = (totalMinutes / 60) * hourWidth;

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (!scrollContainerRef.current || isAutoScrolling) return;

    const currentTime = getCurrentTime();
    const currentMinutes = parseTimeToMinutes(currentTime);

    // Only scroll if current time is within the day bounds
    if (currentMinutes >= dayStartMinutes && currentMinutes <= dayEndMinutes) {
      const pixelsPerMinute = hourWidth / 60;
      const scrollPosition = (currentMinutes - dayStartMinutes) * pixelsPerMinute;

      // Center the current time in the viewport
      const containerWidth = scrollContainerRef.current.clientWidth - TRACK_LABEL_WIDTH;
      const targetScroll = Math.max(0, scrollPosition - containerWidth / 2);

      setIsAutoScrolling(true);
      scrollContainerRef.current.scrollLeft = targetScroll;

      // Reset flag after scroll completes
      setTimeout(() => setIsAutoScrolling(false), 100);
    }
  }, [dayStartMinutes, dayEndMinutes, hourWidth, isAutoScrolling]);

  // Current time indicator position
  const currentTimePosition = useMemo(() => {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    if (currentMinutes < dayStartMinutes || currentMinutes > dayEndMinutes) {
      return null;
    }

    const pixelsPerMinute = hourWidth / 60;
    return (currentMinutes - dayStartMinutes) * pixelsPerMinute;
  }, [dayStartMinutes, dayEndMinutes, hourWidth]);

  // Sort tracks by order
  const sortedTracks = useMemo(() => {
    return [...tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [tracks]);

  return (
    <div className="flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* Horizontal scroll container */}
      <div
        ref={scrollContainerRef}
        className="h-full overflow-x-auto overflow-y-auto"
      >
        {/* Timeline content */}
        <div className="inline-block min-w-full">
          {/* Ruler */}
          <div className="sticky top-0 z-20">
            <TimelineRuler
              dayStart={dayStart}
              dayEnd={dayEnd}
              zoomLevel={zoomLevel}
              trackLabelWidth={TRACK_LABEL_WIDTH}
            />
          </div>

          {/* Tracks */}
          <div className="relative">
            {sortedTracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                entries={entriesByTrack.get(track.id) || []}
                dayStart={dayStart}
                dayEnd={dayEnd}
                zoomLevel={zoomLevel}
                settings={settings}
                selectedEntryId={selectedEntryId}
                draggingEntryId={draggingEntryId}
                onEntryClick={onEntryClick}
                onEntryDoubleClick={onEntryDoubleClick}
                onEntryResize={onEntryResize}
                trackLabelWidth={TRACK_LABEL_WIDTH}
              />
            ))}

            {/* Current time indicator line (spanning all tracks) */}
            {currentTimePosition !== null && (
              <div
                className="pointer-events-none absolute top-0 bottom-0 z-10 w-0.5 bg-red-500 dark:bg-red-400"
                style={{ left: TRACK_LABEL_WIDTH + currentTimePosition }}
              />
            )}
          </div>

          {/* Empty state */}
          {sortedTracks.length === 0 && (
            <div className="flex h-48 items-center justify-center text-slate-500">
              <p>No tracks configured. Add tracks in settings.</p>
            </div>
          )}
        </div>
      </div>

      {/* Scroll shadow indicators */}
      <ScrollShadows containerRef={scrollContainerRef} />
    </div>
  );
}

/**
 * Scroll shadow indicators for horizontal scrolling
 */
function ScrollShadows({ containerRef }) {
  const [showLeftShadow, setShowLeftShadow] = useState(false);
  const [showRightShadow, setShowRightShadow] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const checkScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      setShowLeftShadow(scrollLeft > 0);
      setShowRightShadow(scrollLeft + clientWidth < scrollWidth - 1);
    };

    checkScroll();
    container.addEventListener("scroll", checkScroll);
    window.addEventListener("resize", checkScroll);

    return () => {
      container.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [containerRef]);

  return (
    <>
      {/* Left shadow */}
      <div
        className={cn(
          "pointer-events-none absolute left-0 top-0 bottom-0 w-8",
          "bg-gradient-to-r from-black/5 to-transparent",
          "transition-opacity duration-200",
          showLeftShadow ? "opacity-100" : "opacity-0"
        )}
        style={{ left: TRACK_LABEL_WIDTH }}
      />

      {/* Right shadow */}
      <div
        className={cn(
          "pointer-events-none absolute right-0 top-0 bottom-0 w-8",
          "bg-gradient-to-l from-black/5 to-transparent",
          "transition-opacity duration-200",
          showRightShadow ? "opacity-100" : "opacity-0"
        )}
      />
    </>
  );
}

export default TimelineCanvas;

// Export constants
export { TRACK_LABEL_WIDTH };
