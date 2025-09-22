import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  pdf,
} from "@react-pdf/renderer";
import { Modal } from "../ui/modal";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { toast } from "../../lib/toast";

const styles = StyleSheet.create({
  page: {
    padding: 32,
    fontSize: 11,
    fontFamily: "Helvetica",
    color: "#1f2937",
    lineHeight: 1.4,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#475569",
  },
  summarySection: {
    marginBottom: 16,
  },
  summaryHeading: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
    paddingVertical: 4,
  },
  tableHeader: {
    fontSize: 10,
    fontWeight: 600,
    color: "#475569",
  },
  tableCell: {
    fontSize: 10,
    color: "#1f2937",
  },
  laneSection: {
    marginBottom: 18,
  },
  laneHeading: {
    fontSize: 14,
    fontWeight: 600,
    marginBottom: 6,
  },
  shotCard: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderStyle: "solid",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  shotHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  shotTitle: {
    fontSize: 12,
    fontWeight: 600,
    color: "#111827",
    marginRight: 8,
  },
  shotMeta: {
    fontSize: 10,
    color: "#475569",
  },
  shotDetails: {
    fontSize: 10,
    color: "#1f2937",
    marginTop: 4,
  },
  shotImage: {
    width: 96,
    height: 72,
    objectFit: "cover",
    borderRadius: 4,
    marginBottom: 6,
  },
});

const fieldOptions = [
  { key: "name", label: "Shot title" },
  { key: "type", label: "Shot type" },
  { key: "date", label: "Date" },
  { key: "location", label: "Location" },
  { key: "talent", label: "Talent" },
  { key: "products", label: "Products" },
  { key: "notes", label: "Notes" },
  { key: "image", label: "Image" },
];

const UNASSIGNED_TALENT_FILTER_VALUE = "__planner_unassigned__";

const PlannerPdfDocument = ({ lanes, laneSummary, talentSummary, options }) => {
  const orientation = options.orientation === "landscape" ? "landscape" : "portrait";
  const visibleFields = options.fields || {};
  const showLaneSummary = options.includeLaneSummary && laneSummary?.lanes?.length;
  const showTalentSummary = options.includeTalentSummary && talentSummary?.rows?.length;
  const talentLanes = Array.isArray(talentSummary?.lanes) ? talentSummary.lanes : [];
  const talentRows = Array.isArray(talentSummary?.rows) ? talentSummary.rows : [];
  const exportLanes = Array.isArray(lanes) ? lanes : [];

  const renderSummaryTable = (headers, rows) => (
    <View style={styles.summarySection} wrap={false}>
      <View style={[styles.tableRow, { borderBottomWidth: 2 }]}>
        {headers.map((header, index) => (
          <View key={header.key || index} style={{ flex: header.flex || 1 }}>
            <Text style={styles.tableHeader}>{header.label}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, rowIndex) => (
        <View key={row.key || rowIndex} style={styles.tableRow}>
          {headers.map((header, index) => (
            <View key={header.key || index} style={{ flex: header.flex || 1 }}>
              <Text style={styles.tableCell}>{row[header.key]}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );

  return (
    <Document>
      <Page size="A4" orientation={orientation} style={styles.page}>
        <View style={styles.header} wrap={false}>
          {options.title ? <Text style={styles.title}>{options.title}</Text> : null}
          {options.subtitle ? <Text style={styles.subtitle}>{options.subtitle}</Text> : null}
        </View>
        {showLaneSummary
          ? renderSummaryTable(
              [
                { key: "name", label: "Lane", flex: 2 },
                { key: "shots", label: "Shots", flex: 1 },
              ],
              laneSummary.lanes.map((lane) => ({
                key: lane.id,
                name: lane.name,
                shots: String(lane.shotCount ?? 0),
              }))
            )
          : null}
        {showTalentSummary
          ? renderSummaryTable(
              [
                { key: "name", label: "Talent", flex: 2 },
                { key: "total", label: "Total", flex: 1 },
                ...talentLanes.map((lane) => ({
                  key: lane.id,
                  label: lane.name,
                  flex: 1,
                })),
              ],
              talentRows.map((row) => ({
                key: row.id,
                name: row.name,
                total: String(row.total ?? 0),
                ...Object.fromEntries(
                  talentLanes.map((lane) => [lane.id, String(row.byLane?.[lane.id] ?? 0)])
                ),
              }))
            )
          : null}
        {exportLanes.map((lane) => (
          <View key={lane.id} style={styles.laneSection}>
            <Text style={styles.laneHeading}>
              {lane.name} ({lane.shots.length} shots)
            </Text>
            {lane.shots.length === 0 ? (
              <Text style={styles.tableCell}>No shots in this lane.</Text>
            ) : (
              lane.shots.map((shot) => (
                <View key={shot.id} style={styles.shotCard} wrap={false}>
                  {visibleFields.image && shot.image ? (
                    <Image src={shot.image} style={styles.shotImage} />
                  ) : null}
                  <View style={styles.shotHeader}>
                    {visibleFields.name ? (
                      <Text style={styles.shotTitle}>{shot.name}</Text>
                    ) : null}
                    <Text style={styles.shotMeta}>{lane.name}</Text>
                  </View>
                  {visibleFields.type || visibleFields.date ? (
                    <Text style={styles.shotMeta}>
                      {visibleFields.type && shot.type ? `Type: ${shot.type}` : ""}
                      {visibleFields.type && visibleFields.date && shot.type && shot.date ? "  •  " : ""}
                      {visibleFields.date && shot.date ? `Date: ${shot.date}` : ""}
                    </Text>
                  ) : null}
                  {visibleFields.location && shot.location ? (
                    <Text style={styles.shotDetails}>Location: {shot.location}</Text>
                  ) : null}
                  {visibleFields.talent && shot.talent.length ? (
                    <Text style={styles.shotDetails}>Talent: {shot.talent.join(", ")}</Text>
                  ) : null}
                  {visibleFields.products && shot.products.length ? (
                    <Text style={styles.shotDetails}>Products: {shot.products.join(", ")}</Text>
                  ) : null}
                  {visibleFields.notes && shot.notes ? (
                    <Text style={styles.shotDetails}>{shot.notes}</Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        ))}
      </Page>
    </Document>
  );
};

const escapeCsv = (value) => {
  if (value == null) return "";
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

const PlannerExportModal = ({ open, onClose, lanes, defaultVisibleFields, isLoading }) => {
  const [title, setTitle] = useState("Planner export");
  const [subtitle, setSubtitle] = useState("");
  const [orientation, setOrientation] = useState("portrait");
  const [fields, setFields] = useState({});
  const [includeLaneSummary, setIncludeLaneSummary] = useState(true);
  const [includeTalentSummary, setIncludeTalentSummary] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [laneFilterMode, setLaneFilterMode] = useState("all");
  const [selectedLaneIds, setSelectedLaneIds] = useState([]);
  const [selectedTalentNames, setSelectedTalentNames] = useState([]);
  const [dateFilterMode, setDateFilterMode] = useState("any");
  const [selectedDate, setSelectedDate] = useState("");

  const laneOptions = useMemo(() => {
    if (!Array.isArray(lanes)) return [];
    return lanes.map((lane) => ({
      id: lane.id,
      name: lane.name || "Untitled lane",
    }));
  }, [lanes]);

  const talentOptions = useMemo(() => {
    const collected = new Map();
    let hasUnassigned = false;
    if (Array.isArray(lanes)) {
      lanes.forEach((lane) => {
        const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
        laneShots.forEach((shot) => {
          const talents = Array.isArray(shot.talent) ? shot.talent : [];
          const trimmed = talents.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean);
          if (!trimmed.length) {
            hasUnassigned = true;
            return;
          }
          trimmed.forEach((name) => {
            if (!collected.has(name)) {
              collected.set(name, { value: name, label: name });
            }
          });
        });
      });
    }
    const entries = Array.from(collected.values()).sort((a, b) => a.label.localeCompare(b.label));
    if (hasUnassigned) {
      entries.push({ value: UNASSIGNED_TALENT_FILTER_VALUE, label: "Unassigned" });
    }
    return entries;
  }, [lanes]);

  const availableDates = useMemo(() => {
    const values = new Set();
    if (Array.isArray(lanes)) {
      lanes.forEach((lane) => {
        const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
        laneShots.forEach((shot) => {
          if (shot?.date) {
            values.add(shot.date);
          }
        });
      });
    }
    return Array.from(values).sort();
  }, [lanes]);

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setTitle("Planner export");
    setSubtitle(`Generated ${now.toLocaleString()}`);
    setOrientation("portrait");
    setIncludeLaneSummary(true);
    setIncludeTalentSummary(true);
    setLaneFilterMode("all");
    setSelectedLaneIds(laneOptions.map((lane) => lane.id));
    setSelectedTalentNames([]);
    setDateFilterMode("any");
    setSelectedDate("");
    setFields({
      name: true,
      type: true,
      date: true,
      location: defaultVisibleFields?.location ?? true,
      talent: defaultVisibleFields?.talent ?? true,
      products: defaultVisibleFields?.products ?? true,
      notes: defaultVisibleFields?.notes ?? true,
      image: false,
    });
  }, [open, defaultVisibleFields, laneOptions]);

  const selectedLaneIdSet = useMemo(() => new Set(selectedLaneIds), [selectedLaneIds]);

  const filteredLanes = useMemo(() => {
    if (!Array.isArray(lanes)) return [];
    const limitToSelected = laneFilterMode === "selected";
    const includeUnassigned = selectedTalentNames.includes(UNASSIGNED_TALENT_FILTER_VALUE);
    const explicitTalent = selectedTalentNames.filter((value) => value !== UNASSIGNED_TALENT_FILTER_VALUE);
    const talentSet = new Set(explicitTalent);
    const hasTalentFilter = talentSet.size > 0 || includeUnassigned;
    const usingSpecificDate = dateFilterMode === "specific" && selectedDate;

    return lanes
      .filter((lane) => !limitToSelected || selectedLaneIdSet.has(lane.id))
      .map((lane) => {
        const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
        const filteredShots = laneShots.filter((shot) => {
          const shotTalent = Array.isArray(shot.talent) ? shot.talent : [];
          const trimmedTalent = shotTalent
            .map((name) => (typeof name === "string" ? name.trim() : ""))
            .filter(Boolean);

          if (hasTalentFilter) {
            const matchesExplicit = trimmedTalent.some((name) => talentSet.has(name));
            const matchesUnassigned = includeUnassigned && trimmedTalent.length === 0;
            if (!matchesExplicit && !matchesUnassigned) {
              return false;
            }
          }

          if (usingSpecificDate && shot.date !== selectedDate) {
            return false;
          }

          return true;
        });

        return {
          ...lane,
          shots: filteredShots,
        };
      });
  }, [
    lanes,
    laneFilterMode,
    selectedLaneIdSet,
    selectedTalentNames,
    dateFilterMode,
    selectedDate,
  ]);

  const hasShots = useMemo(
    () =>
      Array.isArray(filteredLanes) &&
      filteredLanes.some((lane) => Array.isArray(lane.shots) && lane.shots.length > 0),
    [filteredLanes]
  );

  const derivedLaneSummary = useMemo(() => {
    const summaries = Array.isArray(filteredLanes)
      ? filteredLanes.map((lane) => ({
          id: lane.id,
          name: lane.name || "Untitled lane",
          shotCount: Array.isArray(lane.shots) ? lane.shots.length : 0,
        }))
      : [];
    const totalShots = summaries.reduce((acc, lane) => acc + lane.shotCount, 0);
    return { totalShots, lanes: summaries };
  }, [filteredLanes]);

  const derivedTalentSummary = useMemo(() => {
    const laneOrder = Array.isArray(filteredLanes) ? filteredLanes : [];
    const baseByLane = laneOrder.reduce((acc, lane) => ({ ...acc, [lane.id]: 0 }), {});
    const tally = new Map();

    const ensureTalent = (id, name) => {
      if (!tally.has(id)) {
        tally.set(id, {
          id,
          name,
          total: 0,
          byLane: { ...baseByLane },
        });
      }
      return tally.get(id);
    };

    ensureTalent(UNASSIGNED_TALENT_FILTER_VALUE, "Unassigned");

    laneOrder.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        const shotTalent = Array.isArray(shot.talent) ? shot.talent : [];
        const trimmedTalent = shotTalent
          .map((name) => (typeof name === "string" ? name.trim() : ""))
          .filter(Boolean);

        if (!trimmedTalent.length) {
          const unassigned = ensureTalent(UNASSIGNED_TALENT_FILTER_VALUE, "Unassigned");
          unassigned.total += 1;
          unassigned.byLane[lane.id] = (unassigned.byLane[lane.id] || 0) + 1;
          return;
        }

        const seen = new Set();
        trimmedTalent.forEach((name) => {
          const key = name || "Unnamed talent";
          if (seen.has(key)) return;
          seen.add(key);
          const entry = ensureTalent(key, name || "Unnamed talent");
          entry.total += 1;
          entry.byLane[lane.id] = (entry.byLane[lane.id] || 0) + 1;
        });
      });
    });

    const rows = Array.from(tally.values()).sort((a, b) => {
      if (a.id === UNASSIGNED_TALENT_FILTER_VALUE) return 1;
      if (b.id === UNASSIGNED_TALENT_FILTER_VALUE) return -1;
      if (b.total !== a.total) return b.total - a.total;
      return a.name.localeCompare(b.name);
    });

    return {
      lanes: laneOrder.map((lane) => ({ id: lane.id, name: lane.name || "Untitled lane" })),
      rows,
    };
  }, [filteredLanes]);

  const selectedOptions = useMemo(
    () => ({
      title,
      subtitle,
      orientation,
      fields,
      includeLaneSummary,
      includeTalentSummary,
    }),
    [title, subtitle, orientation, fields, includeLaneSummary, includeTalentSummary]
  );

  const handleToggleLane = useCallback((laneId) => {
    setSelectedLaneIds((previous) => {
      if (previous.includes(laneId)) {
        return previous.filter((id) => id !== laneId);
      }
      return [...previous, laneId];
    });
  }, []);

  const handleToggleTalent = useCallback((talentValue) => {
    setSelectedTalentNames((previous) => {
      if (previous.includes(talentValue)) {
        return previous.filter((value) => value !== talentValue);
      }
      return [...previous, talentValue];
    });
  }, []);

  const handleSelectAllLanes = useCallback(() => {
    setSelectedLaneIds(laneOptions.map((lane) => lane.id));
  }, [laneOptions]);

  const clearTalentFilters = useCallback(() => setSelectedTalentNames([]), []);

  const isLaneSelectionMode = laneFilterMode === "selected";

  const handleDownloadPdf = useCallback(async () => {
    if (!hasShots) {
      toast.error("No shots match your current filters.");
      return;
    }
    try {
      setIsGenerating(true);
      const blob = await pdf(
        <PlannerPdfDocument
          lanes={filteredLanes}
          laneSummary={derivedLaneSummary}
          talentSummary={derivedTalentSummary}
          options={selectedOptions}
        />
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filename = `${title || "planner-export"}.pdf`;
      link.download = filename.replace(/\s+/g, "-");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF export saved");
      onClose?.();
    } catch (error) {
      console.error("[Planner] Failed to export PDF", error);
      toast.error("Unable to generate PDF export");
    } finally {
      setIsGenerating(false);
    }
  }, [
    hasShots,
    filteredLanes,
    derivedLaneSummary,
    derivedTalentSummary,
    selectedOptions,
    title,
    onClose,
  ]);

  const handleDownloadCsv = useCallback(() => {
    if (!hasShots) {
      toast.error("No shots match your current filters.");
      return;
    }
    const headers = ["Lane"];
    if (fields.name) headers.push("Shot title");
    if (fields.type) headers.push("Shot type");
    if (fields.date) headers.push("Date");
    if (fields.location) headers.push("Location");
    if (fields.talent) headers.push("Talent");
    if (fields.products) headers.push("Products");
    if (fields.notes) headers.push("Notes");
    if (fields.image) headers.push("Image");

    const rows = [];
    filteredLanes.forEach((lane) => {
      const laneShots = Array.isArray(lane.shots) ? lane.shots : [];
      laneShots.forEach((shot) => {
        const row = [lane.name];
        if (fields.name) row.push(shot.name || "");
        if (fields.type) row.push(shot.type || "");
        if (fields.date) row.push(shot.date || "");
        if (fields.location) row.push(shot.location || "");
        if (fields.talent) row.push(shot.talent.join(", "));
        if (fields.products) row.push(shot.products.join(", "));
        if (fields.notes) row.push(shot.notes || "");
        if (fields.image) row.push(shot.image || "");
        rows.push(row.map(escapeCsv).join(","));
      });
    });

    const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const filename = `${title || "planner-export"}.csv`;
    link.download = filename.replace(/\s+/g, "-");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV export saved");
    onClose?.();
  }, [fields, hasShots, filteredLanes, title, onClose]);

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!isGenerating) onClose?.();
      }}
      labelledBy="planner-export-title"
      contentClassName="p-0"
    >
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="planner-export-title" className="text-lg font-semibold text-slate-900">
              Export planner
            </h2>
            <p className="text-sm text-slate-500">
              Configure the layout and select which planner details to include in your export.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-transparent p-2 text-slate-500 transition hover:border-slate-200 hover:text-slate-900"
            aria-label="Close export settings"
            disabled={isGenerating}
          >
            ×
          </button>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="planner-export-title-input">
                  Page title
                </label>
                <input
                  id="planner-export-title-input"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                  placeholder="Planner overview"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700" htmlFor="planner-export-subtitle-input">
                  Subtitle
                </label>
                <input
                  id="planner-export-subtitle-input"
                  type="text"
                  value={subtitle}
                  onChange={(event) => setSubtitle(event.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                  placeholder="Generated automatically"
                />
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">Page orientation</span>
                <div className="mt-2 inline-flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm">
                  {["portrait", "landscape"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setOrientation(option)}
                      className={`px-3 py-1.5 text-sm capitalize transition ${
                        orientation === option
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">Include sections</span>
                <div className="mt-2 space-y-2 text-sm text-slate-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeLaneSummary}
                      onChange={(event) => setIncludeLaneSummary(event.target.checked)}
                    />
                    Lane summary
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeTalentSummary}
                      onChange={(event) => setIncludeTalentSummary(event.target.checked)}
                    />
                    Talent summary
                  </label>
                </div>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-700">Filter shots</span>
                <p className="text-xs text-slate-500">
                  Choose which lanes, talent, and dates to include in your export.
                </p>
                <div className="mt-3 space-y-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Lanes</span>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="planner-export-lane-filter"
                          value="all"
                          checked={laneFilterMode === "all"}
                          onChange={() => setLaneFilterMode("all")}
                        />
                        All lanes
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="planner-export-lane-filter"
                          value="selected"
                          checked={laneFilterMode === "selected"}
                          onChange={() => {
                            setLaneFilterMode("selected");
                            if (selectedLaneIds.length === 0) {
                              handleSelectAllLanes();
                            }
                          }}
                        />
                        Specific lanes
                      </label>
                    </div>
                    {isLaneSelectionMode ? (
                      <div className="mt-2 space-y-2">
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {laneOptions.map((lane) => (
                            <label key={lane.id} className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                checked={selectedLaneIdSet.has(lane.id)}
                                onChange={() => handleToggleLane(lane.id)}
                              />
                              {lane.name}
                            </label>
                          ))}
                        </div>
                        {laneOptions.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={handleSelectAllLanes}
                            >
                              Select all lanes
                            </button>
                            <span aria-hidden="true">•</span>
                            <span>{selectedLaneIds.length} selected</span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">No lanes available.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Talent</span>
                    <p className="mt-1 text-xs text-slate-500">
                      Leave blank to include every talent. Select one or more names to limit the export.
                    </p>
                    {talentOptions.length ? (
                      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {talentOptions.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedTalentNames.includes(option.value)}
                              onChange={() => handleToggleTalent(option.value)}
                            />
                            {option.label}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">No talent assignments yet.</p>
                    )}
                    {selectedTalentNames.length ? (
                      <button
                        type="button"
                        className="mt-2 text-xs text-primary hover:underline"
                        onClick={clearTalentFilters}
                      >
                        Clear talent filters
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dates</span>
                    <div className="mt-2 space-y-2 text-sm text-slate-700">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="planner-export-date-filter"
                          value="any"
                          checked={dateFilterMode === "any"}
                          onChange={() => {
                            setDateFilterMode("any");
                            setSelectedDate("");
                          }}
                        />
                        Any date
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="planner-export-date-filter"
                          value="specific"
                          checked={dateFilterMode === "specific"}
                          onChange={() => {
                            setDateFilterMode("specific");
                            if (!selectedDate && availableDates.length) {
                              setSelectedDate(availableDates[0]);
                            }
                          }}
                        />
                        Specific date
                      </label>
                    </div>
                    {dateFilterMode === "specific" ? (
                      <div className="mt-2">
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(event) => setSelectedDate(event.target.value)}
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/60"
                        />
                        {availableDates.length ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Available dates: {availableDates.join(", ")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div>
                <span className="text-sm font-medium text-slate-700">Shot details</span>
                <p className="text-xs text-slate-500">Select the information that will appear for each shot.</p>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {fieldOptions.map((option) => (
                    <label key={option.key} className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={Boolean(fields[option.key])}
                        onChange={(event) =>
                          setFields((prev) => ({
                            ...prev,
                            [option.key]: event.target.checked,
                          }))
                        }
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
                Shots that are too tall to fit on the current page will automatically move to the next page so that
                content never appears cropped.
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-500">
            {hasShots
              ? "Exports include shots that match your filters. CSV files can be opened in spreadsheet tools like Excel or Google Sheets."
              : "Adjust your filters or add shots to the planner to enable exports."}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={handleDownloadCsv}
              disabled={!hasShots || isLoading || isGenerating}
              className="bg-slate-200 text-slate-700 hover:bg-slate-300"
            >
              Download CSV
            </Button>
            <Button
              type="button"
              onClick={handleDownloadPdf}
              disabled={!hasShots || isLoading || isGenerating}
            >
              {isGenerating ? "Preparing PDF…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default PlannerExportModal;
