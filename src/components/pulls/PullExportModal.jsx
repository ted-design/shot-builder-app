// src/components/pulls/PullExportModal.jsx
//
// Modal for configuring and exporting pulls to PDF or CSV

import React, { useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { downloadPullAsCSV, formatPullForPDF } from "../../lib/pullExport";
import { pdf } from "@react-pdf/renderer";
import { PullPDF } from "../../lib/pdfTemplates";
import { toast } from "../../lib/toast";

export default function PullExportModal({ pull, onClose }) {
  const [format, setFormat] = useState("pdf"); // "pdf" | "csv"
  const [exporting, setExporting] = useState(false);

  // PDF settings
  const [pdfOrientation, setPdfOrientation] = useState("portrait");
  const [headerText, setHeaderText] = useState("");
  const [subheaderText, setSubheaderText] = useState("");
  const [includeImages, setIncludeImages] = useState(true);
  const [pageBreakStrategy, setPageBreakStrategy] = useState("auto");

  // CSV settings
  const [includeNotes, setIncludeNotes] = useState(true);
  const [flattenSizes, setFlattenSizes] = useState(true);

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
        // PDF export
        const settings = {
          orientation: pdfOrientation,
          headerText: headerText.trim(),
          subheaderText: subheaderText.trim(),
          includeImages,
          pageBreakStrategy,
        };

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
    <Modal open onClose={onClose} labelledBy="export-pull-title" contentClassName="max-w-2xl">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="export-pull-title" className="text-lg font-semibold">
            Export Pull
          </h2>
          <p className="text-sm text-slate-600">
            Configure export settings for {pull.title || "this pull"}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Export Format</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex-1 rounded-lg border-2 p-4 text-center transition ${
                  format === "pdf"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold">PDF</div>
                <div className="text-xs text-slate-600">Formatted document</div>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex-1 rounded-lg border-2 p-4 text-center transition ${
                  format === "csv"
                    ? "border-blue-500 bg-blue-50 text-blue-900"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="text-sm font-semibold">CSV</div>
                <div className="text-xs text-slate-600">Spreadsheet data</div>
              </button>
            </div>
          </div>

          {/* PDF Settings */}
          {format === "pdf" && (
            <>
              <div className="space-y-2">
                <label htmlFor="header-text" className="text-sm font-medium text-slate-700">
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
                <label htmlFor="subheader-text" className="text-sm font-medium text-slate-700">
                  Subheader Text (optional)
                </label>
                <Input
                  id="subheader-text"
                  placeholder="e.g., Warehouse Pull Request"
                  value={subheaderText}
                  onChange={(e) => setSubheaderText(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="orientation" className="text-sm font-medium text-slate-700">
                  Page Orientation
                </label>
                <select
                  id="orientation"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={pdfOrientation}
                  onChange={(e) => setPdfOrientation(e.target.value)}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="page-break" className="text-sm font-medium text-slate-700">
                  Page Break Strategy
                </label>
                <select
                  id="page-break"
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"
                  value={pageBreakStrategy}
                  onChange={(e) => setPageBreakStrategy(e.target.value)}
                >
                  <option value="auto">Automatic</option>
                  <option value="by-gender">Break by Gender</option>
                  <option value="by-category">Break by Category</option>
                </select>
                <p className="text-xs text-slate-500">
                  Controls how items are grouped across pages
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="include-images"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="include-images" className="text-sm text-slate-700">
                  Include product images
                </label>
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
                  className="h-4 w-4 rounded border-slate-300"
                />
                <label htmlFor="include-notes-csv" className="text-sm text-slate-700">
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
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <label htmlFor="flatten-sizes" className="text-sm text-slate-700">
                    Create one row per size
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  When enabled, items with multiple sizes will have one row per size. When
                  disabled, sizes are combined in a single row.
                </p>
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={exporting}>
              {exporting ? "Exporting..." : `Export ${format.toUpperCase()}`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
