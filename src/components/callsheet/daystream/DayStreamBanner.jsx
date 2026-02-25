import React, { useState, useRef, useEffect } from "react";
import {
  Trash2,
  ChevronDown,
  Check,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { parseTimeToMinutes, minutesToTimeString } from "../../../lib/timeUtils";
import { getColorTag } from "../../../types/schedule";
import { MARKER_ICON_MAP } from "../../../lib/markerIcons";
import ColorTagPicker from "./ColorTagPicker";
import MarkerPicker from "./MarkerPicker";
import { TimePicker } from "../../ui/TimePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

/**
 * Format time range as "6:00 AM–7:00 AM"
 * @param {string} startTime - Start time in HH:MM format
 * @param {number} duration - Duration in minutes
 * @returns {string} Formatted time range
 */
function formatTimeRange(startTime, duration) {
    if (!startTime) return "";

    const startMinutes = parseTimeToMinutes(startTime);
    if (startMinutes === null) return startTime;

    const endMinutes = startMinutes + (duration || 0);

    // Format to 12h
    const formatTo12h = (mins) => {
        const h = Math.floor(mins / 60) % 24;
        const m = mins % 60;
        const ampm = h >= 12 ? "PM" : "AM";
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
        return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
    };

    return `${formatTo12h(startMinutes)}–${formatTo12h(endMinutes)}`;
}

/**
 * DayStreamBanner
 *
 * Represents a shared event that applies to the whole day (Call, Lunch, Wrap).
 * Acts as a visual section break with full-width strip appearance.
 * Supports inline editing via double-click.
 *
 * Banners can be assigned to:
 * - "All Tracks" (trackId = "all" or "shared") - renders as full-width banner
 * - A specific track (trackId = track.id) - will re-render in that track's lane
 */
export default function DayStreamBanner({ entry, tracks = [], onEdit, onUpdateEntry, onDeleteEntry }) {
    // Filter to lane tracks only (exclude shared scope tracks)
    const laneTracks = tracks.filter(t => t.scope !== "shared" && t.id !== "shared");
    const isWrap = entry.resolvedTitle?.toLowerCase().includes("wrap");
    const isMeal = entry.resolvedTitle?.toLowerCase().includes("lunch") || entry.resolvedTitle?.toLowerCase().includes("break");
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

    const handleDeleteClick = (e) => {
        e.stopPropagation();
        setIsConfirmingDelete(true);
    };

    const handleConfirmDelete = (e) => {
        e.stopPropagation();
        if (onDeleteEntry) {
            onDeleteEntry(entry.id);
        }
        setIsConfirmingDelete(false);
    };

    const handleCancelDelete = (e) => {
        e.stopPropagation();
        setIsConfirmingDelete(false);
    };

    // Inline editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(entry.customData?.title || entry.resolvedTitle || "");
    const [editStartTime, setEditStartTime] = useState(entry.startTime || "");
    const [editDuration, setEditDuration] = useState(entry.duration || 30);
    const [editColorKey, setEditColorKey] = useState(entry.colorKey || null);
    const [editMarker, setEditMarker] = useState(entry.marker || null);
    // Track selection: "all" means All Tracks, otherwise specific track ID
    const [editTrackId, setEditTrackId] = useState(
        entry.trackId === "shared" || entry.trackId === "all" ? "all" : (entry.trackId || "all")
    );
    const titleInputRef = useRef(null);

    // Ref to track latest editStartTime value, bypassing React's batching
    // This ensures handleSave reads the correct value even when blur and click
    // events fire in rapid succession (React 18 batching race condition)
    const editStartTimeRef = useRef(entry.startTime || "");

    // Get the color tag for styling
    const colorTag = getColorTag(entry.colorKey);

    // Sync local edit state from entry props ONLY when not actively editing.
    // This prevents Firestore real-time updates from overwriting user's typed input.
    useEffect(() => {
        if (isEditing) return; // Don't sync while user is editing
        setEditTitle(entry.customData?.title || entry.resolvedTitle || "");
        setEditStartTime(entry.startTime || "");
        editStartTimeRef.current = entry.startTime || ""; // Keep ref in sync
        setEditDuration(entry.duration || 30);
        setEditColorKey(entry.colorKey || null);
        setEditMarker(entry.marker || null);
        setEditTrackId(
            entry.trackId === "shared" || entry.trackId === "all" ? "all" : (entry.trackId || "all")
        );
    }, [isEditing, entry.customData?.title, entry.resolvedTitle, entry.startTime, entry.duration, entry.colorKey, entry.marker, entry.trackId]);

    // Get the selected track for display
    const selectedTrack = editTrackId === "all" ? null : laneTracks.find(t => t.id === editTrackId);

    // Focus title input when entering edit mode
    useEffect(() => {
        if (isEditing && titleInputRef.current) {
            titleInputRef.current.focus();
            titleInputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = (e) => {
        if (e) e.stopPropagation();
        setIsEditing(false);

        if (import.meta.env.DEV) {
            console.log(`[DayStreamBanner] handleSave called:`, {
                entryId: entry.id,
                editStartTime,
                entryStartTime: entry.startTime,
            });
        }

        if (!onUpdateEntry) return;

        const updates = {};

        // Update title via customData
        if (editTitle !== (entry.customData?.title || entry.resolvedTitle)) {
            updates.customData = { ...entry.customData, title: editTitle };
        }

        // Update duration
        const newDuration = parseInt(editDuration) || 30;
        if (newDuration !== entry.duration) {
            updates.duration = newDuration;
        }

        // Update start time
        // Use ref instead of state to bypass React batching race condition
        const normalizedEditTime = editStartTimeRef.current.trim();
        const normalizedEntryTime = (entry.startTime || "").trim();
        if (import.meta.env.DEV) {
            console.log(`[DayStreamBanner] handleSave: comparing times:`, {
                refValue: editStartTimeRef.current,
                stateValue: editStartTime,
                entryValue: entry.startTime,
            });
        }
        if (normalizedEditTime !== normalizedEntryTime) {
            if (normalizedEditTime) {
                const minutes = parseTimeToMinutes(normalizedEditTime);
                updates.startTime = minutesToTimeString(minutes);
            } else {
                updates.startTime = "";
            }
        }

        // Update track assignment
        // "all" becomes "all" in storage (isBannerEntry checks for "all" or "shared")
        // specific track ID is stored directly
        const currentTrackId = entry.trackId === "shared" || entry.trackId === "all" ? "all" : entry.trackId;
        if (editTrackId !== currentTrackId) {
            updates.trackId = editTrackId;
            // Always clear appliesToTrackIds when track assignment changes to avoid stale state
            updates.appliesToTrackIds = null;
        }

        // Handle color tag updates
        if (editColorKey !== (entry.colorKey || null)) {
            updates.colorKey = editColorKey;
        }

        // Handle marker updates
        const currentMarker = entry.marker || null;
        const newMarker = editMarker || null;
        const markerChanged =
            (currentMarker === null && newMarker !== null) ||
            (currentMarker !== null && newMarker === null) ||
            (currentMarker && newMarker && (currentMarker.icon !== newMarker.icon || currentMarker.color !== newMarker.color));
        if (markerChanged) {
            updates.marker = newMarker;
        }

        if (Object.keys(updates).length > 0) {
            // DEV-only: Validate startTime format before saving
            if (import.meta.env.DEV && updates.startTime !== undefined) {
                const timePattern = /^(?:[01]?\d|2[0-3]):[0-5]\d$/;
                if (updates.startTime && !timePattern.test(updates.startTime)) {
                    console.warn(
                        `[DayStreamBanner] Invalid startTime format detected: "${updates.startTime}". ` +
                        `Expected HH:MM format. Entry ID: ${entry.id}`
                    );
                }
            }
            if (import.meta.env.DEV) {
                console.log(`[DayStreamBanner] handleSave: calling onUpdateEntry with:`, updates);
            }
            onUpdateEntry(entry.id, updates);
        } else {
            if (import.meta.env.DEV) {
                console.log(`[DayStreamBanner] handleSave: no updates to save`);
            }
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSave(e);
        }
        if (e.key === "Escape") {
            setIsEditing(false);
            setEditTitle(entry.customData?.title || entry.resolvedTitle || "");
            setEditStartTime(entry.startTime || "");
            editStartTimeRef.current = entry.startTime || ""; // Reset ref too
            setEditDuration(entry.duration || 30);
            setEditColorKey(entry.colorKey || null);
            setEditMarker(entry.marker || null);
            setEditTrackId(
                entry.trackId === "shared" || entry.trackId === "all" ? "all" : (entry.trackId || "all")
            );
            e.stopPropagation();
        }
    };

    const handleDoubleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onUpdateEntry) {
            setIsEditing(true);
        }
    };

    // Time range display
    const timeRange = formatTimeRange(entry.startTime, entry.duration);

    // Editing mode UI
    if (isEditing) {
        return (
            <div
                className={cn(
                    "relative flex flex-col gap-3 py-3 px-4 my-2 rounded-lg transition-colors w-full",
                    "bg-blue-50 border-2 border-blue-400 ring-2 ring-blue-100"
                )}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Row 1: Title Input (Full Width) */}
                <div className="w-full">
                    <input
                        ref={titleInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full text-sm font-bold uppercase tracking-wide border border-slate-300 rounded px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                        placeholder="Banner title"
                    />
                </div>

                {/* Row 2: Time, Duration & Track (Side by side) */}
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Time Input */}
                    <div className="flex items-center gap-2">
                        <TimePicker
                            label="Time"
                            value={editStartTime || null}
                            onChange={(value) => {
                                const newValue = value || "";
                                if (import.meta.env.DEV) {
                                    console.log(`[DayStreamBanner] TimePicker onChange received:`, newValue, `entry.id=${entry.id}`);
                                }
                                // Update ref immediately (synchronous) to bypass React batching
                                editStartTimeRef.current = newValue;
                                // Also update state for re-renders
                                setEditStartTime(newValue);
                            }}
                            className="w-32"
                        />
                    </div>

                    {/* Duration Input */}
                    <div className="flex items-center gap-1">
                        <input
                            type="number"
                            value={editDuration}
                            onChange={(e) => setEditDuration(e.target.value)}
                            className="w-16 text-xs font-mono border border-slate-300 rounded px-2 py-1.5 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none text-center"
                            min={5}
                            step={5}
                        />
                        <span className="text-xs text-slate-500 whitespace-nowrap">min</span>
                    </div>

                    {/* Track Selector */}
                    {laneTracks.length > 0 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">Track:</span>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        type="button"
                                        className="flex items-center gap-1.5 text-xs border border-slate-300 rounded px-2 py-1.5 bg-white hover:bg-slate-50 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
                                    >
                                        {editTrackId === "all" ? (
                                            <span className="text-slate-700">All Tracks</span>
                                        ) : (
                                            <>
                                                <span
                                                    className="w-2 h-2 rounded-full shrink-0"
                                                    style={{ backgroundColor: selectedTrack?.color || "#64748B" }}
                                                />
                                                <span className="text-slate-700">{selectedTrack?.name || "Unknown"}</span>
                                            </>
                                        )}
                                        <ChevronDown className="w-3 h-3 text-slate-400" />
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-40">
                                    <DropdownMenuItem
                                        onClick={() => setEditTrackId("all")}
                                        className="gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                                        All Tracks
                                        {editTrackId === "all" && <Check className="ml-auto h-4 w-4" />}
                                    </DropdownMenuItem>
                                    {laneTracks.map((track) => (
                                        <DropdownMenuItem
                                            key={track.id}
                                            onClick={() => setEditTrackId(track.id)}
                                            className="gap-2"
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: track.color }}
                                            />
                                            {track.name}
                                            {editTrackId === track.id && <Check className="ml-auto h-4 w-4" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {/* Color Tag Picker */}
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                        <span className="text-xs text-slate-500">Color:</span>
                        <ColorTagPicker value={editColorKey} onChange={setEditColorKey} />
                    </div>

                    {/* Marker Picker */}
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
                        <span className="text-xs text-slate-500">Marker:</span>
                        <MarkerPicker value={editMarker} onChange={setEditMarker} />
                    </div>
                </div>

                {/* Row 3: Actions (Right Aligned) */}
                <div className="flex justify-end gap-2 pt-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(false);
                            setEditTitle(entry.customData?.title || entry.resolvedTitle || "");
                            setEditStartTime(entry.startTime || "");
                            editStartTimeRef.current = entry.startTime || ""; // Reset ref too
                            setEditDuration(entry.duration || 30);
                            setEditColorKey(entry.colorKey || null);
                            setEditMarker(entry.marker || null);
                            setEditTrackId(
                                entry.trackId === "shared" || entry.trackId === "all" ? "all" : (entry.trackId || "all")
                            );
                        }}
                        className="text-xs px-3 py-1.5 font-medium text-slate-600 hover:text-slate-800 hover:bg-black/5 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="text-xs px-4 py-1.5 font-medium bg-blue-600 text-white rounded hover:bg-blue-700 shadow-sm transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        );
    }

    // Display mode UI
    // Note: Single-click does NOT open modal; double-click enters inline edit
    // Modal edit is accessible via explicit menu action (not single-click)
    return (
        <div
            onDoubleClick={handleDoubleClick}
            className={cn(
                "relative flex items-center py-4 my-2 cursor-pointer group rounded-lg transition-colors",
                "hover:bg-slate-50",
                // Color tag styling: left border + subtle background tint
                colorTag && "border-l-4",
                colorTag?.borderClass,
                colorTag?.bgClass
            )}
        >
            {/* Time Range Pill */}
            <div className="pr-4 flex justify-end shrink-0">
                <div className={cn(
                    "px-3 py-1.5 rounded text-xs font-bold font-mono border whitespace-nowrap",
                    isWrap ? "bg-slate-900 text-white border-slate-900" :
                        isMeal ? "bg-amber-100 text-amber-800 border-amber-200" :
                            "bg-indigo-50 text-indigo-700 border-indigo-100"
                )}>
                    {timeRange || entry.startTime}
                </div>
            </div>

            {/* Horizontal Line Connector */}
            <div
                className={cn(
                    "h-px flex-1 relative top-px transition-colors",
                    !colorTag && "bg-slate-200 group-hover:bg-slate-300"
                )}
                style={colorTag ? { backgroundColor: colorTag.value, opacity: 0.5 } : undefined}
            />

            {/* Title + Marker */}
            <div className="px-4 flex items-center gap-2">
                <span className="text-sm font-bold uppercase tracking-wide text-slate-700 whitespace-nowrap">
                    {entry.resolvedTitle}
                </span>
                {/* Marker indicator */}
                {entry.marker && (() => {
                    const MarkerIcon = MARKER_ICON_MAP[entry.marker.icon];
                    return MarkerIcon ? (
                        <div
                            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: entry.marker.color }}
                            title={`Marker: ${entry.marker.icon}`}
                        >
                            <MarkerIcon className="w-3 h-3 text-white" />
                        </div>
                    ) : null;
                })()}
            </div>

            {/* Right Connector */}
            <div
                className={cn(
                    "h-px flex-[0.2] relative top-px transition-colors",
                    !colorTag && "bg-slate-200 group-hover:bg-slate-300"
                )}
                style={colorTag ? { backgroundColor: colorTag.value, opacity: 0.5 } : undefined}
            />

            {/* Duration Label */}
            <div className="pl-3 text-xs text-slate-400 font-medium whitespace-nowrap">
                {entry.duration}m
            </div>

            {/* Delete Confirmation Overlay */}
            {isConfirmingDelete && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/95 backdrop-blur rounded-lg z-10">
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-slate-700">Delete this banner?</span>
                        <button
                            onClick={handleConfirmDelete}
                            className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                        >
                            Delete
                        </button>
                        <button
                            onClick={handleCancelDelete}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Actions on Hover */}
            {(onUpdateEntry || onDeleteEntry) && !isConfirmingDelete && (
                <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {onDeleteEntry && (
                        <button
                            onClick={handleDeleteClick}
                            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete banner"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                    {onUpdateEntry && (
                        <div className="bg-white/90 backdrop-blur rounded px-1.5 py-0.5 text-3xs text-slate-400 border border-slate-200 shadow-sm">
                            Double-click to edit
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
