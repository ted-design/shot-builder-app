// src/components/callsheet/entries/CustomEntryForm.jsx
// Form for creating/editing custom schedule entries (non-shot items)

import React, { useState, useRef, useEffect } from "react";
import {
  Wrench,
  Coffee,
  Utensils,
  Flag,
  Truck,
  Users,
  Sparkles,
  HelpCircle,
  Clock,
  Check,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { TimePicker } from "../../ui/TimePicker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  CUSTOM_ENTRY_CATEGORY_LABELS,
  CUSTOM_ENTRY_CATEGORY_COLORS,
} from "../../../types/schedule";

// Icons for each category
const CATEGORY_ICONS = {
  setup: Wrench,
  break: Coffee,
  lunch: Utensils,
  wrap: Flag,
  travel: Truck,
  meeting: Users,
  talent: Sparkles,
  other: HelpCircle,
};

// Duration presets in minutes
const DURATION_PRESETS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

/**
 * CustomEntryForm - Form for creating/editing custom schedule entries
 *
 * @param {object} props
 * @param {object} props.initialData - Initial form data for editing
 * @param {string} props.initialCategory - Pre-selected category (from quick add)
 * @param {Array} props.tracks - Available tracks
 * @param {string} props.defaultStartTime - Default start time (HH:MM) for new entries
 * @param {Function} props.onSubmit - Callback when form is submitted
 * @param {Function} props.onCancel - Callback to cancel/close
 * @param {boolean} props.isSubmitting - Whether the form is submitting
 */
function CustomEntryForm({
  initialData = null,
  initialCategory = null,
  tracks = [],
  defaultStartTime = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) {
  const isEditing = Boolean(initialData);
  const laneTracks = tracks.filter((t) => (t.scope || (t.id === "shared" ? "shared" : "lane")) === "lane");

  // Form state
  const [title, setTitle] = useState(initialData?.title || "");
  const [category, setCategory] = useState(
    initialData?.category || initialCategory || "other"
  );
  const [duration, setDuration] = useState(initialData?.duration || 30);
  const [customDuration, setCustomDuration] = useState("");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [startTime, setStartTime] = useState(initialData?.startTime || defaultStartTime || "");
  const defaultTrackId =
    initialData?.trackId ||
    tracks.find((t) => t.scope === "shared" || t.id === "shared")?.id ||
    tracks[0]?.id ||
    "shared";
  const [trackId, setTrackId] = useState(defaultTrackId);
  const [appliesToTrackIds, setAppliesToTrackIds] = useState(() => {
    const initial = Array.isArray(initialData?.appliesToTrackIds)
      ? initialData.appliesToTrackIds
      : null;
    if (initial && initial.length > 0) return new Set(initial);
    return new Set(laneTracks.map((t) => t.id));
  });

  // Ref for autofocus on mount
  const titleInputRef = useRef(null);
  useEffect(() => {
    titleInputRef.current?.focus();
  }, []);

  // Get current track
  const selectedTrack = tracks.find((t) => t.id === trackId) || tracks[0];
  const selectedTrackScope = selectedTrack?.scope || (selectedTrack?.id === "shared" ? "shared" : "lane");
  const isSharedScope = selectedTrackScope === "shared";

  // Category icon and color
  const CategoryIcon = CATEGORY_ICONS[category] || HelpCircle;
  const categoryColor = CUSTOM_ENTRY_CATEGORY_COLORS[category] || "#71717A";
  const categoryLabel = CUSTOM_ENTRY_CATEGORY_LABELS[category] || "Other";

  // Handle duration selection
  const handleDurationSelect = (value) => {
    setDuration(value);
    setCustomDuration("");
  };

  const handleCustomDurationChange = (e) => {
    const value = e.target.value;
    setCustomDuration(value);
    if (value && !isNaN(parseInt(value, 10))) {
      setDuration(parseInt(value, 10));
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    if (!title.trim()) return;

    const customData = {
      title: title.trim(),
      ...(notes.trim() && { notes: notes.trim() }), // Only include if non-empty
      category,
    };

    let appliesTo = null;
    if (isSharedScope && laneTracks.length > 0) {
      const selectedIds = Array.from(appliesToTrackIds);
      const laneIds = laneTracks.map((t) => t.id);
      const selectedLaneIds = selectedIds.filter((id) => laneIds.includes(id));
      if (selectedLaneIds.length === 0) return;
      if (selectedLaneIds.length < laneIds.length) {
        appliesTo = selectedLaneIds;
      }
    }

    onSubmit({ customData, trackId, duration, appliesToTrackIds: appliesTo, startTime: startTime || null });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-4">
      {/* Category selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Type
        </label>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(CUSTOM_ENTRY_CATEGORY_LABELS).map(([key, label]) => {
            const Icon = CATEGORY_ICONS[key] || HelpCircle;
            const color = CUSTOM_ENTRY_CATEGORY_COLORS[key] || "#71717A";
            const isSelected = category === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setCategory(key);
                  if (!title.trim()) setTitle(label);
                }}
                className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors ${
                  isSelected
                    ? "border-slate-900 bg-slate-50 dark:border-slate-100 dark:bg-slate-800"
                    : "border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                }`}
              >
                <Icon className="h-5 w-5" style={{ color }} />
                <span className="text-xs">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Title input */}
      <div>
        <label
          htmlFor="entry-title"
          className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Title
        </label>
        <Input
          ref={titleInputRef}
          id="entry-title"
          type="text"
          placeholder={`e.g., ${categoryLabel}`}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      {/* Start Time input (for editing or when creating with explicit time) */}
      {(isEditing || defaultStartTime) && (
        <div>
          <TimePicker
            label="Start Time"
            value={startTime || null}
            onChange={(value) => setStartTime(value || "")}
            className="w-48"
          />
          <p className="mt-1 text-xs text-slate-500">
            Leave empty to auto-schedule based on sequence
          </p>
        </div>
      )}

      {/* Duration selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Duration
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {DURATION_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => handleDurationSelect(preset.value)}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                duration === preset.value && !customDuration
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
              }`}
            >
              {preset.label}
            </button>
          ))}
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min="5"
              max="480"
              step="5"
              placeholder="Custom"
              value={customDuration}
              onChange={handleCustomDurationChange}
              className="w-20 text-center"
            />
            <span className="text-sm text-slate-500">min</span>
          </div>
        </div>
      </div>

      {/* Track selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
          Track
        </label>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: selectedTrack?.color || "#64748B" }}
              />
              {selectedTrack?.name || "Select track"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[200px]">
            {tracks.map((track) => (
              <DropdownMenuItem
                key={track.id}
                onClick={() => setTrackId(track.id)}
                className="gap-2"
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: track.color }}
                />
                {track.name}
                {track.id === trackId && <Check className="ml-auto h-4 w-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {isSharedScope && laneTracks.length > 1 && (
          <div className="mt-3">
            <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Applies To
            </div>
            <div className="flex flex-wrap gap-2">
              {laneTracks.map((track) => {
                const selected = appliesToTrackIds.has(track.id);
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => {
                      setAppliesToTrackIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(track.id)) {
                          next.delete(track.id);
                        } else {
                          next.add(track.id);
                        }
                        return next;
                      });
                    }}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: track.color }}
                    />
                    {track.name}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setAppliesToTrackIds(new Set(laneTracks.map((t) => t.id)))}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
              >
                Select all
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Notes (optional) */}
      <div>
        <label
          htmlFor="entry-notes"
          className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300"
        >
          Notes{" "}
          <span className="font-normal text-slate-500">(optional)</span>
        </label>
        <textarea
          id="entry-notes"
          placeholder="Add any notes or details..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:placeholder:text-slate-500"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!title.trim() || isSubmitting}>
          {isSubmitting ? (
            <>
              <Clock className="mr-2 h-4 w-4 animate-spin" />
              {isEditing ? "Saving..." : "Adding..."}
            </>
          ) : isEditing ? (
            "Save Changes"
          ) : (
            "Add to Schedule"
          )}
        </Button>
      </div>
    </form>
  );
}

export default CustomEntryForm;
