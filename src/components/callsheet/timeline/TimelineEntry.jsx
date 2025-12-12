// src/components/callsheet/timeline/TimelineEntry.jsx
// Individual entry component for the timeline (draggable & resizable)

import React, { useState, useRef, useCallback } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Clock,
  User,
  Package,
  MapPin,
  Coffee,
  Utensils,
  Truck,
  Users,
  Wrench,
  Flag,
  MoreHorizontal,
} from "lucide-react";
import { formatDuration, minutesToTime12h, parseTimeToMinutes } from "../../../lib/timeUtils";
import {
  CUSTOM_ENTRY_CATEGORY_COLORS,
  CUSTOM_ENTRY_CATEGORY_LABELS,
} from "../../../types/schedule";
import { cn } from "../../../lib/utils";

// Category icons mapping
const CATEGORY_ICONS = {
  setup: Wrench,
  break: Coffee,
  lunch: Utensils,
  wrap: Flag,
  travel: Truck,
  meeting: Users,
  talent: User,
  other: MoreHorizontal,
};

/**
 * TimelineEntry - A single entry on the timeline
 *
 * @param {object} props
 * @param {object} props.entry - The resolved entry object
 * @param {object} props.track - The track this entry belongs to
 * @param {boolean} props.isSelected - Whether this entry is selected
 * @param {boolean} props.isDragging - Whether this entry is being dragged
 * @param {number} props.zoomLevel - Current zoom level
 * @param {object} props.settings - Schedule settings
 * @param {Function} props.onClick - Click handler
 * @param {Function} props.onDoubleClick - Double-click handler
 * @param {Function} props.onResize - Resize handler
 * @param {number} props.left - Left position in pixels
 * @param {number} props.width - Width in pixels
 */
function TimelineEntry({
  entry,
  track,
  isSelected = false,
  isDragging = false,
  zoomLevel = 1,
  settings = {},
  onClick,
  onDoubleClick,
  onResize,
  left = 0,
  width = 100,
}) {
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef(null);

  // DnD setup
  const { attributes, listeners, setNodeRef, transform, isDragging: isDndDragging } =
    useDraggable({
      id: entry.id,
      data: {
        type: "entry",
        entry,
        trackId: track?.id,
      },
    });

  // Determine entry color
  const getEntryColor = () => {
    if (entry.type === "shot") {
      return track?.color || "#64748B";
    }
    if (entry.type === "custom" && entry.customData?.category) {
      return CUSTOM_ENTRY_CATEGORY_COLORS[entry.customData.category] || "#71717A";
    }
    return "#64748B";
  };

  const entryColor = getEntryColor();

  // Get category icon
  const getCategoryIcon = () => {
    if (entry.type !== "custom" || !entry.customData?.category) return null;
    const IconComponent = CATEGORY_ICONS[entry.customData.category];
    return IconComponent ? <IconComponent className="h-3 w-3" /> : null;
  };

  // Handle resize start
  const handleResizeStart = useCallback(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      setIsResizing(true);
      resizeStartRef.current = {
        x: e.clientX,
        initialWidth: width,
        initialDuration: entry.duration,
      };

      const handleMouseMove = (moveEvent) => {
        if (!resizeStartRef.current) return;
        const delta = moveEvent.clientX - resizeStartRef.current.x;
        // Calculate new duration based on delta and zoom
        const pixelsPerMinute = (120 * zoomLevel) / 60;
        const deltaMinutes = Math.round(delta / pixelsPerMinute);
        const newDuration = Math.max(
          settings.timeIncrement || 15,
          resizeStartRef.current.initialDuration + deltaMinutes
        );
        // Snap to increment
        const snappedDuration =
          Math.round(newDuration / (settings.timeIncrement || 15)) *
          (settings.timeIncrement || 15);
        onResize?.(entry.id, snappedDuration);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        resizeStartRef.current = null;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [entry.id, entry.duration, width, zoomLevel, settings.timeIncrement, onResize]
  );

  // Entry is compact if width is small
  const isCompact = width < 100;
  const isVeryCompact = width < 60;

  // Transform for dragging
  const style = {
    left,
    width,
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "absolute top-1 bottom-1 rounded-md border shadow-sm transition-shadow",
        "cursor-grab active:cursor-grabbing",
        "group",
        isSelected && "ring-2 ring-primary ring-offset-1",
        (isDragging || isDndDragging) && "opacity-50 shadow-lg",
        isResizing && "cursor-ew-resize",
        entry.hasOverlap && "ring-1 ring-amber-400 ring-offset-1"
      )}
      style={{
        ...style,
        backgroundColor: `${entryColor}15`,
        borderColor: entryColor,
      }}
      onClick={() => onClick?.(entry.id)}
      onDoubleClick={() => onDoubleClick?.(entry.id)}
      {...attributes}
      {...listeners}
    >
      {/* Overlap indicator */}
      {entry.hasOverlap && (
        <div
          className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-amber-400"
          title={`Overlaps with ${entry.overlapsWith?.length || 0} other entries`}
        />
      )}

      {/* Content */}
      <div className="flex h-full items-center gap-1 overflow-hidden px-2">
        {/* Drag handle (visible on hover) */}
        <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-50">
          <GripVertical className="h-3 w-3" />
        </div>

        {/* Category icon for custom entries */}
        {entry.type === "custom" && !isVeryCompact && (
          <div className="shrink-0" style={{ color: entryColor }}>
            {getCategoryIcon()}
          </div>
        )}

        {/* Title */}
        <div className="min-w-0 flex-1 truncate">
          <span
            className="text-xs font-medium"
            style={{ color: entryColor }}
          >
            {entry.resolvedTitle}
          </span>
        </div>

        {/* Time (if not compact) */}
        {!isCompact && settings.showDurations && (
          <div className="shrink-0 text-[10px] text-slate-500">
            {formatDuration(entry.duration)}
          </div>
        )}

        {/* Thumbnail for shot entries (if space allows) */}
        {entry.type === "shot" && entry.resolvedImage && width >= 120 && (
          <div className="shrink-0">
            <img
              src={entry.resolvedImage}
              alt=""
              className="h-6 w-6 rounded object-cover"
            />
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize",
          "opacity-0 transition-opacity group-hover:opacity-100",
          "bg-gradient-to-r from-transparent to-slate-400/30",
          "rounded-r-md"
        )}
        onMouseDown={handleResizeStart}
      />

      {/* Time tooltip on hover */}
      <div
        className={cn(
          "absolute -top-6 left-1/2 -translate-x-1/2",
          "rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white",
          "pointer-events-none opacity-0 transition-opacity",
          "group-hover:opacity-100"
        )}
      >
        {minutesToTime12h(parseTimeToMinutes(entry.startTime))} -{" "}
        {minutesToTime12h(parseTimeToMinutes(entry.endTime))}
      </div>
    </div>
  );
}

export default TimelineEntry;
