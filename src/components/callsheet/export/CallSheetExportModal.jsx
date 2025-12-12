// src/components/callsheet/export/CallSheetExportModal.jsx
// Modal for exporting call sheet to PDF

import React, { useState, useCallback, useMemo, lazy, Suspense } from "react";
import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { X, Download, FileText, Loader2, Eye, Clock, Users, MapPin, Package } from "lucide-react";
import { Button } from "../../ui/button";
import { minutesToTime12h, calculateEndTime, formatDuration } from "../../../lib/timeUtils";
import {
  CUSTOM_ENTRY_CATEGORY_LABELS,
  CUSTOM_ENTRY_CATEGORY_COLORS,
} from "../../../types/schedule";

// Lazy load preview component
const PdfPagePreview = lazy(() => import("../../export/PdfPagePreview"));

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
  },
  header: {
    marginBottom: 20,
    borderBottom: "2pt solid #1e293b",
    paddingBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#64748b",
  },
  trackSection: {
    marginBottom: 16,
  },
  trackHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: "1pt solid #e2e8f0",
  },
  trackDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  trackName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#334155",
  },
  entryRow: {
    flexDirection: "row",
    borderBottom: "0.5pt solid #f1f5f9",
    paddingVertical: 6,
  },
  timeCol: {
    width: 70,
    paddingRight: 8,
  },
  timeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
  },
  timeEndText: {
    fontSize: 8,
    color: "#94a3b8",
  },
  durationCol: {
    width: 50,
    paddingRight: 8,
  },
  durationText: {
    fontSize: 9,
    color: "#64748b",
  },
  titleCol: {
    flex: 1,
    paddingRight: 8,
  },
  titleText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#1e293b",
  },
  categoryBadge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 2,
    marginBottom: 2,
  },
  notesText: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 2,
  },
  detailsCol: {
    width: 150,
  },
  detailRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  detailLabel: {
    fontSize: 7,
    color: "#94a3b8",
    width: 45,
  },
  detailValue: {
    fontSize: 8,
    color: "#475569",
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94a3b8",
  },
  emptyState: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 40,
  },
});

/**
 * PDF Document component for call sheet
 */
const CallSheetPdfDocument = ({ schedule, entries, tracks }) => {
  // Group entries by track
  const entriesByTrack = useMemo(() => {
    const grouped = new Map();
    tracks.forEach((track) => grouped.set(track.id, []));
    entries.forEach((entry) => {
      const trackEntries = grouped.get(entry.trackId) || [];
      trackEntries.push(entry);
      grouped.set(entry.trackId, trackEntries);
    });
    // Sort by start time within each track
    grouped.forEach((trackEntries) => {
      trackEntries.sort((a, b) => a.startTime.localeCompare(b.startTime));
    });
    return grouped;
  }, [entries, tracks]);

  const formatDate = (date) => {
    if (!date) return "";
    const d = date.toDate ? date.toDate() : new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{schedule?.name || "Call Sheet"}</Text>
          <Text style={styles.subtitle}>{formatDate(schedule?.date)}</Text>
        </View>

        {/* Tracks and Entries */}
        {tracks.map((track) => {
          const trackEntries = entriesByTrack.get(track.id) || [];
          if (trackEntries.length === 0) return null;

          return (
            <View key={track.id} style={styles.trackSection} wrap={false}>
              {/* Track Header */}
              <View style={styles.trackHeader}>
                <View style={[styles.trackDot, { backgroundColor: track.color }]} />
                <Text style={styles.trackName}>{track.name}</Text>
              </View>

              {/* Entries */}
              {trackEntries.map((entry) => {
                const isCustom = entry.type === "custom";
                const category = entry.customData?.category;
                const categoryColor = category
                  ? CUSTOM_ENTRY_CATEGORY_COLORS[category]
                  : null;

                return (
                  <View key={entry.id} style={styles.entryRow} wrap={false}>
                    {/* Time */}
                    <View style={styles.timeCol}>
                      <Text style={styles.timeText}>
                        {minutesToTime12h(entry.startTime)}
                      </Text>
                      <Text style={styles.timeEndText}>
                        → {minutesToTime12h(calculateEndTime(entry.startTime, entry.duration))}
                      </Text>
                    </View>

                    {/* Duration */}
                    <View style={styles.durationCol}>
                      <Text style={styles.durationText}>
                        {formatDuration(entry.duration)}
                      </Text>
                    </View>

                    {/* Title/Description */}
                    <View style={styles.titleCol}>
                      {isCustom && category && (
                        <Text
                          style={[
                            styles.categoryBadge,
                            {
                              backgroundColor: categoryColor ? `${categoryColor}20` : "#f1f5f9",
                              color: categoryColor || "#64748b",
                            },
                          ]}
                        >
                          {CUSTOM_ENTRY_CATEGORY_LABELS[category]}
                        </Text>
                      )}
                      <Text style={styles.titleText}>
                        {entry.resolvedTitle || "Untitled"}
                      </Text>
                      {entry.resolvedNotes && (
                        <Text style={styles.notesText}>
                          {entry.resolvedNotes}
                        </Text>
                      )}
                    </View>

                    {/* Details */}
                    <View style={styles.detailsCol}>
                      {entry.resolvedTalent?.length > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Talent:</Text>
                          <Text style={styles.detailValue}>
                            {entry.resolvedTalent.join(", ")}
                          </Text>
                        </View>
                      )}
                      {entry.resolvedProducts?.length > 0 && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Products:</Text>
                          <Text style={styles.detailValue}>
                            {entry.resolvedProducts.join(", ")}
                          </Text>
                        </View>
                      )}
                      {entry.resolvedLocation && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Location:</Text>
                          <Text style={styles.detailValue}>
                            {entry.resolvedLocation}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Empty state */}
        {entries.length === 0 && (
          <Text style={styles.emptyState}>No entries in schedule</Text>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Generated {new Date().toLocaleDateString()}</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

/**
 * CallSheetExportModal - Modal for exporting call sheet
 */
function CallSheetExportModal({
  isOpen,
  onClose,
  schedule,
  entries = [],
  tracks = [],
}) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Generate PDF blob
  const generatePdf = useCallback(async () => {
    setIsGenerating(true);
    try {
      const doc = <CallSheetPdfDocument schedule={schedule} entries={entries} tracks={tracks} />;
      const blob = await pdf(doc).toBlob();
      return blob;
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [schedule, entries, tracks]);

  // Handle download
  const handleDownload = useCallback(async () => {
    try {
      const blob = await generatePdf();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${schedule?.name || "call-sheet"}-${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onClose();
    } catch (error) {
      console.error("Download failed:", error);
    }
  }, [generatePdf, schedule?.name, onClose]);

  // Handle preview toggle
  const handlePreviewToggle = useCallback(async () => {
    if (showPreview) {
      setShowPreview(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
    } else {
      try {
        const blob = await generatePdf();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setShowPreview(true);
      } catch (error) {
        console.error("Preview failed:", error);
      }
    }
  }, [showPreview, previewUrl, generatePdf]);

  // Cleanup on close
  React.useEffect(() => {
    if (!isOpen && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setShowPreview(false);
    }
  }, [isOpen, previewUrl]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className={`relative flex max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900 ${
          showPreview ? "w-full max-w-4xl" : "w-full max-w-md"
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id="export-modal-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Export Call Sheet
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Options panel */}
          <div className={`flex-shrink-0 p-4 ${showPreview ? "w-64 border-r border-slate-200 dark:border-slate-700" : "w-full"}`}>
            {/* Summary */}
            <div className="mb-6 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <h3 className="mb-2 font-medium text-slate-900 dark:text-slate-100">
                {schedule?.name || "Call Sheet"}
              </h3>
              <div className="space-y-1 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  {entries.length} entries
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  {tracks.length} tracks
                </div>
              </div>
            </div>

            {/* Export info */}
            <div className="mb-6">
              <p className="text-sm text-slate-500">
                Export includes all schedule entries organized by track with times, descriptions, talent, products, and locations.
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleDownload}
                disabled={isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Download PDF
              </Button>

              <Button
                variant="outline"
                onClick={handlePreviewToggle}
                disabled={isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
                {showPreview ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-800">
              {previewUrl ? (
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  }
                >
                  <PdfPagePreview
                    url={previewUrl}
                    className="mx-auto rounded-lg shadow-lg"
                  />
                </Suspense>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallSheetExportModal;
