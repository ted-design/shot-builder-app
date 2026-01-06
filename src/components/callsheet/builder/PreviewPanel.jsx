import React, { useCallback, useMemo, useState } from "react";
import { ZoomIn, ZoomOut, RefreshCw, RotateCcw, Image as ImageIcon, ImageOff } from "lucide-react";
import { Button } from "../../ui/button";
import CallSheetPreview from "../vertical/CallSheetPreview";

export default function PreviewPanel({
  schedule,
  entries,
  tracks,
  columnConfig,
  onColumnResize,
  dayDetails,
  crewRows,
  talentRows,
  sections,
  callSheetConfig,
}) {
  const [zoomPercent, setZoomPercent] = useState(100);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [showImages, setShowImages] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetPreview.showImages");
      if (stored == null) return true;
      return stored === "true";
    } catch {
      return true;
    }
  });

  const zoom = useMemo(() => zoomPercent / 100, [zoomPercent]);
  const minZoom = 50;
  const maxZoom = 200;
  const step = 10;

  const handleZoomOut = useCallback(() => {
    setZoomPercent((prev) => Math.max(minZoom, prev - step));
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomPercent((prev) => Math.min(maxZoom, prev + step));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomPercent(100);
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshNonce((prev) => prev + 1);
  }, []);

  const toggleImages = useCallback(() => {
    setShowImages((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("callSheetPreview.showImages", String(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preview</div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={toggleImages} title="Toggle images">
            {showImages ? <ImageIcon className="h-4 w-4" /> : <ImageOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="min-w-[56px] text-center text-xs font-medium text-slate-600 dark:text-slate-300">
            {zoomPercent}%
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleResetZoom} title="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleRefresh} title="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
        <CallSheetPreview
          key={refreshNonce}
          schedule={schedule}
          entries={entries}
          tracks={tracks}
          columnConfig={columnConfig}
          zoomLevel={zoom}
          showImages={showImages}
          onColumnResize={onColumnResize}
          dayDetails={dayDetails}
          crewRows={crewRows}
          talentRows={talentRows}
          sections={sections}
          callSheetConfig={callSheetConfig}
        />
      </div>
    </div>
  );
}
