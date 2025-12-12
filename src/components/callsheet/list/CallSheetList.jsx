// src/components/callsheet/list/CallSheetList.jsx
// List/table view for call sheet entries

import React, { useMemo, useState } from "react";
import {
  Clock,
  Timer,
  Camera,
  MapPin,
  Users,
  Package,
  FileText,
  ChevronUp,
  ChevronDown,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { minutesToTime12h, calculateEndTime, parseTimeToMinutes } from "../../../lib/timeUtils";
import {
  CUSTOM_ENTRY_CATEGORY_LABELS,
  CUSTOM_ENTRY_CATEGORY_COLORS,
} from "../../../types/schedule";

/**
 * CallSheetList - Table view of schedule entries
 *
 * @param {object} props
 * @param {Array} props.entries - Resolved schedule entries
 * @param {Array} props.tracks - Available tracks
 * @param {Array} props.columnConfig - Column configuration
 * @param {object} props.settings - Schedule settings
 * @param {string} props.selectedEntryId - Currently selected entry ID
 * @param {Function} props.onEntryClick - Callback when entry is clicked
 * @param {Function} props.onEntryDoubleClick - Callback for double-click (edit)
 * @param {Function} props.onDeleteEntry - Callback to delete entry
 */
function CallSheetList({
  entries = [],
  tracks = [],
  columnConfig = [],
  settings = {},
  selectedEntryId,
  onEntryClick,
  onEntryDoubleClick,
  onDeleteEntry,
}) {
  const [sortField, setSortField] = useState("startTime");
  const [sortDirection, setSortDirection] = useState("asc");

  // Get track map for quick lookup
  const trackMap = useMemo(() => {
    return new Map(tracks.map((t) => [t.id, t]));
  }, [tracks]);

  // Visible columns
  const visibleColumns = useMemo(() => {
    return columnConfig
      .filter((col) => col.visible)
      .sort((a, b) => a.order - b.order);
  }, [columnConfig]);

  // Sort entries
  const sortedEntries = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      let aVal, bVal;

      switch (sortField) {
        case "startTime":
          aVal = parseTimeToMinutes(a.startTime);
          bVal = parseTimeToMinutes(b.startTime);
          break;
        case "duration":
          aVal = a.duration;
          bVal = b.duration;
          break;
        case "title":
          aVal = a.resolvedTitle?.toLowerCase() || "";
          bVal = b.resolvedTitle?.toLowerCase() || "";
          break;
        case "track":
          aVal = trackMap.get(a.trackId)?.order ?? 999;
          bVal = trackMap.get(b.trackId)?.order ?? 999;
          break;
        default:
          aVal = a.startTime;
          bVal = b.startTime;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      if (sortField === "startTime") {
        return (a.order ?? 0) - (b.order ?? 0);
      }
      return 0;
    });

    return sorted;
  }, [entries, sortField, sortDirection, trackMap]);

  // Handle column header click for sorting
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Render sort indicator
  const SortIndicator = ({ field }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="ml-1 h-3 w-3" />
    ) : (
      <ChevronDown className="ml-1 h-3 w-3" />
    );
  };

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
        <FileText className="mb-2 h-10 w-10 text-slate-300" />
        <p className="text-slate-500">No entries in schedule</p>
        <p className="mt-1 text-sm text-slate-400">
          Use the Add button to add shots or custom items
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {/* Header */}
          <thead className="bg-slate-50 dark:bg-slate-800">
            <tr>
              {/* Drag handle column */}
              <th className="w-8 px-2 py-3" />

              {/* Time column - always visible */}
              <th
                className="cursor-pointer whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => handleSort("startTime")}
              >
                <div className="flex items-center">
                  <Clock className="mr-1.5 h-3.5 w-3.5" />
                  Time
                  <SortIndicator field="startTime" />
                </div>
              </th>

              {/* Duration column */}
              <th
                className="cursor-pointer whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => handleSort("duration")}
              >
                <div className="flex items-center">
                  <Timer className="mr-1.5 h-3.5 w-3.5" />
                  Duration
                  <SortIndicator field="duration" />
                </div>
              </th>

              {/* Track column */}
              <th
                className="cursor-pointer whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => handleSort("track")}
              >
                <div className="flex items-center">
                  Track
                  <SortIndicator field="track" />
                </div>
              </th>

              {/* Description/Title column */}
              <th
                className="cursor-pointer whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                onClick={() => handleSort("title")}
              >
                <div className="flex items-center">
                  Description
                  <SortIndicator field="title" />
                </div>
              </th>

              {/* Talent column */}
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <div className="flex items-center">
                  <Users className="mr-1.5 h-3.5 w-3.5" />
                  Talent
                </div>
              </th>

              {/* Products column */}
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <div className="flex items-center">
                  <Package className="mr-1.5 h-3.5 w-3.5" />
                  Products
                </div>
              </th>

              {/* Location column */}
              <th className="whitespace-nowrap px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <div className="flex items-center">
                  <MapPin className="mr-1.5 h-3.5 w-3.5" />
                  Location
                </div>
              </th>

              {/* Actions column */}
              <th className="w-10 px-2 py-3" />
            </tr>
          </thead>

          {/* Body */}
          <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
            {sortedEntries.map((entry) => {
              const track = trackMap.get(entry.trackId);
              const isSelected = selectedEntryId === entry.id;
              const isShot = entry.type === "shot";
              const categoryColor = !isShot && entry.customData?.category
                ? CUSTOM_ENTRY_CATEGORY_COLORS[entry.customData.category]
                : null;

              return (
                <tr
                  key={entry.id}
                  onClick={() => onEntryClick?.(entry.id)}
                  onDoubleClick={() => onEntryDoubleClick?.(entry.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-900/20"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  {/* Drag handle */}
                  <td className="px-2 py-3 text-center">
                    <GripVertical className="inline-block h-4 w-4 cursor-grab text-slate-300" />
                  </td>

                  {/* Time */}
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {minutesToTime12h(entry.startTime)}
                      </span>
                      <span className="text-xs text-slate-500">
                        → {minutesToTime12h(calculateEndTime(entry.startTime, entry.duration))}
                      </span>
                    </div>
                  </td>

                  {/* Duration */}
                  <td className="whitespace-nowrap px-3 py-3 text-slate-600 dark:text-slate-400">
                    {entry.duration} min
                  </td>

                  {/* Track */}
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: track?.color || "#64748B" }}
                      />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {track?.name || "Unknown"}
                      </span>
                    </div>
                  </td>

                  {/* Description/Title */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      {/* Thumbnail or category indicator */}
                      {isShot ? (
                        <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
                          {entry.resolvedImage ? (
                            <img
                              src={entry.resolvedImage}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <ImageIcon className="h-4 w-4 text-slate-400" />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded"
                          style={{
                            backgroundColor: categoryColor ? `${categoryColor}20` : "#f1f5f9",
                          }}
                        >
                          <Camera
                            className="h-4 w-4"
                            style={{ color: categoryColor || "#64748B" }}
                          />
                        </div>
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {isShot && entry.shotRef && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              Shot
                            </span>
                          )}
                          {!isShot && entry.customData?.category && (
                            <span
                              className="rounded px-1.5 py-0.5 text-xs font-medium"
                              style={{
                                backgroundColor: `${categoryColor}20`,
                                color: categoryColor,
                              }}
                            >
                              {CUSTOM_ENTRY_CATEGORY_LABELS[entry.customData.category]}
                            </span>
                          )}
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {entry.resolvedTitle || "Untitled"}
                          </span>
                        </div>
                        {entry.resolvedNotes && (
                          <p className="mt-0.5 truncate text-sm text-slate-500">
                            {entry.resolvedNotes}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Talent */}
                  <td className="px-3 py-3">
                    {entry.resolvedTalent?.length > 0 ? (
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {entry.resolvedTalent.slice(0, 2).join(", ")}
                        {entry.resolvedTalent.length > 2 && (
                          <span className="text-slate-400">
                            {" "}+{entry.resolvedTalent.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Products */}
                  <td className="px-3 py-3">
                    {entry.resolvedProducts?.length > 0 ? (
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {entry.resolvedProducts.slice(0, 2).join(", ")}
                        {entry.resolvedProducts.length > 2 && (
                          <span className="text-slate-400">
                            {" "}+{entry.resolvedProducts.length - 2}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3">
                    {entry.resolvedLocation ? (
                      <div className="text-sm text-slate-600 dark:text-slate-400">
                        {entry.resolvedLocation}
                      </div>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600">—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onEntryDoubleClick?.(entry.id);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEntry?.(entry.id);
                          }}
                          className="text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 dark:border-slate-700 dark:bg-slate-800">
        <p className="text-sm text-slate-500">
          {entries.length} item{entries.length !== 1 ? "s" : ""} in schedule
        </p>
      </div>
    </div>
  );
}

export default CallSheetList;
