import React, { useMemo } from "react";
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
  // Build trackId -> name map for quick lookup
  const trackNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (Array.isArray(tracks)) {
      for (const track of tracks) {
        map[track.id] = track.name;
      }
    }
    return map;
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
        const MarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;
        const showTrackChip = item.trackId && item.trackId !== "primary" && trackNameMap[item.trackId];
        const trackName = showTrackChip ? trackNameMap[item.trackId!] : null;
        return (
          <div className="flex items-start gap-1.5">
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
  );
}
