// src/components/callsheet/vertical/VerticalEntryCard.jsx
// Editable entry card for the vertical timeline view (SetHero style)

import React, { useState, useCallback, useEffect } from "react";
import {
  GripVertical,
  MapPin,
  FileText,
  Flag,
  Pencil,
  Trash2,
  Image as ImageIcon,
  ChevronDown,
  Check,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { TimePicker } from "../../ui/TimePicker";
import AppImage from "../../common/AppImage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { parseDuration } from "../../../lib/timeUtils";
import MarkerPicker from "./MarkerPicker";

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

const FLAG_OPTIONS = [
  { value: null, label: "None" },
  { value: "Important", label: "Important" },
  { value: "Client", label: "Client" },
  { value: "Wardrobe", label: "Wardrobe" },
  { value: "HMU", label: "HMU" },
  { value: "Travel", label: "Travel" },
];

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
 * @param {Function} props.onMarkerChange - Marker change callback
 * @param {Function} props.onEditCustom - Edit callback for custom items
 * @param {Function} props.onDelete - Delete callback
 */
function VerticalEntryCard({
  entry,
  track,
  tracks = [],
  locations = [],
  settings = {},
  isSelected = false,
  checked = false,
  onSelect,
  onCheckedChange,
  onTimeChange,
  onDurationChange,
  onNotesChange,
  onLocationChange,
  onTrackChange,
  onFlagChange,
  onMarkerChange,
  onEditShot,
  onEditCustom,
  onDelete,
  // Controlled TimePicker props (lifted from parent for cross-group stability)
  timePickerOpen = false,
  onTimePickerOpenChange,
}) {
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isDurationMenuOpen, setIsDurationMenuOpen] = useState(false);
  const [durationDraft, setDurationDraft] = useState(() =>
    entry.duration ? formatDuration(entry.duration) : ""
  );
  const [notesValue, setNotesValue] = useState(entry.resolvedNotes || "");

  // Sync local state with prop changes (important for Firestore updates)
  useEffect(() => {
    if (!isDurationMenuOpen) {
      setDurationDraft(entry.duration ? formatDuration(entry.duration) : "");
    }
  }, [entry.duration, isDurationMenuOpen]);

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
  const flagValue = entry.flag || null;
  const flagLabel = FLAG_OPTIONS.find((opt) => opt.value === flagValue)?.label || String(flagValue || "Flag");

  // Handle duration edit
  const applyDurationDraft = useCallback(() => {
    const parsed = parseDuration(durationDraft);
    if (!parsed || parsed <= 0) return;
    setIsDurationMenuOpen(false);
    if (parsed !== entry.duration && onDurationChange) {
      onDurationChange(entry.id, parsed);
    }
  }, [durationDraft, entry.duration, entry.id, onDurationChange]);

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
      className={`group relative border-b overflow-hidden transition-all ${
        isDragging
          ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
          : isSelected
          ? "border-blue-500 bg-white ring-2 ring-blue-200 dark:bg-slate-800 dark:ring-blue-800"
          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
      }`}
      onClick={() => onSelect?.(entry.id)}
    >
      {/* Header: Time, Category Badge, Duration - light gray background */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(entry.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
          aria-label="Select entry"
        />

        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab touch-none text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-400"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          aria-label="Drag entry"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Visual marker (separate from flag tags) - hidden at rest when unset, visible on hover */}
        <div
          className={[
            "w-6 flex-shrink-0 transition-opacity duration-150",
            entry.marker
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <MarkerPicker
            value={entry.marker || null}
            onChange={(marker) => onMarkerChange?.(entry.id, marker)}
          />
        </div>

        {/* Time badge with duration stacked beneath */}
        <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
          {/* Time picker - consistent with Day Details */}
          <TimePicker
            label="Time"
            value={entry.startTime || null}
            onChange={(value) => {
              // TimePicker returns "HH:mm" format or null; default to current time if cleared
              const newTime = value || entry.startTime || "09:00";
              if (newTime !== entry.startTime && onTimeChange) {
                onTimeChange(entry.id, newTime);
              }
            }}
            className="w-28"
            open={timePickerOpen}
            onOpenChange={onTimePickerOpenChange}
          />

          {/* Duration beneath time */}
          {settings.showDurations && (
            <DropdownMenu open={isDurationMenuOpen} onOpenChange={setIsDurationMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="-mx-1 mt-0.5 cursor-pointer rounded-sm px-1 text-xs leading-tight text-slate-400 transition-colors hover:bg-slate-200/60 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-600/50 dark:hover:text-slate-300"
                  title="Edit duration"
                >
                  {formatDuration(entry.duration)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-72 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Duration
                    </div>
                    <Input
                      value={durationDraft}
                      onChange={(e) => setDurationDraft(e.target.value)}
                      placeholder="e.g., 1h 30m"
                      onKeyDown={(e) => e.key === "Enter" && applyDurationDraft()}
                      className="mt-2 h-9"
                      autoFocus
                    />
                    <div className="mt-1 text-xs text-slate-400">Supports "90m", "1h", "1h 30m".</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[15, 30, 45, 60, 90, 120].map((minutes) => (
                      <Button
                        key={minutes}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDurationDraft(formatDuration(minutes))}
                      >
                        {formatDuration(minutes)}
                      </Button>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsDurationMenuOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="button" size="sm" onClick={applyDurationDraft}>
                      Apply
                    </Button>
                  </div>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Category badge */}
        <span className={`inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${categoryColor}`}>
          {isShot ? "Shot" : category.charAt(0).toUpperCase() + category.slice(1)}
        </span>

        {/* Inline title with truncation */}
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
            {isShot && entry.shotNumber && (
              <span className="inline-flex flex-shrink-0 items-center whitespace-nowrap rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                {entry.shotNumber}
              </span>
            )}
            <span className="truncate">{entry.resolvedTitle || "Untitled"}</span>
          </span>
        </div>

        {/* Track chip - always visible, subtle slate styling */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 dark:focus:ring-slate-600"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="max-w-[80px] truncate">{track?.name || "Primary"}</span>
              {tracks.length > 1 && <ChevronDown className="h-3 w-3 opacity-50" />}
            </button>
          </DropdownMenuTrigger>
          {tracks.length > 1 && (
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {tracks.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onClick={() => onTrackChange?.(entry.id, t.id)}
                  className="gap-2"
                >
                  {t.name}
                  {t.id === entry.trackId && (
                    <Check className="ml-auto h-4 w-4 text-amber-600" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          )}
        </DropdownMenu>
      </div>

      {/* Body: Title, Description, Image - white background with compact padding */}
      <div className="flex gap-3 p-3">
        {/* Image thumbnail (for shots) */}
        {isShot && (
          <div className="w-12 h-12 flex-shrink-0 overflow-hidden rounded-md bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
            <AppImage
              src={imageUrl}
              alt=""
              fit="cover"
              className="h-full w-full"
              imageClassName="h-full w-full"
              position={entry.resolvedImagePosition}
              fallback={
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-5 w-5 text-slate-400" />
                </div>
              }
            />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Details (e.g., colourway) */}
          {entry.resolvedDetails && (
            <p className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
              {entry.resolvedDetails}
            </p>
          )}

          {/* Description */}
          {entry.description && (
            <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
              {entry.description}
            </p>
          )}

          {/* Secondary metadata line: Location • Notes (compact, truncated) */}
          {(entry.resolvedLocation || entry.resolvedNotes) && (
            <p className="mt-1 flex min-w-0 items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              {entry.resolvedLocation && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{entry.resolvedLocation}</span>
                </span>
              )}
              {entry.resolvedLocation && entry.resolvedNotes && (
                <span className="flex-shrink-0">•</span>
              )}
              {entry.resolvedNotes && (
                <span className="truncate">{entry.resolvedNotes}</span>
              )}
            </p>
          )}

          {/* Talent & Products (for shots) */}
          {isShot && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
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

      {/* Footer: Location, Notes, Actions - de-emphasized with very light background */}
      <div className="flex items-center gap-1 border-t border-slate-100 bg-slate-50/50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800/30">
        {/* Flag dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className={[
                "inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-700",
                flagValue ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400",
              ].join(" ")}
            >
              <Flag className="h-3 w-3" />
              <span className="hidden sm:inline">{flagLabel}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
            {FLAG_OPTIONS.map((opt) => (
              <DropdownMenuItem key={opt.label} onClick={() => onFlagChange?.(entry.id, opt.value)}>
                <span className="flex-1">{opt.label}</span>
                {opt.value === flagValue ? <Check className="h-4 w-4" /> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Location dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <MapPin className="h-3 w-3" />
              <span className="max-w-[100px] truncate">{entry.resolvedLocation || "Location"}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsEditingNotes(!isEditingNotes);
          }}
          className={[
            "inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-700",
            entry.resolvedNotes ? "text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400",
          ].join(" ")}
        >
          <FileText className="h-3 w-3" />
          <span className="hidden sm:inline">{entry.resolvedNotes ? "Note" : "Add note"}</span>
        </button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Edit/Delete buttons - hover-only visibility, fixed width to prevent layout shift */}
        <div className="flex w-14 items-center justify-end opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {!isShot && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditCustom?.(entry);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              title="Edit banner"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}

          {isShot ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditShot?.(entry);
              }}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
              title="Edit shot"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          ) : null}

          {/* Delete button */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(entry.id);
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            title="Delete entry"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Notes textarea (expandable) */}
      {isEditingNotes && (
        <div className="border-t border-slate-100 p-2 dark:border-slate-700">
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
