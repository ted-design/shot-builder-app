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
import { X, Download, Loader2, Eye, Clock, Users, Printer } from "lucide-react";
import { Button } from "../../ui/button";
import { minutesToTime12h, formatDuration, parseTimeToMinutes } from "../../../lib/timeUtils";
import {
  CUSTOM_ENTRY_CATEGORY_LABELS,
  CUSTOM_ENTRY_CATEGORY_COLORS,
  DEFAULT_COLUMNS,
} from "../../../types/schedule";

// Lazy load preview component
const PdfPagePreview = lazy(() => import("../../export/PdfPagePreview"));

// PDF Styles
const styles = StyleSheet.create({
  page: {
    padding: 24,
    fontFamily: "Helvetica",
    fontSize: 9,
    color: "#0f172a",
  },
  header: {
    marginBottom: 16,
    borderBottom: "2pt solid #334155",
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#0f172a",
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 10,
    color: "#64748b",
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 2,
    borderBottomColor: "#94a3b8",
  },
  cell: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    justifyContent: "center",
  },
  cellBorderRight: {
    borderRightWidth: 1,
    borderRightColor: "#e2e8f0",
  },
  headerCellText: {
    fontSize: 8,
    fontWeight: "bold",
    textTransform: "uppercase",
    color: "#334155",
  },
  timePrimary: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  timeSecondary: {
    fontSize: 7,
    color: "#64748b",
    marginTop: 1,
  },
  entryTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#0f172a",
  },
  entryMeta: {
    fontSize: 7,
    color: "#475569",
    marginTop: 1,
  },
  badge: {
    fontSize: 7,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
    marginBottom: 3,
    alignSelf: "flex-start",
  },
  emptyState: {
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 12,
    marginTop: 40,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 32,
    right: 32,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#94a3b8",
  },
});

const PDF_FLEX_WEIGHTS = {
  xs: 0.9,
  sm: 1.15,
  md: 1.5,
  lg: 2.0,
  xl: 3.0,
};

function getFlexWeight(widthPreset) {
  if (!widthPreset || typeof widthPreset !== "string") return PDF_FLEX_WEIGHTS.md;
  return PDF_FLEX_WEIGHTS[widthPreset] || PDF_FLEX_WEIGHTS.md;
}

function normalizeList(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (typeof item === "string" ? item : item?.name || item?.familyName || item?.label))
    .filter(Boolean);
}

function formatTimeCell(entry) {
  const startMinutes = parseTimeToMinutes(entry.startTime);
  const duration = typeof entry.duration === "number" ? Math.max(0, entry.duration) : 0;
  const endMinutes = startMinutes + duration;
  const start = minutesToTime12h(startMinutes);
  const end = minutesToTime12h(endMinutes);
  return { start, end, duration };
}

function getEffectiveColumns(schedule) {
  const configured = Array.isArray(schedule?.columnConfig) ? schedule.columnConfig : null;
  return configured && configured.length > 0 ? configured : DEFAULT_COLUMNS;
}

function getVisiblePreviewColumns(columns) {
  const visible = (Array.isArray(columns) ? columns : [])
    .filter((col) => col.visible !== false && col.width !== "hidden")
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  return visible.filter((col) => col.key !== "duration");
}

function buildActiveLaneTracks(tracks, sortedEntries) {
  const orderedTracks = [...(tracks || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const sharedTrackIdsBase = new Set(
    orderedTracks
      .filter((track) => track.scope === "shared" || track.id === "shared")
      .map((track) => track.id)
  );

  const legacySharedLaneTrackIds = new Set();
  sortedEntries.forEach((entry) => {
    if (entry.type !== "shot") return;
    if (sharedTrackIdsBase.has(entry.trackId)) legacySharedLaneTrackIds.add(entry.trackId);
  });

  const sharedTrackIds = new Set(sharedTrackIdsBase);
  legacySharedLaneTrackIds.forEach((id) => sharedTrackIds.delete(id));

  const laneCandidateTracks = orderedTracks.filter((track) => !sharedTrackIds.has(track.id));
  const sharedEntries = sortedEntries.filter((entry) => entry.type === "custom" && sharedTrackIds.has(entry.trackId));

  const activeLaneTrackIds = new Set();
  sortedEntries.forEach((entry) => {
    if (sharedTrackIds.has(entry.trackId)) return;
    activeLaneTrackIds.add(entry.trackId);
  });
  sharedEntries.forEach((entry) => {
    if (!Array.isArray(entry.appliesToTrackIds) || entry.appliesToTrackIds.length === 0) return;
    entry.appliesToTrackIds.forEach((trackId) => activeLaneTrackIds.add(trackId));
  });
  if (activeLaneTrackIds.size === 0 && sharedEntries.length > 0 && laneCandidateTracks.length > 0) {
    activeLaneTrackIds.add(laneCandidateTracks[0].id);
  }

  const laneTracks = laneCandidateTracks.filter((track) => activeLaneTrackIds.has(track.id));
  return { laneTracks, sharedTrackIds, sharedEntries };
}

function renderSingleTrackCell(entry, columnKey) {
  const isShot = entry.type === "shot";
  const isCustom = entry.type === "custom";

  if (columnKey === "time") {
    const { start, end, duration } = formatTimeCell(entry);
    return (
      <View>
        <Text style={styles.timePrimary}>
          {start}–{end}
        </Text>
        {duration ? <Text style={styles.timeSecondary}>{formatDuration(duration)}</Text> : null}
      </View>
    );
  }

  if (columnKey === "shot") {
    return <Text>{isShot ? entry.shotNumber || "—" : "—"}</Text>;
  }

  if (columnKey === "description") {
    const category = entry.customData?.category;
    const badgeColor = category ? CUSTOM_ENTRY_CATEGORY_COLORS[category] : null;
    const badgeLabel = category ? CUSTOM_ENTRY_CATEGORY_LABELS[category] : null;
    const title = entry.resolvedTitle || entry.title || "—";
    const details = entry.resolvedDetails || entry.description || "";
    return (
      <View>
        {isCustom && badgeLabel ? (
          <Text
            style={[
              styles.badge,
              {
                backgroundColor: badgeColor ? `${badgeColor}20` : "#e2e8f0",
                color: badgeColor || "#475569",
              },
            ]}
          >
            {badgeLabel}
          </Text>
        ) : null}
        <Text style={styles.entryTitle}>{title}</Text>
        {details ? <Text style={styles.entryMeta}>{details}</Text> : null}
      </View>
    );
  }

  if (columnKey === "talent") {
    const names = normalizeList(entry.resolvedTalent);
    return <Text>{names.length ? names.join(", ") : "—"}</Text>;
  }

  if (columnKey === "products") {
    const names = normalizeList(entry.resolvedProducts);
    return <Text>{names.length ? names.join(", ") : "—"}</Text>;
  }

  if (columnKey === "location") {
    return <Text>{entry.resolvedLocation || "—"}</Text>;
  }

  if (columnKey === "notes") {
    return <Text>{entry.resolvedNotes || "—"}</Text>;
  }

  return <Text>—</Text>;
}

function renderEntryBlocks(entries, trackColor) {
  if (!Array.isArray(entries) || entries.length === 0) return null;
  return (
    <View>
      {entries.map((entry, index) => {
        const isCustom = entry.type === "custom";
        const category = entry.customData?.category;
        const badgeColor = category ? CUSTOM_ENTRY_CATEGORY_COLORS[category] : null;
        const badgeLabel = category ? CUSTOM_ENTRY_CATEGORY_LABELS[category] : null;
        const title = entry.resolvedTitle || entry.title || "—";
        const details = entry.resolvedDetails || entry.description || "";
        const shotNumber = entry.shotNumber ? String(entry.shotNumber) : "";
        const talent = normalizeList(entry.resolvedTalent);
        const products = normalizeList(entry.resolvedProducts);
        const location = entry.resolvedLocation ? String(entry.resolvedLocation) : "";
        const notes = entry.resolvedNotes ? String(entry.resolvedNotes) : "";
        const duration = typeof entry.duration === "number" ? Math.max(0, entry.duration) : 0;
        const durationLabel = duration ? formatDuration(duration) : null;

        return (
          <View
            key={entry.id}
            style={{
              borderWidth: 1,
              borderColor: isCustom ? (badgeColor || "#94a3b8") : trackColor || "#94a3b8",
              borderRadius: 6,
              paddingVertical: 6,
              paddingHorizontal: 6,
              marginBottom: index === entries.length - 1 ? 0 : 6,
              backgroundColor: isCustom
                ? badgeColor
                  ? `${badgeColor}14`
                  : "#f1f5f9"
                : trackColor
                ? `${trackColor}10`
                : "#f8fafc",
            }}
          >
            {isCustom && badgeLabel ? (
              <Text
                style={[
                  styles.badge,
                  {
                    backgroundColor: badgeColor ? `${badgeColor}20` : "#e2e8f0",
                    color: badgeColor || "#475569",
                  },
                ]}
              >
                {badgeLabel}
              </Text>
            ) : null}
            <Text style={styles.entryTitle}>
              {shotNumber ? `${shotNumber} • ` : ""}
              {title}
            </Text>
            {details ? <Text style={styles.entryMeta}>{details}</Text> : null}
            {durationLabel ? <Text style={styles.entryMeta}>{durationLabel}</Text> : null}
            {talent.length ? <Text style={styles.entryMeta}>Talent: {talent.slice(0, 5).join(", ")}</Text> : null}
            {products.length ? <Text style={styles.entryMeta}>Products: {products.slice(0, 4).join(", ")}</Text> : null}
            {location ? <Text style={styles.entryMeta}>Location: {location}</Text> : null}
            {notes ? <Text style={styles.entryMeta}>Notes: {notes.slice(0, 160)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

/**
 * PDF Document component for call sheet
 */
const CallSheetPdfDocument = ({ schedule, entries, tracks }) => {
  const sortedEntries = useMemo(() => {
    return [...(entries || [])].sort((a, b) => {
      const am = parseTimeToMinutes(a.startTime);
      const bm = parseTimeToMinutes(b.startTime);
      if (am !== bm) return am - bm;
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [entries]);

  const columns = useMemo(() => getEffectiveColumns(schedule), [schedule]);
  const previewColumns = useMemo(() => getVisiblePreviewColumns(columns), [columns]);

  const { laneTracks, sharedEntries, sharedTrackIds } = useMemo(() => {
    return buildActiveLaneTracks(tracks, sortedEntries);
  }, [tracks, sortedEntries]);

  const isMultiTrack = laneTracks.length > 1;

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

  const timeSlots = useMemo(() => {
    const byTime = new Map();
    const entriesForSlots = isMultiTrack
      ? sortedEntries.filter((entry) => !(entry.type === "custom" && sharedTrackIds.has(entry.trackId)))
      : sortedEntries;

    entriesForSlots.forEach((entry) => {
      const minutes = parseTimeToMinutes(entry.startTime);
      const perTrack = byTime.get(minutes) || new Map();
      const list = perTrack.get(entry.trackId) || [];
      list.push(entry);
      perTrack.set(entry.trackId, list);
      byTime.set(minutes, perTrack);
    });

    if (isMultiTrack) {
      sharedEntries.forEach((entry) => {
        const minutes = parseTimeToMinutes(entry.startTime);
        if (!byTime.has(minutes)) byTime.set(minutes, new Map());
      });
    }

    return Array.from(byTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([minutes, perTrack]) => {
        const sortedPerTrack = new Map();
        for (const [trackId, list] of perTrack.entries()) {
          sortedPerTrack.set(trackId, [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
        }
        return { minutes, perTrack: sortedPerTrack };
      });
  }, [sortedEntries, isMultiTrack, sharedEntries, sharedTrackIds]);

  const scheduleTitle = schedule?.name || "Schedule";
  const scheduleSubtitle = formatDate(schedule?.date);

  return (
    <Document>
      <Page size="LETTER" orientation={isMultiTrack ? "landscape" : "portrait"} style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>{scheduleTitle}</Text>
          <Text style={styles.subtitle}>{scheduleSubtitle}</Text>
        </View>

        {sortedEntries.length === 0 ? (
          <Text style={styles.emptyState}>No entries in schedule</Text>
        ) : (
          <View style={styles.table}>
            {isMultiTrack ? (
              <>
                <View style={styles.headerRow}>
                  <View style={[styles.cell, styles.cellBorderRight, { width: 90 }]}>
                    <Text style={styles.headerCellText}>Time</Text>
                  </View>
                  {laneTracks.map((track, index) => (
                    <View
                      key={track.id}
                      style={[
                        styles.cell,
                        index < laneTracks.length - 1 ? styles.cellBorderRight : null,
                        { flexGrow: 1, flexBasis: 0 },
                      ]}
                    >
                      <Text style={styles.headerCellText}>{track.name}</Text>
                    </View>
                  ))}
                </View>

                {timeSlots.map((slot) => {
                  const sharedAtTime = sharedEntries.filter(
                    (entry) => parseTimeToMinutes(entry.startTime) === slot.minutes
                  );

                  return (
                    <View key={slot.minutes} wrap={false}>
                      <View style={styles.row}>
                        <View style={[styles.cell, styles.cellBorderRight, { width: 90 }]}>
                          <Text style={styles.timePrimary}>{minutesToTime12h(slot.minutes)}</Text>
                        </View>
                        {laneTracks.map((track, index) => (
                          <View
                            key={`${slot.minutes}-${track.id}`}
                            style={[
                              styles.cell,
                              index < laneTracks.length - 1 ? styles.cellBorderRight : null,
                              { flexGrow: 1, flexBasis: 0 },
                            ]}
                          >
                            {renderEntryBlocks(slot.perTrack.get(track.id), track.color)}
                          </View>
                        ))}
                      </View>

                      {sharedAtTime.length ? (
                        <View style={styles.row}>
                          <View style={[styles.cell, styles.cellBorderRight, { width: 90 }]} />
                          <View style={[styles.cell, { flexGrow: 1, flexBasis: 0 }]}>
                            {renderEntryBlocks(sharedAtTime, "#64748B")}
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </>
            ) : (
              <>
                <View style={styles.headerRow}>
                  {previewColumns.map((col, idx) => {
                    const widthPreset = col.width || "md";
                    const cellStyle = [
                      styles.cell,
                      idx < previewColumns.length - 1 ? styles.cellBorderRight : null,
                      col.key === "time"
                        ? { width: 84, flexShrink: 0 }
                        : { flexGrow: getFlexWeight(widthPreset), flexBasis: 0, flexShrink: 1 },
                    ];
                    return (
                      <View key={col.key} style={cellStyle}>
                        <Text style={styles.headerCellText}>{col.label}</Text>
                      </View>
                    );
                  })}
                </View>

                {sortedEntries.map((entry) => (
                  <View key={entry.id} style={styles.row} wrap={false}>
                    {previewColumns.map((col, idx) => {
                      const widthPreset = col.width || "md";
                      const cellStyle = [
                        styles.cell,
                        idx < previewColumns.length - 1 ? styles.cellBorderRight : null,
                        col.key === "time"
                          ? { width: 84, flexShrink: 0 }
                          : { flexGrow: getFlexWeight(widthPreset), flexBasis: 0, flexShrink: 1 },
                      ];
                      return (
                        <View key={`${entry.id}-${col.key}`} style={cellStyle}>
                          {renderSingleTrackCell(entry, col.key)}
                        </View>
                      );
                    })}
                  </View>
                ))}
              </>
            )}
          </View>
        )}

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
  const pdfDocument = useMemo(() => {
    return <CallSheetPdfDocument schedule={schedule} entries={entries} tracks={tracks} />;
  }, [schedule, entries, tracks]);

  // Generate PDF blob
  const generatePdf = useCallback(async () => {
    setIsGenerating(true);
    try {
      const blob = await pdf(pdfDocument).toBlob();
      return blob;
    } catch (error) {
      console.error("Error generating PDF:", error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, [pdfDocument]);

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

  const handlePrintPreview = useCallback(() => {
    const body = document?.body;
    if (!body) return;

    const cleanup = () => {
      body.removeAttribute("data-callsheet-printing");
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    body.setAttribute("data-callsheet-printing", "1");
    onClose?.();
    window.setTimeout(() => window.print(), 50);
  }, [onClose]);

  // Handle preview toggle
  const handlePreviewToggle = useCallback(() => {
    setShowPreview((prev) => !prev);
  }, []);

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
                onClick={handlePrintPreview}
                disabled={isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4" />
                )}
                Print to PDF (full formatting)
              </Button>

              <div className="space-y-1">
                <Button
                  variant="outline"
                  onClick={handleDownload}
                  disabled={isGenerating}
                  className="w-full gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download PDF (simple)
                </Button>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Simple PDF does not include inline rich text formatting (colors, links, and selection-based styling).
                </p>
              </div>

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
                {showPreview ? "Hide PDF Preview" : "Show PDF Preview"}
              </Button>
            </div>
          </div>

          {/* Preview panel */}
          {showPreview && (
            <div className="flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-800">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                }
              >
                <PdfPagePreview document={pdfDocument} className="mx-auto rounded-lg shadow-lg" />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CallSheetExportModal;
