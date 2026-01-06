import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ZoomIn,
  ZoomOut,
  RefreshCw,
  RotateCcw,
  Image as ImageIcon,
  ImageOff,
  Maximize2,
  Minimize2,
  Link2,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Checkbox } from "../../ui/input";
import { toast } from "../../../lib/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import CallSheetPreview from "../vertical/CallSheetPreview";

export default function PreviewPanel({
  projectId,
  scheduleId,
  schedule,
  entries,
  tracks,
  columnConfig,
  onColumnResize,
  dayDetails,
  crewRows,
  talentRows,
  clientRows,
  sections,
  callSheetConfig,
  layoutV2,
}) {
  const panelRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [showMobile, setShowMobile] = useState(() => {
    try {
      const stored = localStorage.getItem("callSheetPreview.showMobile");
      if (stored == null) return false;
      return stored === "true";
    } catch {
      return false;
    }
  });

  const zoom = useMemo(() => zoomPercent / 100, [zoomPercent]);
  const minZoom = 50;
  const maxZoom = 200;
  const step = 10;

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    handleFullscreenChange();
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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

  const handleToggleMobile = useCallback((event) => {
    const next = Boolean(event.target.checked);
    setShowMobile(next);
    try {
      localStorage.setItem("callSheetPreview.showMobile", String(next));
    } catch {}
  }, []);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    if (!projectId || !scheduleId) return "";
    const url = new URL(window.location.href);
    url.pathname = `/projects/${projectId}/schedule`;
    url.searchParams.set("scheduleId", scheduleId);
    url.searchParams.set("callSheetBuilder", "1");
    url.searchParams.set("preview", "1");
    url.hash = "";
    return url.toString();
  }, [projectId, scheduleId]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success({ title: "Preview link copied" });
    } catch {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.top = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        toast.success({ title: "Preview link copied" });
      } catch {
        toast.error({ title: "Failed to copy link" });
      }
    }
  }, [shareUrl]);

  const handleOpenLink = useCallback(() => {
    if (!shareUrl) return;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  }, [shareUrl]);

  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === "undefined") return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (panelRef.current?.requestFullscreen) {
        await panelRef.current.requestFullscreen();
        return;
      }
      toast.info({ title: "Fullscreen not supported" });
    } catch {
      toast.error({ title: "Failed to enter fullscreen" });
    }
  }, []);

  return (
    <div
      ref={panelRef}
      className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800">
        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Preview</div>
        <div className="flex items-center gap-1">
          <label className="mr-2 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
            <Checkbox checked={showMobile} onChange={handleToggleMobile} />
            Show mobile
          </label>

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
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleToggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                title={shareUrl ? "Share preview link" : "Select a schedule to share"}
                disabled={!shareUrl}
              >
                <Link2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopyLink}>Copy link</DropdownMenuItem>
              <DropdownMenuItem onClick={handleOpenLink}>Open in new tab</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
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
          mobileMode={showMobile}
          onColumnResize={onColumnResize}
          dayDetails={dayDetails}
          crewRows={crewRows}
          talentRows={talentRows}
          clientRows={clientRows}
          sections={sections}
          callSheetConfig={callSheetConfig}
          layoutV2={layoutV2}
        />
      </div>
    </div>
  );
}
