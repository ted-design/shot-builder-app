import React, { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { ProjectPDF, mockProject } from "../lib/pdfTemplates";

export default function PDFExportModal() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

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
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 60,
        background: "#111827",
        color: "#fff",
        padding: "10px 12px",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
      }}
    >
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        style={{
          padding: "6px 10px",
          background: downloading ? "#6b7280" : "#10b981",
          color: "#111827",
          borderRadius: 6,
          fontWeight: 600,
        }}
      >
        {downloading ? "Preparing…" : "Download PDF"}
      </button>
      {error && (
        <span style={{ marginLeft: 8, color: "#fecaca" }}>
          {error}
        </span>
      )}
    </div>
  );
}
