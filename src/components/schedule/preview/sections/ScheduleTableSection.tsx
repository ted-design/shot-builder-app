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
import {
  detectConflictsPairwise,
  getTotalConflictPairCount,
  getEntryIdsInConflicts,
} from "../../../../lib/callsheet/detectConflictsPairwise";
import {
  getApplicableTrackIds,
  getApplicabilityLabel,
} from "../../../../lib/callsheet/getApplicableTrackIds";

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
 * Track type extended with scope for canonical conflict detection.
 */
interface TrackWithScope extends CallSheetTrack {
  scope?: "lane" | "shared";
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
  // Build tracksById map for conflict detection and trackId -> name map for display
  const { tracksById, trackNameMap } = useMemo(() => {
    const byId = new Map<string, TrackWithScope>();
    const map: Record<string, string> = {};
    if (Array.isArray(tracks)) {
      for (const track of tracks) {
        byId.set(track.id, track as TrackWithScope);
        map[track.id] = track.name;
      }
    }
    return { tracksById: byId, trackNameMap: map };
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

  // Check if schedule items have pre-computed conflict data from projection
  // If hasConflict is pre-computed, skip redundant conflict detection
  const hasPrecomputedConflicts = schedule.length > 0 && typeof schedule[0].hasConflict === "boolean";

  // Detect schedule conflicts using canonical pair-based detection (only if not pre-computed)
  // Handles shared entries and appliesToTrackIds properly
  const conflictResult = useMemo(
    () => hasPrecomputedConflicts ? { pairs: [], byEntryId: new Map() } : detectConflictsPairwise(schedule, tracksById),
    [schedule, tracksById, hasPrecomputedConflicts]
  );

  // Extract conflict data for rendering
  // If pre-computed, derive from schedule items; otherwise from conflictResult
  const { totalConflictPairCount, entryIdsInConflicts } = useMemo(() => {
    if (hasPrecomputedConflicts) {
      // Derive from pre-computed hasConflict flags
      const idsWithConflicts = new Set<string>();
      for (const item of schedule) {
        if (item.hasConflict) {
          idsWithConflicts.add(item.id);
        }
      }
      // Pair count is not available from pre-computed data, estimate as half the conflict count
      // (each conflict involves 2 entries, so pairs ~ entryCount / 2)
      const estimatedPairs = Math.ceil(idsWithConflicts.size / 2);
      return { totalConflictPairCount: estimatedPairs, entryIdsInConflicts: idsWithConflicts };
    }
    return {
      totalConflictPairCount: getTotalConflictPairCount(conflictResult),
      entryIdsInConflicts: getEntryIdsInConflicts(conflictResult),
    };
  }, [hasPrecomputedConflicts, schedule, conflictResult]);

  // DEV-only: Ref to track last emitted hash (prevents log spam on re-renders)
  const lastConflictHashRef = useRef<string>("");

  // DEV-only: Emit diagnostic logs only when conflicts change
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    if (totalConflictPairCount > 0) {
      // Build deterministic hash from pairs
      const pairKeys = conflictResult.pairs.map((p) => `${p.aId}::${p.bId}`);
      const conflictHash = `${totalConflictPairCount}|${entryIdsInConflicts.size}|${pairKeys.slice(0, 5).join(",")}`;

      if (conflictHash !== lastConflictHashRef.current) {
        lastConflictHashRef.current = conflictHash;
        console.info(
          `[ScheduleTableSection] ${totalConflictPairCount} conflict pair(s), ${entryIdsInConflicts.size} entries involved`,
          { pairs: conflictResult.pairs.slice(0, 5) }
        );
      }
    }
  }, [totalConflictPairCount, entryIdsInConflicts, conflictResult.pairs]);

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
        // Track chip or applicability label shown based on entry type
        // Conflict indicator is shown for items with overlaps
        const MarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;

        // Use pre-computed hasConflict if available, else check entryIdsInConflicts
        const hasConflict = typeof item.hasConflict === "boolean"
          ? item.hasConflict
          : entryIdsInConflicts.has(item.id);

        // Get applicability - prefer pre-computed applicabilityKind, else compute
        const applicabilityKind = item.applicabilityKind || getApplicableTrackIds(item, tracksById).kind;
        const applicability = item.applicabilityKind
          ? { kind: item.applicabilityKind, trackIds: [], reason: "pre-computed" }
          : getApplicableTrackIds(item, tracksById);
        const applicabilityLabel = getApplicabilityLabel(applicability, tracksById);

        // For single lane entries, show track chip (unless primary track)
        const showTrackChip = applicabilityKind === "single" &&
          item.trackId && item.trackId !== "primary" && trackNameMap[item.trackId];
        const trackName = showTrackChip ? trackNameMap[item.trackId!] : null;

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
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900">{item.time}</span>
                {/* Show track chip for single lane entries */}
                {trackName && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-xs leading-none font-medium text-slate-600 whitespace-nowrap print:bg-slate-50 print:text-slate-500">
                    {trackName}
                  </span>
                )}
                {/* Show applicability label for all/subset entries */}
                {applicabilityLabel && (
                  <span className={[
                    "inline-flex items-center rounded-full px-1.5 py-0.5 text-xs leading-none font-medium whitespace-nowrap",
                    applicabilityKind === "all"
                      ? "bg-slate-200 text-slate-600 print:bg-slate-100 print:text-slate-500"
                      : "bg-blue-100 text-blue-700 print:bg-blue-50 print:text-blue-600"
                  ].join(" ")}>
                    {applicabilityLabel}
                  </span>
                )}
              </div>
              {item.duration && (
                <div className="text-2xs text-gray-400 italic">{item.duration}</div>
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
