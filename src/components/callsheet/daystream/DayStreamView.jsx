import React, { useMemo, useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core";
import {
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Plus, Camera, Flag, ChevronDown, Clock } from "lucide-react";
import DayStreamBanner from "./DayStreamBanner";
import DayStreamSwimlane from "./DayStreamSwimlane";
import DayStreamBlock from "./DayStreamBlock"; // For overlay
import UnscheduledTray from "./UnscheduledTray";
import NeedsAttentionTray from "./NeedsAttentionTray";
import { parseTimeToMinutes, minutesToTimeString } from "../../../lib/timeUtils";
import { buildScheduleProjection } from "../../../lib/callsheet/buildScheduleProjection";
import { hasExplicitStartTime, parseTimeToMinutes as parseEntryTime } from "../../../lib/callsheet/getEntryMinutes";
import { isBannerEntry } from "../../../lib/callsheet/isBannerEntry";

import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

/**
 * Get the time source field name for an entry (for diagnostic logging).
 * Returns which field provided the explicit time, or "none" if no valid time.
 */
function getTimeSourceField(entry) {
  if (entry.startTimeCanonical && parseEntryTime(entry.startTimeCanonical) !== null) {
    return "startTimeCanonical";
  }
  if (entry.startTime && parseEntryTime(entry.startTime) !== null) {
    return "startTime";
  }
  if (entry.time && parseEntryTime(entry.time) !== null) {
    return "time";
  }
  return "none";
}

/**
 * DayStreamView (V2)
 * 
 * Now includes Drag & Drop Context.
 */
export default function DayStreamView({
  scheduleId,
  resolvedEntries = [],
  tracks = [],
  onEditEntry,
  onReorderEntry, // (entryId, oldIndex, newIndex)
  onMoveEntryToTrack, // (entryId, newTrackId, newIndex)
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  readOnly = false,
}) {
  const [activeDragId, setActiveDragId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const visibleTracks = useMemo(() => {
    return tracks.filter(t => t.id !== "shared" && t.scope !== "shared");
  }, [tracks]);

  // Build set of valid track IDs for quick lookup
  const visibleTrackIds = useMemo(() => {
    return new Set(visibleTracks.map(t => t.id));
  }, [visibleTracks]);

  // --- Use canonical projection as single source of truth for time placement ---
  // This ensures unscheduled definition matches preview: entries with no time placement
  const projection = useMemo(() => {
    return buildScheduleProjection({
      entries: resolvedEntries || [],
      tracks: tracks || [],
      options: {
        mode: "time",
        fallbackStartMin: 420, // 7:00 AM default
        defaultDurationMin: 15,
        context: "DayStreamView",
      },
    });
  }, [resolvedEntries, tracks]);

  // DEV-ONLY: Log entry IDs for easier debugging (one-time)
  const loggedEntryIdsRef = useRef(false);
  if (import.meta.env.DEV && !loggedEntryIdsRef.current && projection.tableRows.length > 0) {
    const ids = projection.tableRows.map(r => r.id);
    console.log("[DayStreamView] Entry IDs for debug:", ids.join(", "));
    console.log("[DayStreamView] First entry ID prefix (use for debugMissingProjectionRow):", ids[0]?.substring(0, 8));
    loggedEntryIdsRef.current = true;
  }

  // Track whether we've logged the debug forcing message (dedupe)
  const debugForcedLogRef = useRef(false);

  // Build a map of entry ID -> projection row for deterministic O(1) lookup
  // Stores full row to allow access to timeSource, startMin, durationMinutes
  const rowsById = useMemo(() => {
    const map = new Map();
    for (const row of projection.tableRows) {
      map.set(row.id, row);
    }

    // DEV-ONLY: Force missing projection row for testing NeedsAttentionTray
    // Usage: ?debugMissingProjectionRow=<prefix>
    // Will delete the first row whose id starts with the prefix
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      const debugPrefix = params.get("debugMissingProjectionRow");
      if (debugPrefix) {
        for (const [id] of map) {
          if (id.startsWith(debugPrefix)) {
            map.delete(id);
            // Log once per session (deduped)
            if (!debugForcedLogRef.current) {
              console.log(`[DayStreamView] DEBUG forcing missing projection row for id=${id}`);
              debugForcedLogRef.current = true;
            }
            break; // Only delete first match
          }
        }
      }
    }

    return map;
  }, [projection.tableRows]);

  // Track warned IDs to dedupe dev warnings (persists across renders)
  const warnedMissingIdsRef = useRef(new Set());

  // --- Three-bucket classification ---
  // A) scheduledEntries: entry has explicit start time (hasExplicitStartTime) OR is a banner
  // B) unscheduledEntries: entry has NO explicit start time AND is not a banner
  // C) needsAttentionEntries: entry is missing from projection rowsById (DEV-only surface)

  // --- Needs Attention Entries (DEV-only) ---
  // Entries missing from projection rowsById - couldn't be projected
  // Note: Missing is missing - show ALL missing entries including banners (just labeled accordingly)
  const { needsAttentionEntries, needsAttentionDiagnostics } = useMemo(() => {
    const entries = [];
    const diagnostics = new Map();

    for (const entry of resolvedEntries) {
      const row = rowsById.get(entry.id);
      if (!row) {
        // Entry missing from projection
        const hasTime = hasExplicitStartTime(entry);
        const timeSourceField = getTimeSourceField(entry);

        entries.push(entry);
        diagnostics.set(entry.id, {
          timeField: timeSourceField,
          hasExplicitTime: hasTime,
          isBanner: isBannerEntry(entry),
        });

        // Warn once per ID (dev only) with detailed info
        if (import.meta.env.DEV && !warnedMissingIdsRef.current.has(entry.id)) {
          const isBanner = isBannerEntry(entry);
          console.warn(
            `[DayStreamView] Entry missing from projection | id="${entry.id}" | hasExplicitTime=${hasTime} | timeField="${timeSourceField}" | isBanner=${isBanner}`
          );
          warnedMissingIdsRef.current.add(entry.id);
        }
      }
    }

    return { needsAttentionEntries: entries, needsAttentionDiagnostics: diagnostics };
  }, [resolvedEntries, rowsById]);

  // --- Unscheduled Entries ---
  // An entry is "unscheduled" if it has NO explicit start time (user hasn't set a time).
  // Note: buildScheduleProjection derives times for ALL entries via getSequenceMinutes,
  // so timeSource is always "explicit" or "derived", never "none".
  // We use hasExplicitStartTime() to check if the USER set a time vs system-derived.
  // Entries missing from projection go to needsAttention, NOT here.
  // Banners are never unscheduled.
  const unscheduledEntries = useMemo(() => {
    return resolvedEntries.filter(entry => {
      // Banners are never "unscheduled" - they span all tracks
      if (isBannerEntry(entry)) {
        return false;
      }
      // Check if entry is in projection (sanity check)
      const row = rowsById.get(entry.id);
      if (!row) {
        // Entry missing from projection - goes to needsAttention, NOT unscheduled
        return false;
      }
      // Unscheduled = no explicit start time set by user
      return !hasExplicitStartTime(entry);
    });
  }, [resolvedEntries, rowsById]);

  // --- Scheduled entries (for lane cards only) ---
  // Entries are scheduled if they have an EXPLICIT start time (user set a time).
  // Entries missing from projection go to needsAttention, NOT here.
  // Banners are EXCLUDED - they render as full-width shared rows, not lane cards.
  const scheduledEntries = useMemo(() => {
    return resolvedEntries.filter(entry => {
      // Banners render as full-width shared rows, not in lane columns
      if (isBannerEntry(entry)) {
        return false;
      }
      // Check if entry is in projection (sanity check)
      const row = rowsById.get(entry.id);
      if (!row) {
        // Entry missing from projection - goes to needsAttention, NOT scheduled
        return false;
      }
      // Scheduled = has explicit start time set by user
      return hasExplicitStartTime(entry);
    });
  }, [resolvedEntries, rowsById]);

  // --- Banner entries (sorted by start time) ---
  const bannerEntries = useMemo(() => {
    return resolvedEntries
      .filter(entry => isBannerEntry(entry))
      .sort((a, b) => {
        const timeA = parseTimeToMinutes(a.startTime);
        const timeB = parseTimeToMinutes(b.startTime);
        if (timeA !== timeB) return timeA - timeB;
        return (a.order || 0) - (b.order || 0);
      });
  }, [resolvedEntries]);

  // --- Timeline entries (scheduled + banners for chronological rendering) ---
  // This combines scheduled lane entries with banners for the day stream timeline.
  // Banners appear as full-width shared rows, lane entries appear in swimlane segments.
  const timelineEntries = useMemo(() => {
    // Include both scheduled entries (lane cards) and banners (shared rows)
    const entries = [...scheduledEntries, ...bannerEntries];
    return entries;
  }, [scheduledEntries, bannerEntries]);

  // --- Segmentation Logic ---
  // Use timelineEntries (scheduled + banners) for chronological timeline rendering.
  // Banners create visual breaks as full-width shared rows.
  // Lane entries are grouped into segments between banners.
  const dayNodes = useMemo(() => {
    if (!timelineEntries.length) return [];

    const sorted = [...timelineEntries].sort((a, b) => {
      const timeA = parseTimeToMinutes(a.startTime);
      const timeB = parseTimeToMinutes(b.startTime);
      if (timeA !== timeB) return timeA - timeB;
      return (a.order || 0) - (b.order || 0);
    });

    const nodes = [];
    let currentSegment = { type: "segment", entries: [] };

    sorted.forEach((entry) => {
      if (isBannerEntry(entry)) {
        if (currentSegment.entries.length > 0) nodes.push(currentSegment);
        nodes.push({ type: "banner", entry });
        currentSegment = { type: "segment", entries: [] };
      } else {
        currentSegment.entries.push(entry);
      }
    });

    if (currentSegment.entries.length > 0) nodes.push(currentSegment);
    return nodes;
  }, [timelineEntries]);

  // --- Drag Handlers ---
  const handleDragStart = (event) => {
    setActiveDragId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    // Find dragged entry
    const activeEntry = resolvedEntries.find(e => e.id === active.id);
    if (!activeEntry) return;

    // Check if dropping back to unscheduled tray (move OUT of timeline)
    if (over.id === "__unscheduled__") {
      // If entry was in a track and is being moved to unscheduled,
      // clear its trackId via onMoveEntryToTrack with null
      if (activeEntry.trackId && onMoveEntryToTrack) {
        onMoveEntryToTrack(active.id, null, 0);
      }
      return;
    }

    let targetTrackId = null;
    let targetIndex = 0;

    // Determine destination track and rough index
    // 1. Dropped on a Track container (empty lane or specifically targeted)
    const track = tracks.find(t => t.id === over.id);
    if (track) {
      targetTrackId = track.id;
      // Append to end of this track
      const trackEntries = resolvedEntries.filter(e => e.trackId === targetTrackId);
      targetIndex = trackEntries.length;
    } else {
      // 2. Dropped on another item
      const overEntry = resolvedEntries.find(e => e.id === over.id);
      if (overEntry) {
        targetTrackId = overEntry.trackId;

        // Find Sort Order for target track
        const trackEntries = resolvedEntries
          .filter(e => e.trackId === targetTrackId)
          .sort((a, b) => {
            const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
            const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
            if (aOrder !== bOrder) return aOrder - bOrder;
            return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
          });

        const overIndex = trackEntries.findIndex(e => e.id === over.id);

        // If dropping relative to an item, we usually want to insert *before* it if moving down/new, or simply take its index.
        // dnd-kit's sortable strategy is usually "swap" visual but strict index logic:
        targetIndex = overIndex >= 0 ? overIndex : trackEntries.length;
      }
    }

    if (!targetTrackId) return;

    // Check if entry was unscheduled (no trackId) - this is a "schedule" action
    const wasUnscheduled = !activeEntry.trackId || !visibleTrackIds.has(activeEntry.trackId);

    // Case 1a: Move from UNSCHEDULED to a track - must set explicit start time
    if (wasUnscheduled) {
      // Compute explicit start time based on target track's scheduled entries
      // Find max endMin among scheduled entries in the target track
      const fallbackStartMin = 420; // 7:00 AM default (matches projection options)

      // Get entries in target track with explicit times
      const targetTrackScheduledRows = projection.tableRows.filter(
        (row) => row.trackId === targetTrackId && row.timeSource === "explicit"
      );

      let explicitStartMin;
      if (targetTrackScheduledRows.length > 0) {
        // Place after the last scheduled entry in this track
        const maxEndMin = targetTrackScheduledRows.reduce((max, row) => {
          const endMin = (row.startMin ?? 0) + (row.durationMinutes ?? 15);
          return Math.max(max, endMin);
        }, 0);
        explicitStartMin = maxEndMin;
      } else {
        // No scheduled entries in track - use day start fallback
        explicitStartMin = fallbackStartMin;
      }

      const explicitStartTime = minutesToTimeString(explicitStartMin);

      // Use onUpdateEntry to set BOTH trackId AND explicit startTime atomically
      // This ensures the entry becomes "scheduled" (hasExplicitStartTime will return true)
      if (onUpdateEntry) {
        onUpdateEntry(active.id, {
          trackId: targetTrackId,
          startTime: explicitStartTime
        });
      }
      return;
    }

    // Case 1b: Move between tracks (already scheduled entry)
    if (activeEntry.trackId !== targetTrackId) {
      if (onMoveEntryToTrack) {
        onMoveEntryToTrack(active.id, targetTrackId, targetIndex);
      }
      return;
    }

    // Case 2: Reorder within same track
    // Need old index
    const trackEntries = resolvedEntries
      .filter(e => e.trackId === activeEntry.trackId)
      .sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
      });

    const oldIndex = trackEntries.findIndex(e => e.id === active.id);

    if (oldIndex !== targetIndex && onReorderEntry) {
      onReorderEntry(active.id, oldIndex, targetIndex);
    }
  };

  const activeEntry = activeDragId ? resolvedEntries.find(e => e.id === activeDragId) : null;

  // Get the first lane track for default shot creation
  const firstLaneTrack = useMemo(() => {
    return visibleTracks[0] || null;
  }, [visibleTracks]);

  // Handle add actions
  const handleAddShot = () => {
    if (firstLaneTrack && onAddEntry) {
      onAddEntry(firstLaneTrack.id);
    }
  };

  const handleAddBanner = () => {
    if (onAddEntry) {
      onAddEntry("custom");
    }
  };

  // Quick add banner with default values (no modal)
  const handleAddQuickBanner = () => {
    if (onAddEntry) {
      // Pass "banner" to signal quick banner creation with defaults
      // This will be handled by CallSheetBuilder to create a banner entry directly
      onAddEntry("banner");
    }
  };

  // Add unscheduled shot (no trackId assigned yet)
  const handleAddUnscheduled = () => {
    if (onAddEntry) {
      onAddEntry(null); // null trackId = unscheduled
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full max-w-6xl mx-auto p-8 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <div className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            Day Stream
          </div>
          <div className="flex items-center gap-3">
            {!readOnly && (
              <span className="text-xs text-slate-400">
                Drag cards to reorder.
              </span>
            )}
            {!readOnly && onAddEntry && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    Add
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={handleAddShot}
                    disabled={!firstLaneTrack}
                    className="gap-2"
                  >
                    <Camera className="h-4 w-4 text-amber-500" />
                    <span>Shot</span>
                    <span className="ml-auto text-xs text-slate-400">Lane block</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleAddUnscheduled}
                    className="gap-2"
                  >
                    <Clock className="h-4 w-4 text-slate-400" />
                    <span>Unscheduled</span>
                    <span className="ml-auto text-xs text-slate-400">Draft</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleAddBanner}
                    className="gap-2"
                  >
                    <Flag className="h-4 w-4 text-blue-500" />
                    <span>Banner</span>
                    <span className="ml-auto text-xs text-slate-400">All tracks</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {/* Needs Attention Tray (DEV-only) - shown when entries are missing from projection */}
        {import.meta.env.DEV && needsAttentionEntries.length > 0 && (
          <NeedsAttentionTray
            entries={needsAttentionEntries}
            diagnosticInfoMap={needsAttentionDiagnostics}
            onEditEntry={onEditEntry}
          />
        )}

        {/* Unscheduled Tray - shown when there are unscheduled entries */}
        {unscheduledEntries.length > 0 && (
          <UnscheduledTray
            entries={unscheduledEntries}
            onEditEntry={onEditEntry}
          />
        )}

        {/* Day Stream Timeline - banners appear inline as full-width shared rows */}
        <div className="flex flex-col gap-3 relative">
          {dayNodes.map((node, index) => {
            if (node.type === "banner") {
              return (
                <DayStreamBanner
                  key={node.entry.id}
                  entry={node.entry}
                  onEdit={readOnly ? null : () => onEditEntry && onEditEntry(node.entry)}
                  onUpdateEntry={readOnly ? null : onUpdateEntry}
                  onDeleteEntry={readOnly ? null : onDeleteEntry}
                />
              );
            }

            return (
              <div key={`segment-${index}`} className="flex border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
                {visibleTracks.map(track => {
                  return (
                    <DayStreamSwimlane
                      key={track.id}
                      track={track}
                      entries={node.entries.filter(e => e.trackId === track.id)}
                      onEditEntry={onEditEntry}
                      onUpdateEntry={onUpdateEntry}
                      onDeleteEntry={readOnly ? null : onDeleteEntry}
                      onAddEntry={onAddEntry}
                    />
                  );
                })}
              </div>
            );
          })}

          {dayNodes.length === 0 && (
            <div className="p-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg">
              <p>Day is empty.</p>
              <button
                onClick={() => onAddEntry?.("custom", "setup")}
                className="mt-4 text-primary font-medium hover:underline"
              >
                Start by adding a Call Time
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeEntry ? (
          <div className="opacity-80 rotate-2 scale-105 cursor-grabbing mix-blend-multiply">
            <DayStreamBlock entry={activeEntry} tracks={tracks} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
