import React, { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ProjectPDF, mockProject } from "../lib/pdfTemplates";
import { Modal } from "./ui/modal";
import { Card, CardHeader, CardContent } from "./ui/card";
import { Button } from "./ui/button";

export default function PDFExportModal() {
  const [open, setOpen] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleDownload = async () => {
    setError("");
    setDownloading(true);
    try {
      const blob = await pdf(<ProjectPDF project={mockProject} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "demo.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Failed to generate PDF");
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => setOpen(false)}
      labelledBy="pdf-export-title"
      contentClassName="max-w-md"
    >
      <Card className="border-0 shadow-none">
        <CardHeader className="flex items-center justify-between">
          <h2 id="pdf-export-title" className="text-lg font-semibold">
            Demo PDF Export
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-slate-600">
            Download a sample pull sheet to validate the PDF rendering pipeline. Replace the mock
            data with real pulls when the export feature goes live.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDownload} disabled={downloading}>
              {downloading ? "Preparing…" : "Download PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
