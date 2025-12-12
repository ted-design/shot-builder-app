// src/components/callsheet/tracks/TrackManager.jsx
// Modal for managing schedule tracks (add, edit, delete, reorder)

import React, { useState, useCallback } from "react";
import {
  X,
  GripVertical,
  Plus,
  Trash2,
  Check,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { DEFAULT_TRACKS } from "../../../types/schedule";

// Preset colors for tracks
const TRACK_COLORS = [
  { value: "#64748B", label: "Slate" },
  { value: "#EF4444", label: "Red" },
  { value: "#F97316", label: "Orange" },
  { value: "#F59E0B", label: "Amber" },
  { value: "#EAB308", label: "Yellow" },
  { value: "#84CC16", label: "Lime" },
  { value: "#22C55E", label: "Green" },
  { value: "#10B981", label: "Emerald" },
  { value: "#14B8A6", label: "Teal" },
  { value: "#06B6D4", label: "Cyan" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#6366F1", label: "Indigo" },
  { value: "#8B5CF6", label: "Violet" },
  { value: "#A855F7", label: "Purple" },
  { value: "#D946EF", label: "Fuchsia" },
  { value: "#EC4899", label: "Pink" },
];

const TRACK_SCOPES = [
  { value: "lane", label: "Lane Track" },
  { value: "shared", label: "Shared (Applies to all)" },
];

/**
 * TrackManager - Modal for managing schedule tracks
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Array} props.tracks - Current tracks
 * @param {Function} props.onSave - Callback to save changes
 * @param {Map} props.entriesByTrack - Map of track ID to entries (to show counts)
 */
function TrackManager({
  isOpen,
  onClose,
  tracks = DEFAULT_TRACKS,
  onSave,
  entriesByTrack = new Map(),
}) {
  // Local state for editing
  const [editedTracks, setEditedTracks] = useState(() =>
    [...tracks].sort((a, b) => a.order - b.order)
  );
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Reset to match props when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setEditedTracks([...tracks].sort((a, b) => a.order - b.order));
    }
  }, [isOpen, tracks]);

  // Generate unique ID
  const generateId = () => `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Handle name change
  const handleNameChange = useCallback((id, newName) => {
    setEditedTracks((prev) =>
      prev.map((track) =>
        track.id === id ? { ...track, name: newName } : track
      )
    );
  }, []);

  // Handle color change
  const handleColorChange = useCallback((id, newColor) => {
    setEditedTracks((prev) =>
      prev.map((track) =>
        track.id === id ? { ...track, color: newColor } : track
      )
    );
  }, []);

  const handleScopeChange = useCallback((id, newScope) => {
    setEditedTracks((prev) =>
      prev.map((track) =>
        track.id === id ? { ...track, scope: newScope } : track
      )
    );
  }, []);

  // Add new track
  const handleAddTrack = useCallback(() => {
    const newTrack = {
      id: generateId(),
      name: `Track ${editedTracks.length + 1}`,
      color: TRACK_COLORS[editedTracks.length % TRACK_COLORS.length].value,
      order: editedTracks.length,
      scope: "lane",
    };
    setEditedTracks((prev) => [...prev, newTrack]);
  }, [editedTracks.length]);

  // Delete track
  const handleDeleteTrack = useCallback((id) => {
    setEditedTracks((prev) => {
      const filtered = prev.filter((track) => track.id !== id);
      // Update order values
      return filtered.map((track, i) => ({ ...track, order: i }));
    });
  }, []);

  // Handle drag start
  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  // Handle drag over
  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setEditedTracks((prev) => {
      const newTracks = [...prev];
      const [draggedItem] = newTracks.splice(draggedIndex, 1);
      newTracks.splice(index, 0, draggedItem);

      // Update order values
      return newTracks.map((track, i) => ({ ...track, order: i }));
    });

    setDraggedIndex(index);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Reset to defaults
  const handleReset = useCallback(() => {
    setEditedTracks([...DEFAULT_TRACKS].sort((a, b) => a.order - b.order));
  }, []);

  // Save changes
  const handleSave = useCallback(() => {
    const normalized = editedTracks.map((track, idx) => ({
      ...track,
      scope: track.scope || (track.id === "shared" ? "shared" : "lane"),
      order: track.order ?? idx,
    }));
    onSave?.(normalized);
    onClose();
  }, [editedTracks, onSave, onClose]);

  // Check if track can be deleted (has entries)
  const canDeleteTrack = (trackId) => {
    const entries = entriesByTrack.get(trackId) || [];
    return entries.length === 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-manager-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id="track-manager-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Manage Tracks
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(85vh-130px)] overflow-y-auto p-4">
          <p className="mb-4 text-sm text-slate-500">
            Tracks represent parallel work streams (e.g., Photo, Video). Drag to reorder.
          </p>

          <div className="space-y-2">
            {editedTracks.map((track, index) => {
              const entryCount = (entriesByTrack.get(track.id) || []).length;
              const deletable = canDeleteTrack(track.id);

              return (
                <div
                  key={track.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                    draggedIndex === index
                      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                      : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                  }`}
                >
                  {/* Drag handle */}
                  <div className="cursor-grab text-slate-400 hover:text-slate-600">
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Color selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="h-6 w-6 rounded-full border-2 border-white shadow-sm transition-transform hover:scale-110"
                        style={{ backgroundColor: track.color }}
                        title="Change color"
                      />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="grid grid-cols-4 gap-1 p-2">
                      {TRACK_COLORS.map((color) => (
                        <button
                          key={color.value}
                          type="button"
                          onClick={() => handleColorChange(track.id, color.value)}
                          className="h-6 w-6 rounded-full transition-transform hover:scale-110"
                          style={{ backgroundColor: color.value }}
                          title={color.label}
                        >
                          {track.color === color.value && (
                            <Check className="mx-auto h-3 w-3 text-white" />
                          )}
                        </button>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Name input */}
                  <Input
                    type="text"
                    value={track.name}
                    onChange={(e) => handleNameChange(track.id, e.target.value)}
                    className="flex-1"
                  />

                  {/* Scope selector */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                      >
                        {(track.scope || (track.id === "shared" ? "shared" : "lane")) === "shared"
                          ? "Shared"
                          : "Lane"}
                        <ChevronDown className="h-3 w-3 opacity-60" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {TRACK_SCOPES.map((scopeOpt) => (
                        <DropdownMenuItem
                          key={scopeOpt.value}
                          onClick={() => handleScopeChange(track.id, scopeOpt.value)}
                          className="gap-2"
                        >
                          {scopeOpt.label}
                          {(track.scope || (track.id === "shared" ? "shared" : "lane")) === scopeOpt.value && (
                            <Check className="ml-auto h-4 w-4 text-amber-600" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Entry count badge */}
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-700">
                    {entryCount} item{entryCount !== 1 ? "s" : ""}
                  </span>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-500"
                    onClick={() => handleDeleteTrack(track.id)}
                    disabled={!deletable || editedTracks.length <= 1}
                    title={
                      !deletable
                        ? "Cannot delete track with entries"
                        : editedTracks.length <= 1
                        ? "Must have at least one track"
                        : "Delete track"
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>

          {/* Add track button */}
          <Button
            variant="outline"
            onClick={handleAddTrack}
            className="mt-4 w-full gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Track
          </Button>

          {/* Warning if tracks have entries */}
          {editedTracks.some((t) => !canDeleteTrack(t.id)) && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                Tracks with entries cannot be deleted. Move or delete the entries first.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <Button variant="outline" onClick={handleReset}>
            Reset to Defaults
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrackManager;
