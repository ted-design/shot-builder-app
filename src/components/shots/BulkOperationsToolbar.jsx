// src/components/shots/BulkOperationsToolbar.jsx
import { useState, useRef, useEffect } from "react";
import { X, Tag, Plus, Minus, MapPin, Calendar, Film, ArrowRight, Copy } from "lucide-react";
import { Button } from "../ui/button";
import { TagBadge, TAG_COLORS } from "../ui/TagBadge";

// Default color for new tags
const DEFAULT_TAG_COLOR = "blue";

/**
 * BulkOperationsToolbar
 *
 * Comprehensive toolbar for bulk editing selected shots. Provides:
 * - Tag operations (apply/remove)
 * - Property operations (location, date, type)
 * - Project operations (move/copy)
 *
 * Extends the Phase 11C BulkTaggingToolbar with additional operations.
 */
export default function BulkOperationsToolbar({
  selectedCount,
  onClearSelection,
  // Tag operations
  onApplyTags,
  onRemoveTags,
  availableTags = [],
  // Property operations
  onSetLocation,
  onSetDate,
  onSetType,
  availableLocations = [],
  availableTypes = [],
  // Project operations
  onMoveToProject,
  onCopyToProject,
  availableProjects = [],
  currentProjectId,
  // State
  isProcessing = false,
}) {
  const [mode, setMode] = useState(null); // 'apply-tags', 'remove-tags', 'location', 'date', 'type', 'move', 'copy'
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!mode) return undefined;

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMode(null);
        setIsCreatingNewTag(false);
        setNewTagLabel("");
        setNewTagColor(DEFAULT_TAG_COLOR);
        setDateValue("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode]);

  // Tag operations
  const handleApplyTagsClick = () => {
    setMode(mode === "apply-tags" ? null : "apply-tags");
    setIsCreatingNewTag(false);
    setNewTagLabel("");
  };

  const handleRemoveTagsClick = () => {
    setMode(mode === "remove-tags" ? null : "remove-tags");
  };

  const handleApplyExistingTag = (tag) => {
    onApplyTags([tag]);
    setMode(null);
  };

  const handleCreateAndApplyTag = () => {
    const trimmed = newTagLabel.trim();
    if (!trimmed) return;

    const newTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      label: trimmed,
      color: newTagColor,
    };

    onApplyTags([newTag]);
    setMode(null);
    setIsCreatingNewTag(false);
    setNewTagLabel("");
    setNewTagColor(DEFAULT_TAG_COLOR);
  };

  const handleRemoveTag = (tag) => {
    onRemoveTags([tag.id]);
    setMode(null);
  };

  const handleTagKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateAndApplyTag();
    } else if (event.key === "Escape") {
      setMode(null);
      setIsCreatingNewTag(false);
    }
  };

  // Property operations
  const handleLocationClick = () => {
    setMode(mode === "location" ? null : "location");
  };

  const handleSelectLocation = (locationId) => {
    onSetLocation(locationId);
    setMode(null);
  };

  const handleDateClick = () => {
    setMode(mode === "date" ? null : "date");
    setDateValue("");
  };

  const handleSetDate = () => {
    onSetDate(dateValue || null);
    setMode(null);
    setDateValue("");
  };

  const handleDateKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSetDate();
    } else if (event.key === "Escape") {
      setMode(null);
      setDateValue("");
    }
  };

  const handleTypeClick = () => {
    setMode(mode === "type" ? null : "type");
  };

  const handleSelectType = (typeValue) => {
    onSetType(typeValue);
    setMode(null);
  };

  // Project operations
  const handleMoveClick = () => {
    setMode(mode === "move" ? null : "move");
  };

  const handleSelectMoveProject = (projectId) => {
    onMoveToProject(projectId);
    setMode(null);
  };

  const handleCopyClick = () => {
    setMode(mode === "copy" ? null : "copy");
  };

  const handleSelectCopyProject = (projectId) => {
    onCopyToProject(projectId);
    setMode(null);
  };

  // Filter out current project from project operations
  const otherProjects = availableProjects.filter((p) => p.id !== currentProjectId);

  return (
    <div className="sticky top-28 z-30 border-b border-primary/20 bg-primary/10 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-primary">
            {selectedCount} {selectedCount === 1 ? "shot" : "shots"} selected
          </span>
          <div className="h-4 w-px bg-primary/30" />

          {/* All operations in one container */}
          <div className="flex flex-wrap items-center gap-2" ref={dropdownRef}>
            {/* TAG OPERATIONS */}
            <div className="flex items-center gap-2 rounded-md border-r border-primary/20 pr-2">
              {/* Apply Tags Button */}
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "apply-tags" ? "default" : "outline"}
                  onClick={handleApplyTagsClick}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  Tags
                </Button>

                {/* Apply Tags Dropdown */}
                {mode === "apply-tags" && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Apply tag to {selectedCount} shot{selectedCount === 1 ? "" : "s"}
                    </p>

                    {!isCreatingNewTag ? (
                      <>
                        {/* Existing tags list */}
                        {availableTags.length > 0 ? (
                          <div className="mb-3 max-h-48 space-y-1 overflow-y-auto">
                            {availableTags.map((tag) => (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => handleApplyExistingTag(tag)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                                aria-label={`Apply ${tag.label} tag to ${selectedCount} selected shot${selectedCount === 1 ? "" : "s"}`}
                              >
                                <TagBadge tag={tag} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="mb-3 text-sm text-slate-500">No existing tags</p>
                        )}

                        {/* Create new tag button */}
                        <button
                          type="button"
                          onClick={() => setIsCreatingNewTag(true)}
                          className="flex w-full items-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-primary hover:bg-primary/5 hover:text-primary"
                        >
                          <Plus className="h-4 w-4" />
                          Create new tag
                        </button>
                      </>
                    ) : (
                      <>
                        {/* New tag creation form */}
                        <div className="space-y-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              Tag label
                            </label>
                            <input
                              type="text"
                              value={newTagLabel}
                              onChange={(e) => setNewTagLabel(e.target.value)}
                              onKeyDown={handleTagKeyDown}
                              placeholder="Enter tag name..."
                              maxLength={50}
                              autoFocus
                              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-xs font-medium text-slate-700">
                              Color
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                              {Object.keys(TAG_COLORS).map((colorKey) => {
                                const colorDef = TAG_COLORS[colorKey];
                                const isSelected = newTagColor === colorKey;
                                return (
                                  <button
                                    key={colorKey}
                                    type="button"
                                    onClick={() => setNewTagColor(colorKey)}
                                    className={`h-8 rounded border-2 transition ${colorDef.bg} ${
                                      isSelected
                                        ? "border-slate-900 ring-2 ring-slate-900 ring-offset-1"
                                        : "border-transparent hover:border-slate-400"
                                    }`}
                                    title={colorKey}
                                    aria-label={`Select ${colorKey} color`}
                                  />
                                );
                              })}
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleCreateAndApplyTag}
                              disabled={!newTagLabel.trim()}
                              className="flex-1"
                            >
                              Create & Apply
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsCreatingNewTag(false);
                                setNewTagLabel("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Remove Tags Button */}
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "remove-tags" ? "default" : "outline"}
                  onClick={handleRemoveTagsClick}
                  disabled={isProcessing || availableTags.length === 0}
                  className="flex items-center gap-1.5"
                >
                  <Minus className="h-4 w-4" />
                </Button>

                {/* Remove Tags Dropdown */}
                {mode === "remove-tags" && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Remove tag from {selectedCount} shot{selectedCount === 1 ? "" : "s"}
                    </p>

                    {availableTags.length > 0 ? (
                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {availableTags.map((tag) => (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                            aria-label={`Remove ${tag.label} tag from ${selectedCount} selected shot${selectedCount === 1 ? "" : "s"}`}
                          >
                            <TagBadge tag={tag} />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No tags available</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* PROPERTY OPERATIONS */}
            <div className="flex items-center gap-2 rounded-md border-r border-primary/20 pr-2">
              {/* Location Button */}
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "location" ? "default" : "outline"}
                  onClick={handleLocationClick}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5"
                  title="Set location"
                >
                  <MapPin className="h-4 w-4" />
                </Button>

                {/* Location Dropdown */}
                {mode === "location" && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Set location for {selectedCount} shot{selectedCount === 1 ? "" : "s"}
                    </p>

                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {/* Clear location option */}
                      <button
                        type="button"
                        onClick={() => handleSelectLocation(null)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                      >
                        <span className="text-slate-400 italic">Clear location</span>
                      </button>

                      {availableLocations.length > 0 ? (
                        availableLocations.map((location) => (
                          <button
                            key={location.id}
                            type="button"
                            onClick={() => handleSelectLocation(location.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                          >
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{location.name}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-2 py-1 text-sm text-slate-500">No locations available</p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Date Button */}
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "date" ? "default" : "outline"}
                  onClick={handleDateClick}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5"
                  title="Set date"
                >
                  <Calendar className="h-4 w-4" />
                </Button>

                {/* Date Dropdown */}
                {mode === "date" && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Set date for {selectedCount} shot{selectedCount === 1 ? "" : "s"}
                    </p>

                    <div className="space-y-3">
                      <input
                        type="date"
                        value={dateValue}
                        onChange={(e) => setDateValue(e.target.value)}
                        onKeyDown={handleDateKeyDown}
                        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        autoFocus
                      />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleSetDate}
                          className="flex-1"
                        >
                          Set Date
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onSetDate(null);
                            setMode(null);
                          }}
                          title="Clear date"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Type Button */}
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "type" ? "default" : "outline"}
                  onClick={handleTypeClick}
                  disabled={isProcessing}
                  className="flex items-center gap-1.5"
                  title="Set type"
                >
                  <Film className="h-4 w-4" />
                </Button>

                {/* Type Dropdown */}
                {mode === "type" && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Set type for {selectedCount} shot{selectedCount === 1 ? "" : "s"}
                    </p>

                    <div className="max-h-48 space-y-1 overflow-y-auto">
                      {/* Clear type option */}
                      <button
                        type="button"
                        onClick={() => handleSelectType("")}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                      >
                        <span className="text-slate-400 italic">Clear type</span>
                      </button>

                      {availableTypes.length > 0 ? (
                        availableTypes.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => handleSelectType(type)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                          >
                            <Film className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{type}</span>
                          </button>
                        ))
                      ) : (
                        <p className="px-2 py-1 text-sm text-slate-500">No types configured</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* PROJECT OPERATIONS */}
            <div className="flex items-center gap-2">
              {/* Move to Project Button */}
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "move" ? "default" : "outline"}
                  onClick={handleMoveClick}
                  disabled={isProcessing || otherProjects.length === 0}
                  className="flex items-center gap-1.5"
                  title="Move to project"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>

                {/* Move Dropdown */}
                {mode === "move" && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Move {selectedCount} shot{selectedCount === 1 ? "" : "s"} to project
                    </p>

                    {otherProjects.length > 0 ? (
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {otherProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => handleSelectMoveProject(project.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                          >
                            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{project.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No other projects available</p>
                    )}
                  </div>
                )}
              </div>

              {/* Copy to Project Button */}
              <div className="relative">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "copy" ? "default" : "outline"}
                  onClick={handleCopyClick}
                  disabled={isProcessing || otherProjects.length === 0}
                  className="flex items-center gap-1.5"
                  title="Copy to project"
                >
                  <Copy className="h-4 w-4" />
                </Button>

                {/* Copy Dropdown */}
                {mode === "copy" && (
                  <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Copy {selectedCount} shot{selectedCount === 1 ? "" : "s"} to project
                    </p>

                    {otherProjects.length > 0 ? (
                      <div className="max-h-64 space-y-1 overflow-y-auto">
                        {otherProjects.map((project) => (
                          <button
                            key={project.id}
                            type="button"
                            onClick={() => handleSelectCopyProject(project.id)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-slate-100"
                          >
                            <Copy className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{project.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">No other projects available</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Clear selection button */}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClearSelection}
          disabled={isProcessing}
          className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="mt-2 text-xs text-primary">Processing bulk operation...</div>
      )}
    </div>
  );
}
