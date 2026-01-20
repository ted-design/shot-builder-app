import React, { useState, useRef, useEffect } from "react";
import {
  ExternalLink,
  MapPin,
  Users,
  Clock,
  X,
  Star,
  AlertTriangle,
  Camera,
  User,
  Zap,
  Heart,
  Flag,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { parseTimeToMinutes, minutesToTimeString } from "../../../lib/timeUtils";
import { getColorTag } from "../../../types/schedule";
import ColorTagPicker from "./ColorTagPicker";
import MarkerPicker from "./MarkerPicker";

/**
 * Icon component mapping for markers
 */
const MARKER_ICON_MAP = {
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
 * DayStreamBlock
 * 
 * Represents a single event in the swimlane.
 * Variable height based on duration.
 * Supports inline editing for Title and Duration.
 */
export default function DayStreamBlock({
    entry,
    tracks = [],
    onEdit,
    onUpdateEntry,
    onDeleteEntry,
}) {
    const track = tracks.find(t => t.id === entry.trackId);
    const trackColor = track?.color || "slate";

    // Handler for removing entry from schedule
    const handleRemoveClick = (e) => {
        e.stopPropagation();
        if (onDeleteEntry) {
            onDeleteEntry(entry.id);
        }
    };

    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState(entry.resolvedTitle || "");
    const [editDuration, setEditDuration] = useState(entry.duration || 15);
    const [editStartTime, setEditStartTime] = useState(entry.startTime || "");
    const [editColorKey, setEditColorKey] = useState(entry.colorKey || null);
    const [editMarker, setEditMarker] = useState(entry.marker || null);
    const inputRef = useRef(null);

    // Get the color tag for styling
    const colorTag = getColorTag(entry.colorKey);

    useEffect(() => {
        setEditTitle(entry.resolvedTitle || "");
        setEditDuration(entry.duration || 15);
        setEditStartTime(entry.startTime || "");
        setEditColorKey(entry.colorKey || null);
        setEditMarker(entry.marker || null);
    }, [entry.resolvedTitle, entry.duration, entry.startTime, entry.colorKey, entry.marker]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = (e) => {
        if (e) e.stopPropagation();
        setIsEditing(false);

        if (!onUpdateEntry) return;

        const updates = {};
        if (editTitle !== entry.resolvedTitle) {
            // For custom entries, update customData.title
            // For shots, we might just update description or notes if title is locked,
            // but let's assume we can update the 'customTitle' override if supported,
            // or just ignore title updates for shots if they are strictly derived.
            // However, user asked for "inline editing of shot details".
            // If it's a "custom" entry, we definitely update customData.
            if (entry.type === "custom") {
                updates.customData = { ...entry.customData, title: editTitle };
            } else {
                // For shots, maybe store a title override or update notes?
                // Let's assume we can't easily update Shot Name via this generic Entry update yet
                // without a specific 'shot update' mutation.
                // So we'll skip title update for shots for now to avoid complexity/errors,
                // or maybe just update 'notes' if that was intended?
                // Let's actually NOT update title for shots here to be safe.
            }
        }

        if (parseInt(editDuration) !== entry.duration) {
            updates.duration = parseInt(editDuration) || 15;
        }

        // Handle start time updates
        // Convert from native time input format (HH:MM) to canonical format
        const normalizedEditTime = editStartTime.trim();
        const normalizedEntryTime = (entry.startTime || "").trim();
        if (normalizedEditTime !== normalizedEntryTime) {
            // If user cleared the time, set to empty string (will be derived)
            // Otherwise, ensure it's in HH:MM format
            if (normalizedEditTime) {
                // Validate and normalize the time format
                const minutes = parseTimeToMinutes(normalizedEditTime);
                updates.startTime = minutesToTimeString(minutes);
            } else {
                // Clear explicit time - entry will use derived time
                updates.startTime = "";
            }
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
            onUpdateEntry(entry.id, updates);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSave(e);
        }
        if (e.key === "Escape") {
            setIsEditing(false);
            setEditTitle(entry.resolvedTitle || "");
            setEditDuration(entry.duration || 15);
            setEditStartTime(entry.startTime || "");
            setEditColorKey(entry.colorKey || null);
            setEditMarker(entry.marker || null);
            e.stopPropagation();
        }
    };

    // Determine border color based on track
    const borderColor = {
        slate: "border-slate-200 hover:border-slate-300",
        red: "border-red-200 hover:border-red-300",
        blue: "border-blue-200 hover:border-blue-300",
        green: "border-green-200 hover:border-green-300",
        amber: "border-amber-200 hover:border-amber-300",
        purple: "border-purple-200 hover:border-purple-300",
    }[trackColor] || "border-slate-200 hover:border-slate-300";

    const badgeBg = {
        slate: "bg-slate-100 text-slate-700",
        red: "bg-red-50 text-red-700",
        blue: "bg-blue-50 text-blue-700",
        green: "bg-green-50 text-green-700",
        amber: "bg-amber-50 text-amber-700",
        purple: "bg-purple-50 text-purple-700",
    }[trackColor] || "bg-slate-100 text-slate-700";

    // Resize Handle Logic
    const [isResizing, setIsResizing] = useState(false);

    useEffect(() => {
        if (isResizing) {
            document.body.style.cursor = "ns-resize";
            document.body.style.userSelect = "none";
        } else {
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        }
    }, [isResizing]);

    const handleResizeStart = (e) => {
        e.preventDefault();
        e.stopPropagation(); // Prevent drag start
        setIsResizing(true);

        const startY = e.clientY;
        const startDuration = entry.duration || 15;
        const pixelsPerMinute = 2.5; // Match height calculation

        const handleMouseMove = (moveEvent) => {
            const deltaY = moveEvent.clientY - startY;
            const deltaMinutes = Math.round(deltaY / pixelsPerMinute / 5) * 5; // Snap to 5 mins
            const newDuration = Math.max(5, startDuration + deltaMinutes);
            setEditDuration(newDuration);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            window.removeEventListener("pointermove", handleMouseMove);
            window.removeEventListener("pointerup", handleMouseUp);

            // Commit change
            // We need to compare with *original* entry duration, not the potentially stale state if we didn't update it yet
            // But here we rely on the final value of editDuration from the last move frame? 
            // Actually handleMouseMove updates state 'editDuration'.
            // But inside this closure, 'editDuration' is stale (value from start).
            // So we need to recalculate or use a ref.
            // Better: use the final calculated value in the up handler?
            // Actually, we can just trigger the update based on the *last set* value?
            // React state updates might be async.
            // Let's re-calculate in MouseUp to be safe and atomic.
            // OR use a mutable ref for current duration during drag.
        };

        // We'll actually commit inside MouseUp by reading the *latest* calculation.
        // Re-declaring logic for safety:
        const handleMouseUpCommit = (upEvent) => {
            const finalDeltaY = upEvent.clientY - startY;
            const finalDeltaMinutes = Math.round(finalDeltaY / pixelsPerMinute / 5) * 5;
            const finalDuration = Math.max(5, startDuration + finalDeltaMinutes);

            if (finalDuration !== entry.duration && onUpdateEntry) {
                onUpdateEntry(entry.id, { duration: finalDuration });
            }

            setIsResizing(false);
            document.body.style.cursor = "";
            window.removeEventListener("pointermove", handleMouseMove);
            window.removeEventListener("pointerup", handleMouseUpCommit);
        };

        window.addEventListener("pointermove", handleMouseMove);
        window.addEventListener("pointerup", handleMouseUpCommit);
    };

    // Height calculation: 2px per minute, min 56px to fit inputs
    // If resizing, use local editDuration
    const displayDuration = isResizing ? editDuration : (entry.duration || 15);
    const height = Math.max(56, displayDuration * 2.5);

    // Determine if this is a shot entry (has shotRef) vs custom/banner entry
    const isShot = Boolean(entry.shotRef);

    if (isEditing) {
        return (
            <div
                style={{ minHeight: `${height}px` }}
                className={cn(
                    "relative p-2 rounded-md border bg-white shadow-lg z-50 flex flex-col gap-1.5 h-auto",
                    "border-blue-400 ring-2 ring-blue-100",
                )}
                onClick={(e) => e.stopPropagation()} // Prevent drag start
                onKeyDown={handleKeyDown}
            >
                {/* Row 1: Title - editable for custom, read-only for shots */}
                {isShot ? (
                    <div className="flex items-center justify-between gap-2">
                        <span
                            className="text-xs font-semibold text-slate-800 truncate flex-1 pr-2"
                            title={entry.resolvedTitle}
                        >
                            {entry.resolvedTitle || "Untitled Shot"}
                        </span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(false);
                                onEdit?.();
                            }}
                            className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800 whitespace-nowrap shrink-0"
                            title="Edit shot details"
                        >
                            <ExternalLink className="w-3 h-3" />
                            <span>Open shot</span>
                        </button>
                    </div>
                ) : (
                    <input
                        ref={inputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="w-full text-xs font-semibold border border-slate-200 rounded px-1.5 py-0.5 focus:border-blue-400 outline-none"
                        placeholder="Title"
                    />
                )}

                {/* Row 2: Controls (Time, Duration, Color, Actions) - Flex Wrap for responsiveness */}
                <div className="flex flex-wrap items-center gap-2 mt-auto w-full">
                    {/* Time & Duration Group */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                            <input
                                ref={isShot ? inputRef : null}
                                type="time"
                                value={editStartTime}
                                onChange={(e) => setEditStartTime(e.target.value)}
                                className="text-[10px] font-mono border border-slate-200 rounded px-1 py-0.5 focus:border-blue-400 outline-none w-[70px]"
                            />
                        </div>
                        <div className="flex items-center gap-1">
                            <input
                                type="number"
                                value={editDuration}
                                onChange={(e) => setEditDuration(e.target.value)}
                                className="w-12 text-[10px] font-mono border border-slate-200 rounded px-1 py-0.5 focus:border-blue-400 outline-none text-right"
                                min={1}
                            />
                            <span className="text-[10px] text-slate-400">min</span>
                        </div>
                    </div>

                    {/* Color Tag Picker */}
                    <div className="flex items-center gap-1.5 shrink-0 border-l border-slate-200 pl-2">
                        <ColorTagPicker value={editColorKey} onChange={setEditColorKey} />
                    </div>

                    {/* Marker Picker */}
                    <div className="flex items-center shrink-0 border-l border-slate-200 pl-2">
                        <MarkerPicker value={editMarker} onChange={setEditMarker} />
                    </div>

                    {/* Spacer - pushes actions to right when on same line, or fills space when wrapped */}
                    <div className="flex-grow min-w-[10px]" />

                    {/* Actions Group */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={handleSave}
                            className="text-[10px] bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 font-medium transition-colors"
                        >
                            Save
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsEditing(false);
                                setEditColorKey(entry.colorKey || null);
                            }}
                            className="text-[10px] text-slate-500 hover:text-slate-700 px-2 py-1"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            onDoubleClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onUpdateEntry) setIsEditing(true);
            }}
            style={{ height: `${height}px` }}
            className={cn(
                "relative p-2 rounded-md border bg-white shadow-sm transition-all cursor-pointer overflow-hidden group select-none flex flex-col",
                "hover:shadow-md hover:z-10",
                borderColor,
                isResizing && "ring-2 ring-blue-200 z-50 shadow-lg",
                // Color tag styling: left border + subtle background tint
                colorTag && "border-l-4",
                colorTag?.borderClass,
                colorTag?.bgClass
            )}
        >
            {/* Header: Track, Marker & Duration */}
            <div className="flex justify-between items-center mb-1 shrink-0">
                <div className="flex items-center gap-1">
                    <span className={cn("text-[9px] uppercase font-bold px-1 py-0.5 rounded leading-none", badgeBg)}>
                        {track?.name || "Event"}
                    </span>
                    {/* Marker indicator */}
                    {entry.marker && (() => {
                        const MarkerIcon = MARKER_ICON_MAP[entry.marker.icon];
                        return MarkerIcon ? (
                            <div
                                className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                                style={{ backgroundColor: entry.marker.color }}
                                title={`Marker: ${entry.marker.icon}`}
                            >
                                <MarkerIcon className="w-2.5 h-2.5 text-white" />
                            </div>
                        ) : null;
                    })()}
                </div>
                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-0.5">
                    {entry.startTime}
                    <span className="opacity-50">•</span>
                    {displayDuration}m
                </div>
            </div>

            {/* Title */}
            <h4 className="font-semibold text-xs text-slate-800 leading-tight line-clamp-2 shrink-0" title={entry.resolvedTitle}>
                {entry.resolvedTitle || "Untitled Event"}
            </h4>

            {/* Details (only if height allows) */}
            {height >= 70 && (
                <p className="text-[10px] text-slate-500 leading-tight line-clamp-2 mt-0.5 shrink-0">
                    {entry.resolvedDetails || entry.description}
                </p>
            )}

            {/* Footer Metadata (only if large enough) */}
            {height >= 90 && (
                <div className="absolute bottom-2 left-2 right-2 flex gap-2 pt-1 border-t border-slate-50 opacity-80 pointer-events-none">
                    {entry.resolvedLocation && (
                        <div className="flex items-center text-[9px] text-slate-400">
                            <MapPin className="w-2.5 h-2.5 mr-0.5" />
                            <span className="truncate">{entry.resolvedLocation}</span>
                        </div>
                    )}
                    {entry.resolvedTalent?.length > 0 && (
                        <div className="flex items-center text-[9px] text-slate-400">
                            <Users className="w-2.5 h-2.5 mr-0.5" />
                            <span>{entry.resolvedTalent.length}</span>
                        </div>
                    )}
                </div>
            )}

            {/* Actions on Hover (only if not resizing) */}
            {(onUpdateEntry || onDeleteEntry) && !isResizing && (
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                    {onDeleteEntry && (
                        <button
                            onClick={handleRemoveClick}
                            className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title="Remove from schedule"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                    {onUpdateEntry && (
                        <div className="bg-white/80 backdrop-blur rounded p-0.5 text-[9px] text-slate-400 border border-slate-200">
                            Double-click to edit
                        </div>
                    )}
                </div>
            )}

            {/* Resize Handle - Only shows on hover or resizing */}
            {onUpdateEntry && (
                <div
                    className={cn(
                        "absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-50",
                        isResizing && "opacity-100 bg-blue-50/50"
                    )}
                    onPointerDown={handleResizeStart}
                >
                    <div className="w-8 h-1 rounded-full bg-slate-300 pointer-events-none" />
                </div>
            )}
        </div>
    );
}

