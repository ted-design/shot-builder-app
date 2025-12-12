// src/components/callsheet/vertical/VerticalEntryCard.jsx
// Editable entry card for the vertical timeline view (SetHero style)

import React, { useState, useCallback, useEffect } from "react";
import {
  GripVertical,
  Clock,
  MapPin,
  FileText,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
  Check,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import AppImage from "../../common/AppImage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

// Entry type color mapping
const CATEGORY_COLORS = {
  setup: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  break: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  lunch: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  wrap: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  travel: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  meeting: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  talent: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes) {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/**
 * VerticalEntryCard - Editable card for schedule entries in vertical view
 *
 * @param {object} props
 * @param {object} props.entry - Resolved schedule entry
 * @param {object} props.track - Track this entry belongs to
 * @param {Array} props.tracks - All available tracks for dropdown
 * @param {Array} props.locations - Available locations for dropdown
 * @param {object} props.settings - Schedule settings
 * @param {boolean} props.isSelected - Whether card is selected
 * @param {Function} props.onSelect - Selection callback
 * @param {Function} props.onTimeChange - Time change callback
 * @param {Function} props.onDurationChange - Duration change callback
 * @param {Function} props.onNotesChange - Notes change callback
 * @param {Function} props.onLocationChange - Location change callback
 * @param {Function} props.onTrackChange - Track change callback
 * @param {Function} props.onDelete - Delete callback
 */
function VerticalEntryCard({
  entry,
  track,
  tracks = [],
  locations = [],
  settings = {},
  isSelected = false,
  onSelect,
  onTimeChange,
  onDurationChange,
  onNotesChange,
  onLocationChange,
  onTrackChange,
  onDelete,
}) {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [timeValue, setTimeValue] = useState(entry.startTime || "09:00");
  const [notesValue, setNotesValue] = useState(entry.resolvedNotes || "");

  // Sync local state with prop changes (important for Firestore updates)
  useEffect(() => {
    if (!isEditingTime && entry.startTime !== timeValue) {
      setTimeValue(entry.startTime || "09:00");
    }
  }, [entry.startTime, isEditingTime]);

  useEffect(() => {
    if (!isEditingNotes && entry.resolvedNotes !== notesValue) {
      setNotesValue(entry.resolvedNotes || "");
    }
  }, [entry.resolvedNotes, isEditingNotes]);

  // Sortable hook for drag and drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Determine entry display info
  const isShot = entry.type === "shot";
  const category = entry.customData?.category || "other";
  const categoryColor = isShot
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    : CATEGORY_COLORS[category] || CATEGORY_COLORS.other;

  // Get image for shots
  const imageUrl = entry.resolvedImage;

  // Handle time edit
  const handleTimeSubmit = useCallback(() => {
    setIsEditingTime(false);
    if (timeValue !== entry.startTime && onTimeChange) {
      onTimeChange(entry.id, timeValue);
    }
  }, [entry.id, entry.startTime, timeValue, onTimeChange]);

  // Handle notes edit
  const handleNotesSubmit = useCallback(() => {
    setIsEditingNotes(false);
    if (notesValue !== entry.resolvedNotes && onNotesChange) {
      onNotesChange(entry.id, notesValue);
    }
  }, [entry.id, entry.resolvedNotes, notesValue, onNotesChange]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border transition-all ${
        isDragging
          ? "border-amber-400 bg-amber-50 shadow-lg dark:bg-amber-900/20"
          : isSelected
          ? "border-amber-500 bg-white ring-2 ring-amber-200 dark:bg-slate-800 dark:ring-amber-800"
          : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600"
      }`}
      onClick={() => onSelect?.(entry.id)}
    >
      {/* Header: Time, Category Badge, Duration */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 dark:border-slate-700">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab touch-none text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Time */}
        {isEditingTime ? (
          <Input
            type="time"
            step={(settings.timeIncrement || 15) * 60}
            value={timeValue}
            onChange={(e) => setTimeValue(e.target.value)}
            onBlur={handleTimeSubmit}
            onKeyDown={(e) => e.key === "Enter" && handleTimeSubmit()}
            className="h-7 w-24 px-2 text-sm font-medium"
            autoFocus
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditingTime(true);
            }}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-sm font-medium text-slate-900 hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {entry.startTime || "—"}
          </button>
        )}

        {/* Category badge */}
        <span className={`rounded px-2 py-0.5 text-xs font-medium ${categoryColor}`}>
          {isShot ? "Shot" : category.charAt(0).toUpperCase() + category.slice(1)}
        </span>

        {/* Duration (click to edit) */}
        {settings.showDurations && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const next = window.prompt("Duration (minutes)", `${entry.duration || 0}`);
              if (!next) return;
              const parsed = parseInt(next, 10);
              if (Number.isNaN(parsed) || parsed <= 0) return;
              onDurationChange?.(entry.id, parsed);
            }}
            className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            title="Edit duration"
          >
            {formatDuration(entry.duration)}
          </button>
        )}

        {/* Track selector dropdown */}
        {tracks.length > 1 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: track?.color || "#64748B" }}
                />
                <span className="max-w-[80px] truncate">{track?.name || "Track"}</span>
                <ChevronDown className="h-3 w-3 opacity-50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {tracks.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => onTrackChange?.(entry.id, t.id)}
                  className="gap-2"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: t.color }}
                  />
                  {t.name}
                  {t.id === entry.trackId && (
                    <Check className="ml-auto h-4 w-4 text-amber-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div
            className="ml-auto h-3 w-3 rounded-full"
            style={{ backgroundColor: track?.color || "#64748B" }}
            title={track?.name || "Track"}
          />
        )}
      </div>

      {/* Body: Title, Description, Image */}
      <div className="flex gap-3 p-3">
        {/* Image thumbnail (for shots) */}
        {isShot && (
          <div className="h-16 w-20 flex-shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-slate-700">
            <AppImage
              src={imageUrl}
              alt=""
              className="h-full w-full"
              imageClassName="h-full w-full object-cover"
              fallback={
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-6 w-6 text-slate-400" />
                </div>
              }
            />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <h4 className="font-medium text-slate-900 dark:text-slate-100">
            {entry.resolvedTitle || "Untitled"}
          </h4>

          {/* Description */}
          {entry.description && (
            <p className="mt-1 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
              {entry.description}
            </p>
          )}

          {/* Talent & Products (for shots) */}
          {isShot && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              {entry.resolvedTalent?.length > 0 && (
                <span>
                  Talent:{" "}
                  {entry.resolvedTalent
                    .map((t) => (typeof t === "string" ? t : t.name))
                    .join(", ")}
                </span>
              )}
              {entry.resolvedProducts?.length > 0 && (
                <span>
                  Products:{" "}
                  {entry.resolvedProducts
                    .slice(0, 3)
                    .map((p) => (typeof p === "string" ? p : p.name || p.familyName))
                    .join(", ")}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer: Location, Notes, Actions */}
      <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 dark:border-slate-700">
        {/* Location dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
            >
              <MapPin className="h-3.5 w-3.5" />
              {entry.resolvedLocation || "Set location"}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => onLocationChange?.(entry.id, null)}>
              No location
            </DropdownMenuItem>
            {locations.map((loc) => (
              <DropdownMenuItem
                key={loc.id}
                onClick={() => onLocationChange?.(entry.id, loc.id)}
              >
                {loc.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Notes toggle */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingNotes(!isEditingNotes);
          }}
          className={`h-7 gap-1.5 px-2 text-xs ${
            entry.resolvedNotes ? "text-amber-600 dark:text-amber-400" : ""
          }`}
        >
          <FileText className="h-3.5 w-3.5" />
          {isEditingNotes ? "Save note" : entry.resolvedNotes ? "Edit note" : "Add note"}
        </Button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Delete button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.(entry.id);
          }}
          className="h-7 px-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Notes textarea (expandable) */}
      {isEditingNotes && (
        <div className="border-t border-slate-100 p-3 dark:border-slate-700">
          <textarea
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            onBlur={handleNotesSubmit}
            placeholder="Add notes for this entry..."
            className="w-full resize-none rounded border border-slate-200 bg-white p-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
            rows={3}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}

export default VerticalEntryCard;
