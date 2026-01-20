import React, { useMemo } from "react";
import type { CallSheetScheduleItem, CallSheetTrack } from "../../types";
import type { ScheduleBlockFields } from "../../../../types/callsheet";
import { getColorTag } from "../../../../types/schedule";
import { MARKER_ICON_MAP } from "../../../../lib/markerIcons";

/**
 * Format minutes from midnight to 12h display format.
 * @param minutes - Minutes from midnight (e.g., 480 = 8:00 AM)
 * @returns Formatted time string (e.g., "8:00 AM")
 */
function formatMinutesTo12h(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return "";
  const totalMins = Math.max(0, Math.floor(minutes));
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/**
 * Compute time range string from projection fields.
 * Returns "start–end" format (e.g., "6:00 AM–7:00 AM").
 * Falls back to item.time if startMin unavailable.
 */
function getTimeRangeDisplay(item: CallSheetScheduleItem): string {
  const { startMin, durationMinutes, time } = item;

  // If we have startMin, compute the range
  if (startMin != null && Number.isFinite(startMin)) {
    const startStr = formatMinutesTo12h(startMin);

    // Compute endMin if we have duration
    if (durationMinutes != null && Number.isFinite(durationMinutes) && durationMinutes > 0) {
      const endMin = startMin + durationMinutes;
      const endStr = formatMinutesTo12h(endMin);
      return `${startStr}–${endStr}`;
    }

    // No duration: just show start time
    return startStr;
  }

  // Fallback to legacy time field
  return time || "";
}

interface ScheduleBlockSectionProps {
  schedule: CallSheetScheduleItem[];
  tracks?: CallSheetTrack[];
  blockFields?: ScheduleBlockFields | null;
}

/**
 * Check if a track is a "Photo" track based on trackId or trackName.
 */
function isPhotoTrack(
  trackId: string | null | undefined,
  trackNameMap: Record<string, string>
): boolean {
  if (!trackId) return false;
  const trackName = trackNameMap[trackId]?.toLowerCase() ?? "";
  return trackName.includes("photo") || trackName.includes("still");
}

/**
 * Check if a track is a "Video" track based on trackId or trackName.
 */
function isVideoTrack(
  trackId: string | null | undefined,
  trackNameMap: Record<string, string>
): boolean {
  if (!trackId) return false;
  const trackName = trackNameMap[trackId]?.toLowerCase() ?? "";
  return trackName.includes("video") || trackName.includes("motion");
}

/**
 * Sort items within a column by startMin ASC, then ID (stable tiebreaker).
 * Used for stacked column layout in overlap bands.
 */
function sortColumnItems(items: CallSheetScheduleItem[]): CallSheetScheduleItem[] {
  return [...items].sort((a, b) => {
    // 1. startMin ASC (items starting earlier appear first)
    const startA = a.startMin ?? Number.MAX_SAFE_INTEGER;
    const startB = b.startMin ?? Number.MAX_SAFE_INTEGER;
    if (startA !== startB) return startA - startB;

    // 2. ID string (stable tiebreaker)
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}

/**
 * Partition simultaneous items into Photo, Video, and Other buckets.
 * Returns sorted arrays for each column.
 */
function partitionSimultaneousItems(
  items: CallSheetScheduleItem[],
  trackNameMap: Record<string, string>
): {
  photoItems: CallSheetScheduleItem[];
  videoItems: CallSheetScheduleItem[];
  otherItems: CallSheetScheduleItem[];
} {
  const photoItems: CallSheetScheduleItem[] = [];
  const videoItems: CallSheetScheduleItem[] = [];
  const otherItems: CallSheetScheduleItem[] = [];

  for (const item of items) {
    if (isPhotoTrack(item.trackId, trackNameMap)) {
      photoItems.push(item);
    } else if (isVideoTrack(item.trackId, trackNameMap)) {
      videoItems.push(item);
    } else {
      otherItems.push(item);
    }
  }

  return {
    photoItems: sortColumnItems(photoItems),
    videoItems: sortColumnItems(videoItems),
    otherItems: sortColumnItems(otherItems),
  };
}

/**
 * ScheduleBlockSection - Block Preview v1
 *
 * Renders schedule entries as blocks/cards instead of a table.
 * Consumes buildScheduleProjection output (mode="time") directly.
 *
 * Features:
 * - Time range display (e.g., "6:00 AM–7:00 AM") computed from startMin/durationMinutes
 * - Subtle timeSource indicator "(est)" for derived times (not user-set)
 * - Title / description
 * - Applicability badge: "All Tracks" for kind="all", track names for subset
 * - Category badge for setup/lunch/wrap entries
 * - Subtle conflict indicator (amber icon) when hasConflict=true
 * - Banner-style blocks for shared/all-track entries
 */
// Threshold for showing "Starts X:XX" pre-label in overlap bands
const STARTS_LABEL_THRESHOLD_MIN = 10; // Minimum delta to show "Starts X:XX" label

// Duration rail constants (proportional height within overlap bands)
const RAIL_MIN_PX = 10;
const RAIL_MAX_PX = 44;

/**
 * Compute rail height for an item within a band.
 * The rail height is proportional to the item's span within the band.
 * @param itemStartMin - The item's start time in minutes
 * @param itemDurationMinutes - The item's duration in minutes
 * @param bandStart - The band's start time in minutes
 * @param bandEnd - The band's end time in minutes
 * @returns Rail height in pixels
 */
function computeRailHeight(
  itemStartMin: number | null | undefined,
  itemDurationMinutes: number | null | undefined,
  bandStart: number,
  bandEnd: number
): number {
  const bandSpanMin = Math.max(1, bandEnd - bandStart);

  // Compute item's span within the band (clamped to band boundaries)
  let itemSpanWithinBand = 0;
  if (
    itemStartMin != null &&
    Number.isFinite(itemStartMin) &&
    itemDurationMinutes != null &&
    Number.isFinite(itemDurationMinutes)
  ) {
    const itemEnd = itemStartMin + itemDurationMinutes;
    const clampedStart = Math.max(itemStartMin, bandStart);
    const clampedEnd = Math.min(itemEnd, bandEnd);
    itemSpanWithinBand = Math.max(0, clampedEnd - clampedStart);
  } else if (itemDurationMinutes != null && Number.isFinite(itemDurationMinutes)) {
    // Fallback to raw duration if time bounds unavailable
    itemSpanWithinBand = itemDurationMinutes;
  }

  // If span is 0, return minimum rail height
  if (itemSpanWithinBand <= 0) return RAIL_MIN_PX;

  // Scale proportionally within the band
  const raw = (itemSpanWithinBand / bandSpanMin) * RAIL_MAX_PX;
  return Math.max(RAIL_MIN_PX, Math.min(RAIL_MAX_PX, Math.round(raw)));
}

/**
 * Compute rail height for a single (non-banded) item.
 * Uses a fixed scale based on duration.
 * @param durationMinutes - The item's duration in minutes
 * @returns Rail height in pixels
 */
function computeSingleRailHeight(durationMinutes: number | null | undefined): number {
  if (durationMinutes == null || !Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return RAIL_MIN_PX;
  }
  // Scale: 0.5px per minute, clamped to [RAIL_MIN_PX, RAIL_MAX_PX]
  const raw = durationMinutes * 0.5;
  return Math.max(RAIL_MIN_PX, Math.min(RAIL_MAX_PX, Math.round(raw)));
}

/**
 * Compute the "Starts HH:MM" label for items within a band.
 * Returns null if the item starts at band start or within threshold.
 * @param itemStartMin - The item's start time in minutes from midnight
 * @param bandStartMin - The band's start time in minutes from midnight
 * @returns Label string like "Starts 11:30 AM" or null
 */
function getStartsLabel(itemStartMin: number | null | undefined, bandStartMin: number): string | null {
  if (itemStartMin == null || !Number.isFinite(itemStartMin)) return null;
  const deltaMin = itemStartMin - bandStartMin;
  if (deltaMin < STARTS_LABEL_THRESHOLD_MIN) return null;
  return `Starts ${formatMinutesTo12h(itemStartMin)}`;
}

export function ScheduleBlockSection({ schedule, tracks, blockFields }: ScheduleBlockSectionProps) {
  // Default field visibility (all visible) if not provided
  const fields = blockFields ?? {
    showShotNumber: true,
    showShotName: true,
    showDescription: true,
    showTalent: true,
    showLocation: true,
    showTags: true,
    showNotes: true,
  };
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

  // DEV-ONLY: Log projection sanity data to console for debugging
  // This outputs the EXACT rows being rendered, not a parallel computation
  useMemo(() => {
    if (import.meta.env.DEV && schedule.length > 0) {
      const debugRows = schedule.map((item, index) => ({
        idx: index,
        id: item.id?.slice(0, 8) || "—",
        description: item.description?.slice(0, 30) || "—",
        startMin: item.startMin ?? "—",
        endMin:
          item.startMin != null && item.durationMinutes != null
            ? item.startMin + item.durationMinutes
            : "—",
        timeSource: item.timeSource || "—",
        trackId: item.trackId?.slice(0, 8) || "—",
        applicabilityKind: item.applicabilityKind || "—",
      }));
      console.groupCollapsed(
        `%c[Schedule Projection Sanity] ${schedule.length} rows`,
        "color: #6366f1; font-weight: bold"
      );
      console.table(debugRows);
      console.groupEnd();
    }
  }, [schedule]);

  /**
   * Compute endMin from startMin + durationMinutes.
   * Returns null if either is missing/invalid.
   */
  function getEndMin(item: CallSheetScheduleItem): number | null {
    const { startMin, durationMinutes } = item;
    if (startMin == null || !Number.isFinite(startMin)) return null;
    if (durationMinutes == null || !Number.isFinite(durationMinutes)) return null;
    return startMin + durationMinutes;
  }

  /**
   * Check if an item has valid time bounds for banding.
   */
  function hasValidTimeBounds(item: CallSheetScheduleItem): boolean {
    return (
      item.startMin != null &&
      Number.isFinite(item.startMin) &&
      getEndMin(item) != null
    );
  }

  /**
   * Group schedule items for side-by-side rendering using OVERLAP BANDS.
   *
   * Banding rules:
   * - Banners (isBanner=true or applicabilityKind="all") are ALWAYS full-width
   *   and ALWAYS break bands (flush current band before/after banner)
   * - Non-banner items are grouped into overlap bands:
   *   1. Sort bandable items by (startMin ASC, endMin ASC, id ASC)
   *   2. Sweep algorithm:
   *      - Start new band with first item, track bandEnd = max(endMin)
   *      - Next item joins current band if item.startMin < bandEnd (strict overlap)
   *      - Update bandEnd = max(bandEnd, item.endMin)
   *      - Else flush band and start new one
   * - Items with missing startMin/endMin are rendered as ungrouped singletons
   * - Within a band, original sort order is preserved
   */
  type RenderGroup =
    | { type: "banner"; item: CallSheetScheduleItem }
    | { type: "single"; item: CallSheetScheduleItem }
    | { type: "band"; items: CallSheetScheduleItem[]; bandStart: number; bandEnd: number };

  const renderGroups = useMemo((): RenderGroup[] => {
    if (!schedule.length) return [];

    const groups: RenderGroup[] = [];

    // Pending band items (to be flushed on banner or end)
    let pendingBandItems: CallSheetScheduleItem[] = [];
    let bandEnd: number | null = null;

    /**
     * Flush the current pending band to groups.
     */
    function flushBand() {
      if (pendingBandItems.length === 0) return;

      // Sort band items by (startMin ASC, endMin ASC, id ASC) for stable ordering
      const sorted = [...pendingBandItems].sort((a, b) => {
        const startA = a.startMin ?? 0;
        const startB = b.startMin ?? 0;
        if (startA !== startB) return startA - startB;

        const endA = getEndMin(a) ?? 0;
        const endB = getEndMin(b) ?? 0;
        if (endA !== endB) return endA - endB;

        return (a.id ?? "").localeCompare(b.id ?? "");
      });

      if (sorted.length === 1) {
        groups.push({ type: "single", item: sorted[0] });
      } else {
        // Compute band boundaries for the key
        const bandStart = Math.min(...sorted.map((i) => i.startMin ?? Infinity));
        const computedBandEnd = Math.max(...sorted.map((i) => getEndMin(i) ?? 0));
        groups.push({ type: "band", items: sorted, bandStart, bandEnd: computedBandEnd });
      }

      pendingBandItems = [];
      bandEnd = null;
    }

    // Process items in order (schedule is already sorted by projection)
    for (const item of schedule) {
      const isBanner = item.isBanner || item.applicabilityKind === "all";

      if (isBanner) {
        // Banner always breaks bands - flush first
        flushBand();
        groups.push({ type: "banner", item });
        continue;
      }

      // Check if item has valid time bounds for banding
      if (!hasValidTimeBounds(item)) {
        // No valid time bounds: flush band and render as singleton
        flushBand();
        groups.push({ type: "single", item });
        continue;
      }

      const itemStart = item.startMin!;
      const itemEnd = getEndMin(item)!;

      // Check if item overlaps with current band
      if (bandEnd !== null && itemStart < bandEnd) {
        // Item overlaps with current band - add to band
        pendingBandItems.push(item);
        bandEnd = Math.max(bandEnd, itemEnd);
      } else {
        // No overlap - flush current band and start new one
        flushBand();
        pendingBandItems = [item];
        bandEnd = itemEnd;
      }
    }

    // Flush any remaining band
    flushBand();

    return groups;
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
        {renderGroups.map((group, groupIndex) => {
          if (group.type === "banner") {
            const item = group.item;
            const MarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;
            const applicability = getApplicabilityDisplay(item);
            const category = detectCategory(item.description);
            return (
              <BannerBlock
                key={item.id}
                item={item}
                MarkerIcon={MarkerIcon}
                applicability={applicability}
                category={category}
                fields={fields}
              />
            );
          }

          if (group.type === "single") {
            const item = group.item;
            const MarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;
            const applicability = getApplicabilityDisplay(item);
            const category = detectCategory(item.description);
            const railHeightPx = computeSingleRailHeight(item.durationMinutes);

            // Check if this is a Photo or Video lane item for lane positioning
            const isPhoto = isPhotoTrack(item.trackId, trackNameMap);
            const isVideo = isVideoTrack(item.trackId, trackNameMap);

            // Lane items render half-width with positioning, non-lane items render full-width
            const laneClass = isPhoto
              ? "sm:w-[calc(50%-3px)] sm:mr-auto" // Photo: left half
              : isVideo
                ? "sm:w-[calc(50%-3px)] sm:ml-auto" // Video: right half
                : ""; // Full width

            return (
              <div key={item.id} className={laneClass}>
                <DurationRailWrapper railHeightPx={railHeightPx}>
                  <RegularBlock
                    item={item}
                    MarkerIcon={MarkerIcon}
                    applicability={applicability}
                    category={category}
                    trackNameMap={trackNameMap}
                    fields={fields}
                  />
                </DurationRailWrapper>
              </div>
            );
          }

          // Overlap band: compact stacked-column layout
          // Photo items in left column, Video items in right column
          // Items are stacked vertically with optional "Starts HH:MM" pre-labels
          const { photoItems, videoItems, otherItems } = partitionSimultaneousItems(
            group.items,
            trackNameMap
          );

          // Combine any "other" items into whichever column has fewer items
          // to keep the layout balanced
          const photoWithOther = photoItems.length <= videoItems.length
            ? [...photoItems, ...otherItems]
            : photoItems;
          const videoWithOther = photoItems.length > videoItems.length
            ? [...videoItems, ...otherItems]
            : videoItems;

          // Re-sort after merging to maintain startMin order
          const sortedPhotoItems = sortColumnItems(photoWithOther);
          const sortedVideoItems = sortColumnItems(videoWithOther);

          // Helper to render a stacked card with optional pre-label and duration rail
          const renderStackedCardWithLabel = (item: CallSheetScheduleItem) => {
            const MarkerIcon = item.marker?.icon ? MARKER_ICON_MAP[item.marker.icon] : null;
            const applicability = getApplicabilityDisplay(item);
            const category = detectCategory(item.description);
            const startsLabel = getStartsLabel(item.startMin, group.bandStart);
            const railHeightPx = computeRailHeight(
              item.startMin,
              item.durationMinutes,
              group.bandStart,
              group.bandEnd
            );

            return (
              <div key={item.id}>
                {/* Pre-label for items starting after band start */}
                {startsLabel && (
                  <div className="text-[10px] text-gray-400 flex items-center gap-1 mb-0.5 ml-3">
                    <span className="inline-block h-1 w-1 rounded-full bg-gray-300/70" />
                    <span>{startsLabel}</span>
                  </div>
                )}
                <DurationRailWrapper railHeightPx={railHeightPx}>
                  <RegularBlock
                    item={item}
                    MarkerIcon={MarkerIcon}
                    applicability={applicability}
                    category={category}
                    trackNameMap={trackNameMap}
                    fields={fields}
                  />
                </DurationRailWrapper>
              </div>
            );
          };

          const hasItems = sortedPhotoItems.length > 0 || sortedVideoItems.length > 0;

          return (
            <div key={`band-${group.bandStart}-${group.bandEnd}-${groupIndex}`}>
              {/* Compact 2-column stacked layout for Photo (left) and Video (right) */}
              {hasItems && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-1.5 gap-y-1.5">
                  {/* Photo column (left) - stacked flex container */}
                  <div className="flex flex-col gap-1.5">
                    {sortedPhotoItems.map(renderStackedCardWithLabel)}
                  </div>
                  {/* Video column (right) - stacked flex container */}
                  <div className="flex flex-col gap-1.5">
                    {sortedVideoItems.map(renderStackedCardWithLabel)}
                  </div>
                </div>
              )}
            </div>
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
  fields: ScheduleBlockFields;
}

/**
 * DurationRailWrapper - Wraps a card with a proportional duration rail on the left.
 */
function DurationRailWrapper({
  railHeightPx,
  children,
}: {
  railHeightPx: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2">
      <div className="w-1 flex items-start justify-center pt-2">
        <div
          className="w-[2px] rounded-full bg-gray-200"
          style={{ height: railHeightPx }}
        />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

/**
 * BannerBlock - Full-width banner for shared/all-track entries
 */
function BannerBlock({ item, MarkerIcon, applicability, category, fields }: BlockProps) {
  const categoryStyles = getCategoryStyles(category);
  const timeRange = getTimeRangeDisplay(item);
  const isDerived = item.timeSource === "derived";

  // Get color tag for accent styling
  const colorTag = getColorTag(item.colorKey);

  // Banner display title - NOT affected by shot field toggles per requirements
  // Banners/custom entries must always show their title regardless of shot toggles
  // They use item.description which contains customData.title for custom entries
  const displayTitle = item.description || null;

  return (
    <div
      className={`
        relative flex items-center gap-3 px-3 py-2.5 rounded-md border
        ${categoryStyles.border} ${categoryStyles.bg}
        print:border-gray-300 print:bg-gray-50
        ${colorTag ? "border-l-[3px]" : ""}
      `}
      style={colorTag ? { borderLeftColor: colorTag.value } : undefined}
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

      {/* Time range with timeSource indicator */}
      <div className="flex-shrink-0 flex items-center gap-1">
        <span className={`text-sm font-bold ${categoryStyles.text}`}>
          {timeRange}
        </span>
        {isDerived && (
          <span
            className="text-[9px] text-gray-400 italic print:text-gray-500"
            title="Time derived from schedule order"
          >
            (est)
          </span>
        )}
      </div>

      {/* Separator line */}
      <div className={`flex-1 h-px ${categoryStyles.line}`} />

      {/* Description (conditional based on fields, but banners usually always show title) */}
      {displayTitle && (
        <div className="flex-shrink-0 text-sm font-semibold uppercase tracking-wide text-gray-700">
          {displayTitle}
        </div>
      )}

      {/* Separator line */}
      <div className={`flex-[0.3] h-px ${categoryStyles.line}`} />

      {/* Applicability badge with color dot */}
      {applicability.label && (
        <span className="flex-shrink-0 inline-flex items-center gap-1.5">
          {colorTag && (
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0 print:print-color-adjust-exact"
              style={{ backgroundColor: colorTag.value }}
            />
          )}
          <span className="inline-flex items-center rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-600 print:bg-slate-100">
            {applicability.label}
          </span>
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
function RegularBlock({ item, MarkerIcon, applicability, category, trackNameMap, fields }: RegularBlockProps) {
  const trackName = item.trackId && trackNameMap[item.trackId] ? trackNameMap[item.trackId] : null;
  const timeRange = getTimeRangeDisplay(item);
  const isDerived = item.timeSource === "derived";

  // Get color tag for accent styling
  const colorTag = getColorTag(item.colorKey);

  // Build display title based on field visibility
  // Use separate fields (shotNumber, shotTitle) for fine-grained control
  // IMPORTANT: Do NOT fall back to item.description - toggles must be authoritative
  const displayTitle = (() => {
    const parts: string[] = [];
    if (fields.showShotNumber && item.shotNumber) {
      parts.push(item.shotNumber);
    }
    if (fields.showShotName && item.shotTitle) {
      parts.push(item.shotTitle);
    }
    // Return joined parts or null if both are hidden
    // Never fall back to item.description - that would override toggle state
    return parts.length > 0 ? parts.join(" — ") : null;
  })();

  // Check if we have any content to show
  const showTalent = fields.showTalent && item.cast && item.cast !== "—";
  // Notes uses showNotes toggle (not showDescription)
  const showNotes = fields.showNotes && item.notes && item.notes !== "—";
  // Description from shot.description (separate from notes)
  const showDescription = fields.showDescription && item.shotDescription;
  const showLocation = fields.showLocation && item.location;
  // Tags from shot (array of {id, label, color})
  const showTags = fields.showTags && Array.isArray(item.tags) && item.tags.length > 0;

  return (
    <div
      className={`
        relative px-3 py-2 rounded-md border bg-white shadow-sm
        border-slate-200 hover:border-slate-300
        print:shadow-none print:border-gray-300
        ${colorTag ? "border-l-[3px]" : ""}
      `}
      style={colorTag ? { borderLeftColor: colorTag.value } : undefined}
    >
      {/* Header row: Time range + Track/Applicability */}
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

          {/* Time range with timeSource indicator */}
          <span className="text-sm font-semibold text-gray-900">{timeRange}</span>
          {isDerived && (
            <span
              className="text-[9px] text-gray-400 italic print:text-gray-500"
              title="Time derived from schedule order"
            >
              (est)
            </span>
          )}

          {/* Track chip for single-track entries with color dot */}
          {trackName && (
            <span className="inline-flex items-center gap-1">
              {colorTag && (
                <span
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0 print:print-color-adjust-exact"
                  style={{ backgroundColor: colorTag.value }}
                />
              )}
              <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {trackName}
              </span>
            </span>
          )}

          {/* Applicability badge for subset entries with color dot */}
          {applicability.label && applicability.kind === "subset" && (
            <span className="inline-flex items-center gap-1">
              {!trackName && colorTag && (
                <span
                  className="inline-block h-2 w-2 rounded-full flex-shrink-0 print:print-color-adjust-exact"
                  style={{ backgroundColor: colorTag.value }}
                />
              )}
              <span className="inline-flex items-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 print:bg-blue-50">
                {applicability.label}
              </span>
            </span>
          )}

          {/* Category badge */}
          {category && (
            <CategoryBadge category={category} />
          )}
        </div>
      </div>

      {/* Title row (conditional based on fields) */}
      {displayTitle && (
        <h4 className="text-sm font-medium text-gray-800 leading-snug">
          {displayTitle}
        </h4>
      )}

      {/* Description from shot.description (conditional based on showDescription toggle) */}
      {showDescription && (
        <p className="mt-1 text-xs text-gray-600 leading-relaxed">
          {item.shotDescription}
        </p>
      )}

      {/* Tags from shot (conditional based on showTags toggle) */}
      {showTags && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {item.tags!.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium print:print-color-adjust-exact"
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color,
                border: `1px solid ${tag.color}40`,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.label}
            </span>
          ))}
        </div>
      )}

      {/* Cast & Notes (conditional based on fields) */}
      {(showTalent || showNotes) && (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
          {showTalent && (
            <span>Cast: {item.cast}</span>
          )}
          {showNotes && (
            <span className="truncate max-w-[200px]" title={item.notes}>
              Notes: {item.notes}
            </span>
          )}
        </div>
      )}

      {/* Location (conditional based on fields) */}
      {showLocation && item.location && (
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
