// src/components/pulls/PullExportModal.jsx
//
// Enhanced modal with WYSIWYG preview for pull sheet export
// Supports PDF and CSV formats with drag-and-drop section management

import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { downloadPullAsCSV, formatPullForPDF } from "../../lib/pullExport";
import { pdf } from "@react-pdf/renderer";
import { PullPDF } from "../../lib/pdfTemplates";
import { toast } from "../../lib/toast";
import { FileDown, Eye, X, GripVertical } from "lucide-react";
import PullSheetSectionManager from "./PullSheetSectionManager";
import PullSheetPreview from "./PullSheetPreview";
import {
  getDefaultSectionConfig,
  exportSettingsToSectionConfig,
  sectionConfigToExportSettings,
} from "../../lib/pullSheetSections";

export default function PullExportModal({ pull, onClose }) {
  const [format, setFormat] = useState("pdf"); // "pdf" | "csv"
  const [exporting, setExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Resizable divider state
  const [dividerPosition, setDividerPosition] = useState(40); // percentage
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  // PDF settings (using new section-based configuration)
  const [pdfOrientation, setPdfOrientation] = useState("portrait");
  const [headerText, setHeaderText] = useState("");
  const [subheaderText, setSubheaderText] = useState("");
  const [pageBreakStrategy, setPageBreakStrategy] = useState("auto");
  const [sectionStates, setSectionStates] = useState(() => getDefaultSectionConfig());

  // CSV settings
  const [includeNotes, setIncludeNotes] = useState(true);
  const [flattenSizes, setFlattenSizes] = useState(true);

  /**
   * Handle mouse move for resizing divider
   */
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging || !containerRef.current) return;

      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const newPosition = ((e.clientX - rect.left) / rect.width) * 100;

      // Constrain between 20% and 80%
      const clampedPosition = Math.min(Math.max(newPosition, 20), 80);
      setDividerPosition(clampedPosition);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  /**
   * Handle preset application - update orientation too
   */
  const handlePresetApply = (preset) => {
    setPdfOrientation(preset.orientation);
    setPageBreakStrategy(preset.pageBreakStrategy);
  };

  /**
   * Handle PDF/CSV export
   */
  const handleExport = async () => {
    setExporting(true);

    try {
      if (format === "csv") {
        downloadPullAsCSV(pull, {
          includeNotes,
          flattenSizes,
        });
        toast.success({ title: "CSV exported successfully" });
      } else {
        // PDF export - convert section states to legacy format
        const settings = sectionConfigToExportSettings(
          sectionStates,
          pdfOrientation,
          pageBreakStrategy
        );

        // Add header text and other settings
        settings.headerText = headerText.trim();
        settings.subheaderText = subheaderText.trim();

        const formattedPull = formatPullForPDF(pull, settings);
        const blob = await pdf(<PullPDF pull={formattedPull} />).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${pull.title || "pull"}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        toast.success({ title: "PDF exported successfully" });
      }

      onClose();
    } catch (error) {
      console.error("[PullExportModal] Export failed", error);
      toast.error({ title: "Export failed", description: error.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Export Pull Sheet
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {pull.title || "Untitled Pull"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Preview Toggle (PDF only) */}
          {format === "pdf" && (
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className={`
                flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors
                ${showPreview
                  ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400'
                }
              `}
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm font-medium">
                {showPreview ? 'Hide Preview' : 'Show Preview'}
              </span>
            </button>
          )}

          <Button onClick={handleExport} disabled={exporting} className="gap-2">
            <FileDown className="w-4 h-4" />
            {exporting ? "Exporting..." : `Export ${format.toUpperCase()}`}
          </Button>
        </div>
      </div>

      {/* Main Content Area with Resizable Panels */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
        {/* Left Panel - Configuration */}
        <div
          className="flex flex-col overflow-y-auto bg-slate-50 dark:bg-slate-800/50"
          style={{ width: `${dividerPosition}%` }}
        >
          <div className="p-6 space-y-6">
            {/* Format Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Export Format</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setFormat("pdf")}
                  className={`flex-1 rounded-card border-2 p-4 text-center transition ${
                    format === "pdf"
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="text-sm font-semibold">PDF</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Formatted document</div>
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("csv")}
                  className={`flex-1 rounded-card border-2 p-4 text-center transition ${
                    format === "csv"
                      ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                      : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="text-sm font-semibold">CSV</div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">Spreadsheet data</div>
                </button>
              </div>
            </div>

            {/* PDF Settings */}
            {format === "pdf" && (
              <>
                {/* Header Text Inputs */}
                <div className="space-y-2">
                  <label htmlFor="header-text" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Header Text (optional)
                  </label>
                  <Input
                    id="header-text"
                    placeholder="e.g., Fall 2025 Collection"
                    value={headerText}
                    onChange={(e) => setHeaderText(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="subheader-text" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Subheader Text (optional)
                  </label>
                  <Input
                    id="subheader-text"
                    placeholder="e.g., Warehouse Pull Request"
                    value={subheaderText}
                    onChange={(e) => setSubheaderText(e.target.value)}
                  />
                </div>

                {/* Layout Settings */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="orientation" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Orientation
                    </label>
                    <select
                      id="orientation"
                      className="h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm"
                      value={pdfOrientation}
                      onChange={(e) => setPdfOrientation(e.target.value)}
                    >
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="page-break" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Grouping
                    </label>
                    <select
                      id="page-break"
                      className="h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 text-sm"
                      value={pageBreakStrategy}
                      onChange={(e) => setPageBreakStrategy(e.target.value)}
                    >
                      <option value="auto">No Grouping</option>
                      <option value="by-gender">Group by Gender</option>
                      <option value="by-category">Group by Category</option>
                    </select>
                  </div>
                </div>

                {/* Section Manager */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <PullSheetSectionManager
                    sectionStates={sectionStates}
                    onSectionStatesChange={setSectionStates}
                    onPresetApply={handlePresetApply}
                  />
                </div>
              </>
            )}

            {/* CSV Settings */}
            {format === "csv" && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="include-notes-csv"
                    checked={includeNotes}
                    onChange={(e) => setIncludeNotes(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  />
                  <label htmlFor="include-notes-csv" className="text-sm text-slate-700 dark:text-slate-300">
                    Include notes column
                  </label>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="flatten-sizes"
                      checked={flattenSizes}
                      onChange={(e) => setFlattenSizes(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    />
                    <label htmlFor="flatten-sizes" className="text-sm text-slate-700 dark:text-slate-300">
                      Create one row per size
                    </label>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    When enabled, items with multiple sizes will have one row per size. When
                    disabled, sizes are combined in a single row.
                  </p>
                </div>
              </>
            )}

          </div>
        </div>

        {/* Resizable Divider */}
        {format === "pdf" && showPreview && (
          <div
            className={`w-1 bg-slate-200 dark:bg-slate-700 hover:bg-blue-500 dark:hover:bg-blue-400 transition-colors cursor-col-resize flex items-center justify-center group ${
              isDragging ? 'bg-blue-500 dark:bg-blue-400' : ''
            }`}
            onMouseDown={() => setIsDragging(true)}
          >
            <div className="absolute w-6 h-12 flex items-center justify-center bg-slate-300 dark:bg-slate-600 group-hover:bg-blue-500 dark:group-hover:bg-blue-400 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
              <GripVertical className="w-4 h-4 text-white" />
            </div>
          </div>
        )}

        {/* Right Panel - Preview (PDF only) */}
        {format === "pdf" && showPreview && (
          <div
            className="flex-1 overflow-auto bg-slate-100 dark:bg-slate-900 p-6"
            style={{ width: `${100 - dividerPosition}%` }}
          >
            <div className="max-w-full mx-auto">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2 sticky top-0 bg-slate-100 dark:bg-slate-900 py-2 z-10">
                <Eye className="w-4 h-4" />
                Live Preview
              </h3>
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg">
                <PullSheetPreview
                  pull={pull}
                  sectionStates={sectionStates}
                  orientation={pdfOrientation}
                  pageBreakStrategy={pageBreakStrategy}
                  headerText={headerText}
                  subheaderText={subheaderText}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 text-center">
                Preview updates in real-time as you configure sections. Drag the divider to resize panels.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
