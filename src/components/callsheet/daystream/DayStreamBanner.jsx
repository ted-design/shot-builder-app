import React, { useState, useRef, useEffect } from "react";
import { Clock, Trash2 } from "lucide-react";
import { cn } from "../../../lib/utils";
import { parseTimeToMinutes, minutesToTimeString } from "../../../lib/timeUtils";

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
 */
export default function DayStreamBanner({ entry, onEdit, onUpdateEntry, onDeleteEntry }) {
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
    const titleInputRef = useRef(null);

    // Sync state when entry changes
    useEffect(() => {
        setEditTitle(entry.customData?.title || entry.resolvedTitle || "");
        setEditStartTime(entry.startTime || "");
        setEditDuration(entry.duration || 30);
    }, [entry.customData?.title, entry.resolvedTitle, entry.startTime, entry.duration]);

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
        const normalizedEditTime = editStartTime.trim();
        const normalizedEntryTime = (entry.startTime || "").trim();
        if (normalizedEditTime !== normalizedEntryTime) {
            if (normalizedEditTime) {
                const minutes = parseTimeToMinutes(normalizedEditTime);
                updates.startTime = minutesToTimeString(minutes);
            } else {
                updates.startTime = "";
            }
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
            setEditTitle(entry.customData?.title || entry.resolvedTitle || "");
            setEditStartTime(entry.startTime || "");
            setEditDuration(entry.duration || 30);
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
                    "relative flex items-center py-3 px-4 my-2 rounded-lg transition-colors",
                    "bg-blue-50 border-2 border-blue-400 ring-2 ring-blue-100"
                )}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={handleKeyDown}
            >
                {/* Time Input */}
                <div className="flex items-center gap-2 mr-4">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <input
                        type="time"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="text-xs font-mono border border-slate-300 rounded px-2 py-1 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none w-24"
                    />
                </div>

                {/* Horizontal Line Connector */}
                <div className="h-px bg-blue-200 flex-1" />

                {/* Title Input */}
                <div className="px-4">
                    <input
                        ref={titleInputRef}
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-sm font-bold uppercase tracking-wide border border-slate-300 rounded px-2 py-1 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none w-40"
                        placeholder="Banner title"
                    />
                </div>

                {/* Right Connector */}
                <div className="h-px bg-blue-200 flex-[0.2]" />

                {/* Duration Input */}
                <div className="flex items-center gap-1 mx-3">
                    <input
                        type="number"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-14 text-xs font-mono border border-slate-300 rounded px-2 py-1 focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none text-center"
                        min={5}
                        step={5}
                    />
                    <span className="text-xs text-slate-500">min</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 ml-2">
                    <button
                        onClick={handleSave}
                        className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                    >
                        Save
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsEditing(false);
                            setEditTitle(entry.customData?.title || entry.resolvedTitle || "");
                            setEditStartTime(entry.startTime || "");
                            setEditDuration(entry.duration || 30);
                        }}
                        className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancel
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
                "relative flex items-center py-3 my-1 cursor-pointer group rounded-lg transition-colors",
                "hover:bg-slate-50"
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
            <div className="h-px bg-slate-200 flex-1 relative top-px group-hover:bg-slate-300 transition-colors" />

            {/* Title */}
            <div className="px-4 text-sm font-bold uppercase tracking-wide text-slate-700 whitespace-nowrap">
                {entry.resolvedTitle}
            </div>

            {/* Right Connector */}
            <div className="h-px bg-slate-200 flex-[0.2] relative top-px group-hover:bg-slate-300 transition-colors" />

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
                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    {onDeleteEntry && (
                        <button
                            onClick={handleDeleteClick}
                            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete banner"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
