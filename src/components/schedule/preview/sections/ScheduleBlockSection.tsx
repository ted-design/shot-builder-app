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

interface ScheduleBlockSectionProps {
  schedule: CallSheetScheduleItem[];
  tracks?: CallSheetTrack[];
}

/**
 * ScheduleBlockSection - Block Preview v1
 *
 * Renders schedule entries as blocks/cards instead of a table.
 * Consumes buildScheduleProjection output (mode="time") directly.
 *
 * Features:
 * - Time range display (start time + duration)
 * - Title / description
 * - Applicability badge: "All Tracks" for kind="all", track names for subset
 * - Category badge for setup/lunch/wrap entries
 * - Subtle conflict indicator (amber icon) when hasConflict=true
 * - Banner-style blocks for shared/all-track entries
 */
export function ScheduleBlockSection({ schedule, tracks }: ScheduleBlockSectionProps) {
  // Build trackId -> name map for display
  const trackNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (Array.isArray(tracks)) {
      for (const track of tracks) {
        map[track.id] = track.name;
      }
    }
    return map;
  }, [tracks]);

  // Count conflicts for summary
  const conflictCount = useMemo(() => {
    return schedule.filter((item) => item.hasConflict).length;
  }, [schedule]);

  if (!schedule.length) {
    return (
      <div className="p-4 text-center text-sm text-gray-500 italic">
        No schedule items.
      </div>
    );
  }

  /**
   * Get applicability display for an entry
   */
  function getApplicabilityDisplay(item: CallSheetScheduleItem): {
    label: string | null;
    kind: "all" | "subset" | "single" | "none";
  } {
    const kind = item.applicabilityKind || "none";

    if (kind === "all") {
      return { label: "All Tracks", kind };
    }

    if (kind === "subset" && item.appliesToTrackIds) {
      // Show track names for subset
      const names = item.appliesToTrackIds
        .map((id) => trackNameMap[id])
        .filter(Boolean);
      if (names.length > 0) {
        return { label: names.join(", "), kind };
      }
      // Fallback: show "Photo/Video" style if we know it's two tracks
      if (item.appliesToTrackIds.length === 2) {
        return { label: "Photo/Video", kind };
      }
    }

    if (kind === "single" && item.trackId && trackNameMap[item.trackId]) {
      // Don't show track chip for single-track entries in block view
      // The track context is implicit
      return { label: null, kind };
    }

    return { label: null, kind };
  }

  /**
   * Detect category from description (for setup/lunch/wrap styling)
   */
  function detectCategory(description: string): string | null {
    const lower = description.toLowerCase();
    if (lower.includes("setup") || lower.includes("load in")) return "setup";
    if (lower.includes("lunch") || lower.includes("break")) return "meal";
    if (lower.includes("wrap")) return "wrap";
    if (lower.includes("call")) return "call";
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Conflict warning banner */}
      {conflictCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded print:bg-transparent print:border-amber-300 print:text-amber-800">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {conflictCount} schedule conflict{conflictCount !== 1 ? "s" : ""} detected
          </span>
        </div>
      )}

      {/* Schedule blocks */}
      <div className="space-y-1.5">
        {schedule.map((item) => {
          const MarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;
          const applicability = getApplicabilityDisplay(item);
          const category = detectCategory(item.description);
          const isBanner = item.isBanner || applicability.kind === "all";

          // Banner block styling for shared entries
          if (isBanner) {
            return (
              <BannerBlock
                key={item.id}
                item={item}
                MarkerIcon={MarkerIcon}
                applicability={applicability}
                category={category}
              />
            );
          }

          // Regular block
          return (
            <RegularBlock
              key={item.id}
              item={item}
              MarkerIcon={MarkerIcon}
              applicability={applicability}
              category={category}
              trackNameMap={trackNameMap}
            />
          );
        })}
      </div>
    </div>
  );
}

interface BlockProps {
  item: CallSheetScheduleItem;
  MarkerIcon: React.ElementType | null;
  applicability: { label: string | null; kind: string };
  category: string | null;
}

/**
 * BannerBlock - Full-width banner for shared/all-track entries
 */
function BannerBlock({ item, MarkerIcon, applicability, category }: BlockProps) {
  const categoryStyles = getCategoryStyles(category);

  return (
    <div
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-md border
        ${categoryStyles.border} ${categoryStyles.bg}
        print:border-gray-300 print:bg-gray-50
      `}
    >
      {/* Conflict indicator */}
      {item.hasConflict && (
        <span className="text-amber-600 print:text-amber-700" title="Schedule conflict">
          <AlertTriangle className="h-3.5 w-3.5" />
        </span>
      )}

      {/* Marker icon */}
      {item.marker && MarkerIcon && (
        <span
          className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full print:h-4 print:w-4"
          style={{ backgroundColor: item.marker.color }}
          title={item.marker.icon}
        >
          <MarkerIcon className="h-3 w-3 text-white print:h-2.5 print:w-2.5" />
        </span>
      )}

      {/* Time */}
      <div className="flex-shrink-0">
        <span className={`text-sm font-bold ${categoryStyles.text}`}>
          {item.time}
        </span>
        {item.duration && (
          <span className="text-xs text-gray-400 ml-1">({item.duration})</span>
        )}
      </div>

      {/* Separator line */}
      <div className={`flex-1 h-px ${categoryStyles.line}`} />

      {/* Description */}
      <div className="flex-shrink-0 text-sm font-semibold uppercase tracking-wide text-gray-700">
        {item.description}
      </div>

      {/* Separator line */}
      <div className={`flex-[0.3] h-px ${categoryStyles.line}`} />

      {/* Applicability badge */}
      {applicability.label && (
        <span className="flex-shrink-0 inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 print:bg-slate-100">
          {applicability.label}
        </span>
      )}
    </div>
  );
}

interface RegularBlockProps extends BlockProps {
  trackNameMap: Record<string, string>;
}

/**
 * RegularBlock - Standard block for lane/single-track entries
 */
function RegularBlock({ item, MarkerIcon, applicability, category, trackNameMap }: RegularBlockProps) {
  const trackName = item.trackId && trackNameMap[item.trackId] ? trackNameMap[item.trackId] : null;

  return (
    <div
      className={`
        relative px-3 py-2 rounded-md border bg-white shadow-sm
        border-slate-200 hover:border-slate-300
        print:shadow-none print:border-gray-300
      `}
    >
      {/* Header row: Time + Track/Applicability + Duration */}
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          {/* Conflict indicator */}
          {item.hasConflict && (
            <span className="text-amber-600 print:text-amber-700" title="Schedule conflict">
              <AlertTriangle className="h-3.5 w-3.5" />
            </span>
          )}

          {/* Marker icon */}
          {item.marker && MarkerIcon && (
            <span
              className="inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: item.marker.color }}
              title={item.marker.icon}
            >
              <MarkerIcon className="h-2.5 w-2.5 text-white" />
            </span>
          )}

          {/* Time */}
          <span className="text-sm font-semibold text-gray-900">{item.time}</span>

          {/* Track chip for single-track entries */}
          {trackName && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              {trackName}
            </span>
          )}

          {/* Applicability badge for subset entries */}
          {applicability.label && applicability.kind === "subset" && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 print:bg-blue-50">
              {applicability.label}
            </span>
          )}

          {/* Category badge */}
          {category && (
            <CategoryBadge category={category} />
          )}
        </div>

        {/* Duration */}
        {item.duration && (
          <span className="text-[11px] text-gray-400 font-mono">{item.duration}</span>
        )}
      </div>

      {/* Title / Description */}
      <h4 className="text-sm font-medium text-gray-800 leading-snug">
        {item.description}
      </h4>

      {/* Optional: Cast & Notes */}
      {(item.cast !== "—" || item.notes !== "—") && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {item.cast && item.cast !== "—" && (
            <span>Cast: {item.cast}</span>
          )}
          {item.notes && item.notes !== "—" && (
            <span className="truncate max-w-[200px]" title={item.notes}>
              {item.notes}
            </span>
          )}
        </div>
      )}

      {/* Location */}
      {item.location && (
        <div className="mt-1 text-[11px] text-gray-500">
          <span className="font-medium">{item.location.name}</span>
          {item.location.address && (
            <span className="ml-1 text-gray-400">- {item.location.address}</span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * CategoryBadge - Visual badge for entry categories
 */
function CategoryBadge({ category }: { category: string }) {
  const styles: Record<string, string> = {
    setup: "bg-purple-50 text-purple-700",
    meal: "bg-amber-50 text-amber-700",
    wrap: "bg-slate-800 text-white",
    call: "bg-indigo-50 text-indigo-700",
  };

  const style = styles[category] || "bg-gray-100 text-gray-600";
  const label = category.charAt(0).toUpperCase() + category.slice(1);

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${style}`}>
      {label}
    </span>
  );
}

/**
 * Get styling for banner blocks based on category
 */
function getCategoryStyles(category: string | null): {
  border: string;
  bg: string;
  text: string;
  line: string;
} {
  switch (category) {
    case "setup":
    case "call":
      return {
        border: "border-indigo-200",
        bg: "bg-indigo-50/50",
        text: "text-indigo-700",
        line: "bg-indigo-200",
      };
    case "meal":
      return {
        border: "border-amber-200",
        bg: "bg-amber-50/50",
        text: "text-amber-700",
        line: "bg-amber-200",
      };
    case "wrap":
      return {
        border: "border-slate-400",
        bg: "bg-slate-100",
        text: "text-slate-800",
        line: "bg-slate-300",
      };
    default:
      return {
        border: "border-slate-200",
        bg: "bg-slate-50/50",
        text: "text-slate-700",
        line: "bg-slate-200",
      };
  }
}
