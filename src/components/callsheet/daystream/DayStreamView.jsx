import React, { useMemo, useState } from "react";
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
import { Plus, Camera, Flag, ChevronDown } from "lucide-react";
import DayStreamBanner from "./DayStreamBanner";
import DayStreamSwimlane from "./DayStreamSwimlane";
import DayStreamBlock from "./DayStreamBlock"; // For overlay
import { parseTimeToMinutes } from "../../../lib/timeUtils";
import { Button } from "../../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

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

  // --- Segmentation Logic ---
  const dayNodes = useMemo(() => {
    if (!resolvedEntries.length) return [];

    const sorted = [...resolvedEntries].sort((a, b) => {
      const timeA = parseTimeToMinutes(a.startTime);
      const timeB = parseTimeToMinutes(b.startTime);
      if (timeA !== timeB) return timeA - timeB;
      return (a.order || 0) - (b.order || 0);
    });

    const nodes = [];
    let currentSegment = { type: "segment", entries: [] };

    sorted.forEach((entry) => {
      const isBanner =
        entry.type === "custom" &&
        (entry.role === "banner" || !entry.trackId || entry.trackId === "all");

      if (isBanner) {
        if (currentSegment.entries.length > 0) nodes.push(currentSegment);
        nodes.push({ type: "banner", entry });
        currentSegment = { type: "segment", entries: [] };
      } else {
        currentSegment.entries.push(entry);
      }
    });

    if (currentSegment.entries.length > 0) nodes.push(currentSegment);
    return nodes;
  }, [resolvedEntries]);

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

    // Case 1: Move between tracks
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full max-w-6xl mx-auto p-8 space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
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

        <div className="flex flex-col gap-6 relative">
          {dayNodes.map((node, index) => {
            if (node.type === "banner") {
              return (
                <DayStreamBanner
                  key={node.entry.id}
                  entry={node.entry}
                  onEdit={() => onEditEntry && onEditEntry(node.entry)}
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
