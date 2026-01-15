import React, { useMemo, useRef, useEffect } from "react";
import {
  Flag,
  Star,
  AlertTriangle,
  Clock,
  Camera,
  User,
  Zap,
  Heart,
} from "lucide-react";
import type { CallSheetScheduleItem, CallSheetTrack } from "../../types";
import type { ColumnConfig } from "../../../../types/schedule";
import { DocTable } from "../primitives/DocTable";

// Icon component mapping for markers (matches MarkerPicker)
const MARKER_ICON_MAP: Record<string, React.ElementType> = {
  star: Star,
  alert: AlertTriangle,
  clock: Clock,
  camera: Camera,
  user: User,
  zap: Zap,
  heart: Heart,
  flag: Flag,
};

/**
 * Parse time string to minutes from midnight.
 * Prefers canonical HH:MM format, falls back to 12h display format.
 * @returns minutes from midnight, or null if parsing fails
 */
function parseTimeToMinutes(time: string | undefined | null): number | null {
  if (!time) return null;

  // Try canonical 24h format "HH:MM" first (most reliable)
  const match24 = time.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return hours * 60 + minutes;
    }
  }

  // Fallback: try 12h format "7:00 AM", "2:30 PM", etc.
  const match12 = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const meridiem = match12[3]?.toUpperCase();

    // Handle 12-hour conversion
    if (meridiem === "PM" && hours !== 12) {
      hours += 12;
    } else if (meridiem === "AM" && hours === 12) {
      hours = 0;
    }

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return hours * 60 + minutes;
    }
  }

  return null;
}

/**
 * Parse duration to minutes.
 * Prefers numeric value (canonical), falls back to string parsing.
 * @returns duration in minutes, or null if parsing fails completely
 */
function parseDurationToMinutes(
  duration: string | number | undefined | null
): number | null {
  // Canonical: numeric duration in minutes
  if (typeof duration === "number" && isFinite(duration) && duration > 0) {
    return duration;
  }

  if (!duration || typeof duration !== "string") {
    return null;
  }

  // Try "X min" or "X minutes" format
  const minMatch = duration.match(/(\d+)\s*(?:min|mins|minutes?)/i);
  if (minMatch) {
    return parseInt(minMatch[1], 10);
  }

  // Try "Xh Ym" or "X hours Y minutes" format
  const hourMinMatch = duration.match(/(\d+)\s*h(?:ours?)?\s*(?:(\d+)\s*m(?:in|ins|inutes?)?)?/i);
  if (hourMinMatch) {
    const hours = parseInt(hourMinMatch[1], 10);
    const mins = hourMinMatch[2] ? parseInt(hourMinMatch[2], 10) : 0;
    return hours * 60 + mins;
  }

  // Try just "Xm" format (common short form like "30m")
  const mMatch = duration.match(/^(\d+)\s*m$/i);
  if (mMatch) {
    return parseInt(mMatch[1], 10);
  }

  // Try decimal hours "X.Y hours"
  const decimalMatch = duration.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
  if (decimalMatch) {
    return Math.round(parseFloat(decimalMatch[1]) * 60);
  }

  return null;
}

/**
 * Normalized schedule item for conflict detection.
 */
interface NormalizedScheduleItem {
  id: string;
  laneId: string;
  startMin: number;
  endMin: number;
}

/**
 * Info about a skipped item for DEV logging.
 */
interface SkippedItemInfo {
  id: string;
  failedField: "time" | "duration" | "lane";
  rawTime: string | undefined | null;
  rawDuration: string | number | undefined | null;
  canonicalTime: string | undefined | null;
  canonicalDuration: number | undefined | null;
}

/**
 * Pair-based conflict detection result (matches editor's syncIntervalEngine).
 */
interface ConflictDetectionResult {
  /** Map of laneId -> Set of unique pair keys (format: "minId::maxId") */
  conflictPairsByLane: Map<string, Set<string>>;
  /** Map of laneId -> count of unique conflict pairs in that lane */
  conflictPairCountByLane: Map<string, number>;
  /** Total unique conflict pairs across all lanes */
  totalConflictPairCount: number;
  /** Set of entry IDs that are involved in any conflict */
  entryIdsInConflicts: Set<string>;
  /** Number of items skipped due to invalid time/duration data */
  skippedCount: number;
  /** Info about skipped items for debugging */
  skippedItems: SkippedItemInfo[];
}

/**
 * Detect schedule conflicts using pair-based counting (matches editor By Track view).
 *
 * A conflict "pair" = two entries in the same lane whose time ranges overlap:
 *   currentEnd = currentStart + currentDuration
 *   overlap if: otherStart < currentEnd (strict inequality)
 *
 * Each unique pair is counted ONCE per lane, regardless of overlap duration.
 * Adjacency (otherStart === currentEnd) is NOT a conflict.
 *
 * Canonical field priority (matches editor syncIntervalEngine):
 * 1. startTimeCanonical (HH:MM string) -> fallback to time (display string) -> fallback to "00:00"
 * 2. durationMinutes (number) -> fallback to duration (display string) -> fallback to 15
 *    - This matches editor syncIntervalEngine defaults (lines 212-214)
 *
 * Lane validation:
 * - trackId must exist in validLaneIds Set, otherwise entry is EXCLUDED
 * - This matches editor syncIntervalEngine behavior (line 205: filter to valid lanes)
 *
 * @param schedule - Array of schedule items to analyze
 * @param validLaneIds - Set of valid track/lane IDs from the editor's tracks config
 */
function detectScheduleConflictsPairBased(
  schedule: CallSheetScheduleItem[],
  validLaneIds: Set<string>
): ConflictDetectionResult {
  const conflictPairsByLane = new Map<string, Set<string>>();
  const entryIdsInConflicts = new Set<string>();
  let skippedCount = 0;
  const skippedItems: SkippedItemInfo[] = [];

  // Normalize items: prefer canonical fields, fallback to display strings
  const normalizedItems: NormalizedScheduleItem[] = [];

  for (const item of schedule) {
    // Skip banners - they don't participate in conflict detection
    if (item.isBanner) continue;

    // Parse start time - CANONICAL FIRST (startTimeCanonical is HH:MM)
    // Then fallback to display string (time is "7:00 AM")
    // If both fail, use default "00:00" (matches editor syncIntervalEngine:212)
    let startMin: number | null = null;
    if (item.startTimeCanonical) {
      startMin = parseTimeToMinutes(item.startTimeCanonical);
    }
    if (startMin === null) {
      startMin = parseTimeToMinutes(item.time);
    }
    if (startMin === null) {
      // Use default 00:00 (midnight) - matches editor behavior
      startMin = 0;
    }

    // Parse duration - CANONICAL FIRST (durationMinutes is number)
    // Then fallback to display string (duration is "30m")
    // If both fail, use default 15 minutes (matches editor syncIntervalEngine:213)
    let durationMin: number | null = null;
    if (typeof item.durationMinutes === "number" && isFinite(item.durationMinutes) && item.durationMinutes > 0) {
      durationMin = item.durationMinutes;
    }
    if (durationMin === null) {
      durationMin = parseDurationToMinutes(item.duration);
    }
    if (durationMin === null) {
      // Use default 15 minutes - matches editor behavior
      durationMin = 15;
    }

    // Compute end time: currentEnd = currentStart + currentDuration
    const endMin = startMin + durationMin;

    // Lane validation: trackId must exist in validLaneIds, otherwise EXCLUDE entry
    // This matches editor syncIntervalEngine behavior (line 205: filter to valid lanes)
    if (!item.trackId || !validLaneIds.has(item.trackId)) {
      // Entry doesn't have a valid lane - exclude from conflict detection
      skippedCount++;
      skippedItems.push({
        id: item.id,
        failedField: "lane",
        rawTime: item.time,
        rawDuration: item.duration,
        canonicalTime: item.startTimeCanonical,
        canonicalDuration: item.durationMinutes,
      });
      continue;
    }
    const laneId = item.trackId;

    normalizedItems.push({
      id: item.id,
      laneId,
      startMin,
      endMin,
    });
  }

  // Group items by lane
  const itemsByLane = new Map<string, NormalizedScheduleItem[]>();
  for (const item of normalizedItems) {
    if (!itemsByLane.has(item.laneId)) {
      itemsByLane.set(item.laneId, []);
    }
    itemsByLane.get(item.laneId)!.push(item);
  }

  // Detect overlaps within each lane using sweep algorithm
  for (const [laneId, items] of itemsByLane) {
    // Sort by start time for efficient overlap detection
    items.sort((a, b) => a.startMin - b.startMin);

    // Sweep through pairs
    for (let i = 0; i < items.length; i++) {
      const current = items[i];
      // currentEnd = currentStart + currentDuration (computed earlier)

      // Compare with subsequent items (j > i)
      for (let j = i + 1; j < items.length; j++) {
        const other = items[j];

        // Overlap math (explicit):
        //   currentEnd = current.startMin + currentDuration (stored in current.endMin)
        //   overlap if: other.startMin < currentEnd (STRICT inequality)
        //   adjacency (other.startMin === currentEnd) is NOT a conflict
        //
        // Since array is sorted by startMin, other.startMin >= current.startMin.
        // If other starts at or after current ends, no overlap with current or later items.
        if (other.startMin >= current.endMin) {
          break; // No further items can overlap with current
        }

        // Overlap detected: other.startMin < current.endMin
        // (and implicitly current.startMin < other.endMin since we're sorted)

        // Create stable pair key using sorted IDs
        const [minId, maxId] = current.id < other.id
          ? [current.id, other.id]
          : [other.id, current.id];
        const pairKey = `${minId}::${maxId}`;

        // Initialize lane's pair set if needed
        if (!conflictPairsByLane.has(laneId)) {
          conflictPairsByLane.set(laneId, new Set());
        }

        // Add pair (Set ensures uniqueness)
        conflictPairsByLane.get(laneId)!.add(pairKey);

        // Track which entries are involved in conflicts
        entryIdsInConflicts.add(current.id);
        entryIdsInConflicts.add(other.id);
      }
    }
  }

  // Compute conflict pair counts per lane
  const conflictPairCountByLane = new Map<string, number>();
  let totalConflictPairCount = 0;

  for (const [laneId, pairSet] of conflictPairsByLane) {
    const count = pairSet.size;
    conflictPairCountByLane.set(laneId, count);
    totalConflictPairCount += count;
  }

  return {
    conflictPairsByLane,
    conflictPairCountByLane,
    totalConflictPairCount,
    entryIdsInConflicts,
    skippedCount,
    skippedItems,
  };
}

interface ScheduleTableSectionProps {
  schedule: CallSheetScheduleItem[];
  columnConfig?: ColumnConfig[];
  tracks?: CallSheetTrack[];
}

// Map column config width to CSS class
const WIDTH_MAP: Record<string, string> = {
  xs: "w-12",
  sm: "w-20",
  md: "w-32",
  lg: "w-44",
  xl: "w-60",
};

// Default columns if no config provided (backwards compatibility)
const DEFAULT_VISIBLE_COLUMNS: ColumnConfig[] = [
  { key: "time", label: "Time", width: "sm", visible: true, order: 0 },
  { key: "description", label: "Set / Description", width: "xl", visible: true, order: 1 },
  { key: "talent", label: "Cast", width: "sm", visible: true, order: 2 },
  { key: "notes", label: "Notes", width: "lg", visible: true, order: 3 },
  { key: "location", label: "Location", width: "lg", visible: true, order: 4 },
];

// Columns controlled by other settings or not available in schedule data
// - duration: controlled by schedule-level showDurations toggle (shown inline in time cell)
// - shot: shot number is embedded in description, not a separate field
// - products: not currently available in schedule item data
const EXCLUDED_COLUMN_KEYS = ["duration", "shot", "products"];

export function ScheduleTableSection({ schedule, columnConfig, tracks }: ScheduleTableSectionProps) {
  // Build Set of valid lane IDs from tracks config (for conflict detection validation)
  // Also build trackId -> name map for display purposes
  const { validLaneIds, trackNameMap } = useMemo(() => {
    const ids = new Set<string>();
    const map: Record<string, string> = {};
    if (Array.isArray(tracks)) {
      for (const track of tracks) {
        ids.add(track.id);
        map[track.id] = track.name;
      }
    }
    return { validLaneIds: ids, trackNameMap: map };
  }, [tracks]);

  // Get visible columns sorted by order (filter out excluded columns for backward compat)
  const visibleColumns = useMemo(() => {
    if (!columnConfig || columnConfig.length === 0) {
      return DEFAULT_VISIBLE_COLUMNS;
    }
    return [...columnConfig]
      .filter((col) => col.visible && !EXCLUDED_COLUMN_KEYS.includes(col.key))
      .sort((a, b) => a.order - b.order);
  }, [columnConfig]);

  // Detect schedule conflicts using pair-based counting (matches editor)
  // Pass validLaneIds to ensure trackId validation matches editor behavior
  const conflictData = useMemo(
    () => detectScheduleConflictsPairBased(schedule, validLaneIds),
    [schedule, validLaneIds]
  );

  // Destructure for convenience
  const { totalConflictPairCount, entryIdsInConflicts, skippedCount, skippedItems, conflictPairsByLane, conflictPairCountByLane } = conflictData;

  // DEV-only: Refs to track last emitted hashes (prevents log spam on re-renders)
  const lastSkippedHashRef = useRef<string>("");
  const lastConflictHashRef = useRef<string>("");

  // DEV-only: Emit diagnostic logs only when payload meaningfully changes
  // CAPPED: sample sizes limited to prevent huge payloads on large schedules
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const SAMPLE_CAP = 5; // Max samples in hash/log to keep payload small

    // Hash for skipped items: count|sortedParts (deterministic order by id)
    // Counts are FULL; samples are CAPPED for hash stability + perf
    if (skippedCount > 0) {
      const skippedSamplesSorted = skippedItems
        .slice(0, SAMPLE_CAP)
        .sort((a, b) => a.id.localeCompare(b.id));
      const skippedParts = skippedSamplesSorted.map((s) => `${s.failedField}:${s.id}`);
      const skippedHash = `${skippedCount}|${skippedParts.join(",")}`;

      if (skippedHash !== lastSkippedHashRef.current) {
        lastSkippedHashRef.current = skippedHash;
        const skippedSamples = skippedItems.slice(0, SAMPLE_CAP).map((s) => ({
          id: s.id,
          failed: s.failedField,
          rawTime: s.rawTime,
          rawDuration: s.rawDuration,
          canonicalTime: s.canonicalTime,
          canonicalDuration: s.canonicalDuration,
        }));
        console.warn(
          `[ScheduleTableSection] ${skippedCount} item(s) skipped due to invalid data:`,
          skippedSamples
        );
      }
    }

    // Hash for conflicts: count|entriesCount|laneKeys|pairSamples (deterministic, lane-sensitive)
    // Counts are FULL (laneKeyParts includes ALL lanes); pair samples are CAPPED
    if (totalConflictPairCount > 0) {
      // Build deterministic lane key parts: sorted by laneId, format "laneId:count"
      // FULL count - includes ALL lanes for accurate deduplication
      const laneKeyParts = Array.from(conflictPairCountByLane.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([laneId, count]) => `${laneId}:${count}`);

      // Build deterministic pair samples: sorted by laneId, each lane's pairs sorted
      // CAPPED: first 5 lanes, first 5 pairs per lane (for hash + perf)
      const sortedLaneEntries = Array.from(conflictPairsByLane.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(0, SAMPLE_CAP);
      const pairSamplesByLane = sortedLaneEntries.map(([laneId, pairSet]) => {
        const sortedPairs = Array.from(pairSet).sort().slice(0, SAMPLE_CAP);
        return `${laneId}=[${sortedPairs.join(";")}]`;
      });

      const conflictHash = `${totalConflictPairCount}|${entryIdsInConflicts.size}|${laneKeyParts.join(",")}|${pairSamplesByLane.join(",")}`;

      if (conflictHash !== lastConflictHashRef.current) {
        lastConflictHashRef.current = conflictHash;
        // Log: FULL laneKeyParts + CAPPED pair samples
        const pairSamples: Record<string, string[]> = {};
        for (const [laneId, pairSet] of sortedLaneEntries) {
          pairSamples[laneId] = Array.from(pairSet).sort().slice(0, SAMPLE_CAP);
        }
        console.info(
          `[ScheduleTableSection] ${totalConflictPairCount} conflict pair(s), ${entryIdsInConflicts.size} entries involved, lanes: [${laneKeyParts.join(", ")}]`,
          pairSamples
        );
      }
    }
  }, [skippedCount, skippedItems, totalConflictPairCount, entryIdsInConflicts, conflictPairsByLane, conflictPairCountByLane]);

  if (!schedule.length) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 italic">
        No schedule items.
      </div>
    );
  }

  // Render a cell value based on column key
  const renderCellValue = (item: CallSheetScheduleItem, col: ColumnConfig) => {
    switch (col.key) {
      case "time": {
        // Duration is shown inline below time when available (controlled by showDurations setting)
        // Marker is shown to the left of the time when present
        // Track chip is shown for non-primary tracks
        // Conflict indicator is shown for items with overlaps
        const MarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;
        const showTrackChip = item.trackId && item.trackId !== "primary" && trackNameMap[item.trackId];
        const trackName = showTrackChip ? trackNameMap[item.trackId!] : null;
        const hasConflict = entryIdsInConflicts.has(item.id);
        return (
          <div className="flex items-start gap-1.5">
            {/* Conflict indicator - print-friendly subtle warning */}
            {hasConflict && (
              <span
                className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center text-amber-600 print:text-amber-700"
                title="Schedule conflict detected"
              >
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            )}
            {item.marker && MarkerIcon && (
              <span
                className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full print:h-3.5 print:w-3.5"
                style={{ backgroundColor: item.marker.color }}
                title={item.marker.icon}
              >
                <MarkerIcon className="h-2.5 w-2.5 text-white print:h-2 print:w-2" />
              </span>
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900">{item.time}</span>
                {trackName && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs leading-none font-medium text-slate-600 whitespace-nowrap print:bg-slate-50 print:text-slate-500">
                    {trackName}
                  </span>
                )}
              </div>
              {item.duration && (
                <div className="text-[10px] text-gray-400 italic">{item.duration}</div>
              )}
            </div>
          </div>
        );
      }
      case "description":
        return <span className="text-gray-800">{item.description}</span>;
      case "talent":
        return <span className="text-gray-700">{item.cast !== "—" ? item.cast : ""}</span>;
      case "notes":
        return <span className="text-xs text-gray-600">{item.notes !== "—" ? item.notes : ""}</span>;
      case "location":
        return item.location ? (
          <div className="text-xs">
            <div className="font-medium text-gray-900">{item.location.name}</div>
            {item.location.address && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(item.location.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {item.location.address}
              </a>
            )}
          </div>
        ) : null;
      default:
        return "";
    }
  };

  return (
    <div>
      {/* Conflict warning banner - print-friendly with stable pair-based count */}
      {totalConflictPairCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 mb-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded print:bg-transparent print:border-amber-300 print:text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 print:h-4 print:w-4" />
          <span>
            Schedule overlaps: {totalConflictPairCount} conflict{totalConflictPairCount !== 1 ? "s" : ""} • {entryIdsInConflicts.size} item{entryIdsInConflicts.size !== 1 ? "s" : ""} affected
          </span>
        </div>
      )}
      <DocTable>
        <thead>
          <tr>
            {visibleColumns.map((col) => (
              <th
                key={col.key}
                className={`text-left ${WIDTH_MAP[col.width] || ""} ${col.key === "talent" ? "text-center" : ""}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
      <tbody>
        {schedule.map((item) => (
          <tr key={item.id}>
            {item.isBanner ? (
              // Banner row respects column config - render time if visible, then span rest for description
              (() => {
                const BannerMarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;
                const timeColumnIndex = visibleColumns.findIndex((col) => col.key === "time");
                const hasTimeColumn = timeColumnIndex !== -1;

                // If no time column, span all columns for the banner
                if (!hasTimeColumn) {
                  return (
                    <td colSpan={visibleColumns.length}>
                      <div className="flex items-center gap-2 font-medium text-gray-800">
                        {item.marker && BannerMarkerIcon && (
                          <span
                            className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full print:h-3.5 print:w-3.5"
                            style={{ backgroundColor: item.marker.color }}
                            title={item.marker.icon}
                          >
                            <BannerMarkerIcon className="h-2.5 w-2.5 text-white print:h-2 print:w-2" />
                          </span>
                        )}
                        <Flag className="w-4 h-4 text-red-500" />
                        {item.description}
                      </div>
                    </td>
                  );
                }

                // Time column is visible - render cells in proper order
                const cells: React.ReactNode[] = [];

                for (let i = 0; i < visibleColumns.length; i++) {
                  if (i === timeColumnIndex) {
                    // Render time cell
                    cells.push(
                      <td key="time">
                        <div className="flex items-center gap-1.5">
                          {item.marker && BannerMarkerIcon && (
                            <span
                              className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full print:h-3.5 print:w-3.5"
                              style={{ backgroundColor: item.marker.color }}
                              title={item.marker.icon}
                            >
                              <BannerMarkerIcon className="h-2.5 w-2.5 text-white print:h-2 print:w-2" />
                            </span>
                          )}
                          <div className="font-semibold text-gray-900">{item.time}</div>
                        </div>
                      </td>
                    );
                  } else if (i === (timeColumnIndex === 0 ? 1 : 0)) {
                    // First non-time cell spans the remaining columns
                    const remainingCols = visibleColumns.length - 1;
                    cells.push(
                      <td key="description" colSpan={remainingCols}>
                        <div className="flex items-center gap-2 font-medium text-gray-800">
                          <Flag className="w-4 h-4 text-red-500" />
                          {item.description}
                        </div>
                      </td>
                    );
                    break; // colspan handles the rest
                  }
                }

                return <>{cells}</>;
              })()
            ) : (
              // Regular row with dynamic columns
              visibleColumns.map((col) => (
                <td key={col.key} className={col.key === "talent" ? "text-center" : ""}>
                  {renderCellValue(item, col)}
                </td>
              ))
            )}
          </tr>
        ))}
      </tbody>
      </DocTable>
    </div>
  );
}
