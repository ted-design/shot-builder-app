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
  const [repeatHeaderEachPage, setRepeatHeaderEachPage] = useState(true);
  const [groupHeaderEachSection, setGroupHeaderEachSection] = useState(true);
  const [columnFlex, setColumnFlex] = useState({
    image: 0.7,
    product: 2,
    styleNumber: 1,
    colour: 1,
    gender: 0.8,
    size: 0.7,
    quantity: 0.7,
    fulfilled: 0.9,
    notes: 1.5,
  });
  const [pdfColumns, setPdfColumns] = useState({
    product: true,
    styleNumber: true,
    colour: true,
    gender: true,
    size: true,
    quantity: true,
    fulfilled: true,
    notes: true,
  });

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
          columns: pdfColumns,
          repeatHeaderEachPage,
          groupHeaderEachSection,
          columnFlex,
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
          <h2 id="export-pull-title" className="text-lg font-semibold text-slate-900 dark:text-gray-100">
            Export Pull
          </h2>
          <p className="text-sm text-slate-600 dark:text-gray-400">
            Configure export settings for {pull.title || "this pull"}
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Export Format</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormat("pdf")}
                className={`flex-1 rounded-lg border-2 p-4 text-center transition ${
                  format === "pdf"
                    ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                    : "border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="text-sm font-semibold">PDF</div>
                <div className="text-xs text-slate-600 dark:text-gray-400">Formatted document</div>
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`flex-1 rounded-lg border-2 p-4 text-center transition ${
                  format === "csv"
                    ? "border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100"
                    : "border-slate-200 dark:border-gray-700 hover:border-slate-300 dark:hover:border-gray-600"
                }`}
              >
                <div className="text-sm font-semibold">CSV</div>
                <div className="text-xs text-slate-600 dark:text-gray-400">Spreadsheet data</div>
              </button>
            </div>
          </div>

          {/* PDF Settings */}
          {format === "pdf" && (
            <>
              <div className="space-y-2">
                <label htmlFor="header-text" className="text-sm font-medium text-slate-700 dark:text-gray-300">
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
                <label htmlFor="subheader-text" className="text-sm font-medium text-slate-700 dark:text-gray-300">
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
                <label htmlFor="orientation" className="text-sm font-medium text-slate-700 dark:text-gray-300">
                  Page Orientation
                </label>
                <select
                  id="orientation"
                  className="h-10 w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 text-sm"
                  value={pdfOrientation}
                  onChange={(e) => setPdfOrientation(e.target.value)}
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="page-break" className="text-sm font-medium text-slate-700 dark:text-gray-300">
                  Page Break Strategy
                </label>
                <select
                  id="page-break"
                  className="h-10 w-full rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-slate-900 dark:text-gray-100 px-3 text-sm"
                  value={pageBreakStrategy}
                  onChange={(e) => setPageBreakStrategy(e.target.value)}
                >
                  <option value="auto">Automatic</option>
                  <option value="by-gender">Break by Gender</option>
                  <option value="by-category">Break by Category</option>
                </select>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Controls how items are grouped across pages
                </p>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-700 dark:text-gray-300">Columns</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    { key: "product", label: "Product" },
                    { key: "styleNumber", label: "Style Number" },
                    { key: "colour", label: "Colour" },
                    { key: "gender", label: "Gender" },
                    { key: "size", label: "Size" },
                    { key: "quantity", label: "Qty Requested" },
                    { key: "fulfilled", label: "Qty Fulfilled" },
                    { key: "notes", label: "Notes" },
                  ].map((c) => (
                    <label key={c.key} className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={!!pdfColumns[c.key]}
                        onChange={(e) => setPdfColumns((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">
                  Tip: Use landscape orientation when including many columns.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    id="repeat-header"
                    type="checkbox"
                    checked={repeatHeaderEachPage}
                    onChange={(e) => setRepeatHeaderEachPage(e.target.checked)}
                  />
                  <label htmlFor="repeat-header" className="text-sm">Repeat header on each page</label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="group-header"
                    type="checkbox"
                    checked={groupHeaderEachSection}
                    onChange={(e) => setGroupHeaderEachSection(e.target.checked)}
                  />
                  <label htmlFor="group-header" className="text-sm">Show header under each group title</label>
                </div>

                <div className="space-y-1">
                  <div className="text-sm font-medium text-slate-700 dark:text-gray-300">Column widths</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      { key: "image", label: "Image" },
                      { key: "product", label: "Product" },
                      { key: "styleNumber", label: "Style #" },
                      { key: "colour", label: "Colour" },
                      { key: "gender", label: "Gender" },
                      { key: "size", label: "Size" },
                      { key: "quantity", label: "Qty Req." },
                      { key: "fulfilled", label: "Qty Fulfilled" },
                      { key: "notes", label: "Notes" },
                    ].map((c) => (
                      <label key={c.key} className="flex items-center justify-between gap-2">
                        <span>{c.label}</span>
                        <input
                          type="number"
                          min="0.4"
                          step="0.1"
                          className="h-8 w-20 rounded border border-slate-200 bg-white px-2"
                          value={columnFlex[c.key] ?? ""}
                          onChange={(e) =>
                            setColumnFlex((prev) => ({ ...prev, [c.key]: parseFloat(e.target.value || "0") || 0 }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">Values are relative widths (flex). Increase Product/Notes if they wrap.</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="include-images"
                  checked={includeImages}
                  onChange={(e) => setIncludeImages(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
                <label htmlFor="include-images" className="text-sm text-slate-700 dark:text-gray-300">
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
                  className="h-4 w-4 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
                <label htmlFor="include-notes-csv" className="text-sm text-slate-700 dark:text-gray-300">
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
                    className="h-4 w-4 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                  />
                  <label htmlFor="flatten-sizes" className="text-sm text-slate-700 dark:text-gray-300">
                    Create one row per size
                  </label>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400">
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
