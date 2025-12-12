// src/components/callsheet/timeline/TimelineZoomControls.jsx
// Zoom controls for the timeline view

import React from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "../../ui/button";

// Available zoom levels
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const DEFAULT_ZOOM = 1;
const MIN_ZOOM = ZOOM_LEVELS[0];
const MAX_ZOOM = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];

/**
 * TimelineZoomControls - Zoom in/out controls for the timeline
 *
 * @param {object} props
 * @param {number} props.zoomLevel - Current zoom level (0.5 - 2)
 * @param {Function} props.onZoomChange - Callback when zoom changes
 */
function TimelineZoomControls({ zoomLevel = 1, onZoomChange }) {
  const handleZoomIn = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_LEVELS.length - 1) {
      onZoomChange?.(ZOOM_LEVELS[currentIndex + 1]);
    }
  };

  const handleZoomOut = () => {
    const currentIndex = ZOOM_LEVELS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      onZoomChange?.(ZOOM_LEVELS[currentIndex - 1]);
    }
  };

  const handleReset = () => {
    onZoomChange?.(DEFAULT_ZOOM);
  };

  const canZoomIn = zoomLevel < MAX_ZOOM;
  const canZoomOut = zoomLevel > MIN_ZOOM;
  const isDefault = zoomLevel === DEFAULT_ZOOM;

  // Format zoom as percentage
  const zoomPercent = Math.round(zoomLevel * 100);

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        className="h-8 w-8 p-0"
        title="Zoom Out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleReset}
        disabled={isDefault}
        className="h-8 min-w-[52px] px-2 text-xs font-medium"
        title="Reset Zoom"
      >
        {zoomPercent}%
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        className="h-8 w-8 p-0"
        title="Zoom In"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default TimelineZoomControls;
