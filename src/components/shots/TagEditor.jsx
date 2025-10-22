// src/components/shots/TagEditor.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Tag as TagIcon, Check } from "lucide-react";
import { TagBadge, TagList, TAG_COLORS } from "../ui/TagBadge";
import { Button } from "../ui/button";
import { useAvailableTags } from "../../hooks/useAvailableTags";

/**
 * TagEditor component for adding/removing tags on shots
 *
 * Features:
 * - Display existing tags
 * - Autocomplete dropdown with existing tags from the project
 * - Select existing tags to reuse them
 * - Create new tags with color picker
 * - Remove tags
 *
 * @param {Object} props
 * @param {Array} props.tags - Current tags array
 * @param {Function} props.onChange - Callback when tags change
 * @param {string} props.clientId - Client ID for fetching available tags
 * @param {string} props.projectId - Project ID for fetching available tags
 * @param {string} props.className - Additional CSS classes
 */
export function TagEditor({ tags = [], onChange, clientId, projectId, className = "" }) {
  // Fetch available tags from the project
  const { availableTags = [], isLoading: loadingTags } = useAvailableTags(clientId, projectId);
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const pickerRef = useRef(null);

  // Filter available tags based on input, excluding already-added tags
  const filteredAvailableTags = React.useMemo(() => {
    const currentTagIds = new Set(tags.map((t) => t.id));
    const trimmedInput = newTagLabel.trim().toLowerCase();

    if (!trimmedInput) {
      // Show all available tags (that aren't already added) when input is empty
      return availableTags.filter((tag) => !currentTagIds.has(tag.id));
    }

    // Filter tags that match the input and aren't already added
    return availableTags.filter(
      (tag) =>
        !currentTagIds.has(tag.id) &&
        tag.label.toLowerCase().includes(trimmedInput)
    );
  }, [availableTags, newTagLabel, tags]);

  // Check if there's an exact match (case-insensitive) in available tags
  const exactMatch = React.useMemo(() => {
    const trimmedInput = newTagLabel.trim().toLowerCase();
    if (!trimmedInput) return null;

    return availableTags.find(
      (tag) => tag.label.toLowerCase() === trimmedInput
    );
  }, [availableTags, newTagLabel]);

  // Close picker on click outside
  useEffect(() => {
    if (!isPickerOpen) return undefined;

    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setPickerOpen(false);
        setShowColorPicker(false);
        setNewTagLabel("");
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        // If color picker is open, just close it, otherwise close the whole dropdown
        if (showColorPicker) {
          setShowColorPicker(false);
        } else {
          setPickerOpen(false);
          setNewTagLabel("");
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPickerOpen, showColorPicker]);

  // Handler for selecting an existing tag
  const handleSelectExistingTag = useCallback(
    (tag) => {
      // Check if tag is already added (shouldn't happen due to filtering, but double-check)
      const isDuplicate = tags.some((t) => t.id === tag.id);
      if (isDuplicate) {
        console.warn("[TagEditor] Tag already added:", tag.label);
        return;
      }

      // Add the existing tag with its original color
      onChange([...tags, { id: tag.id, label: tag.label, color: tag.color }]);
      setNewTagLabel("");
      setSelectedColor("blue");
      setShowColorPicker(false);
      setPickerOpen(false);
    },
    [tags, onChange]
  );

  // Handler for creating a new tag
  const handleAddTag = useCallback(() => {
    const trimmedLabel = newTagLabel.trim();
    if (!trimmedLabel) return;

    // Check if an exact match exists - if so, use that tag instead
    if (exactMatch && !tags.some((t) => t.id === exactMatch.id)) {
      handleSelectExistingTag(exactMatch);
      return;
    }

    // Check for duplicate labels (case insensitive) in current tags
    const isDuplicate = tags.some(
      (tag) => tag.label.toLowerCase() === trimmedLabel.toLowerCase()
    );

    if (isDuplicate) {
      console.warn("[TagEditor] Duplicate tag label:", trimmedLabel);
      return;
    }

    // Create new tag
    const newTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      label: trimmedLabel,
      color: selectedColor,
    };

    onChange([...tags, newTag]);
    setNewTagLabel("");
    setSelectedColor("blue");
    setShowColorPicker(false);
    setPickerOpen(false);
  }, [newTagLabel, selectedColor, tags, onChange, exactMatch, handleSelectExistingTag]);

  const handleRemoveTag = useCallback(
    (tagToRemove) => {
      onChange(tags.filter((tag) => tag.id !== tagToRemove.id));
    },
    [tags, onChange]
  );

  const handleKeyDown = useCallback(
    (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag]
  );

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Tags
        </label>
        <div className="relative" ref={pickerRef}>
          <button
            type="button"
            onClick={() => setPickerOpen(!isPickerOpen)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className={`h-3.5 w-3.5 transition-transform ${isPickerOpen ? 'rotate-45' : ''}`} />
            Add tag
          </button>

          {isPickerOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-md border border-slate-200 bg-white shadow-lg animate-fade-in animate-slide-in-from-top origin-top" style={{ animationDuration: '200ms' }}>
              <div className="p-3 space-y-3">
                {/* Input field */}
                <div>
                  <label htmlFor="tag-label" className="block text-xs font-medium text-slate-700 mb-1">
                    {showColorPicker ? "New Tag Label" : "Search or create tag"}
                  </label>
                  <input
                    id="tag-label"
                    type="text"
                    value={newTagLabel}
                    onChange={(e) => setNewTagLabel(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g., Priority, Outdoor..."
                    maxLength={50}
                    className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>

                {/* Show existing tags or color picker */}
                {!showColorPicker && newTagLabel.trim() === "" && filteredAvailableTags.length > 0 && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-md p-2 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-1">
                      <TagIcon className="h-3 w-3" />
                      Select from existing tags ({filteredAvailableTags.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredAvailableTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleSelectExistingTag(tag)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors bg-white dark:bg-slate-800"
                        >
                          <TagBadge tag={tag} />
                          <Check className="h-3 w-3 ml-auto text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!showColorPicker && newTagLabel.trim() !== "" && filteredAvailableTags.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-md p-2 border border-green-200 dark:border-green-800">
                    <p className="text-xs font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Click to reuse existing tag ({filteredAvailableTags.length} match{filteredAvailableTags.length !== 1 ? 'es' : ''})
                    </p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredAvailableTags.map((tag) => {
                        const isExactMatch = tag.label.toLowerCase() === newTagLabel.trim().toLowerCase();
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => handleSelectExistingTag(tag)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm transition-colors ${
                              isExactMatch
                                ? 'bg-green-100 dark:bg-green-900/40 hover:bg-green-200 dark:hover:bg-green-900/60 ring-2 ring-green-500'
                                : 'bg-white dark:bg-slate-800 hover:bg-green-100 dark:hover:bg-green-900/30'
                            }`}
                          >
                            <TagBadge tag={tag} />
                            {isExactMatch && (
                              <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-300">
                                Exact match
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No matching tags message */}
                {!showColorPicker && newTagLabel.trim() !== "" && filteredAvailableTags.length === 0 && !exactMatch && (
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-slate-600 dark:text-slate-400 text-center">
                      No existing tags match "{newTagLabel.trim()}"
                    </p>
                  </div>
                )}

                {/* Create new tag option */}
                {!showColorPicker && newTagLabel.trim() !== "" && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-slate-300 text-sm text-slate-600 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create "{newTagLabel.trim()}"
                  </button>
                )}

                {/* Color picker for new tag */}
                {showColorPicker && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-2">
                      Color
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                      {Object.keys(TAG_COLORS).map((colorKey, index) => {
                        const isSelected = selectedColor === colorKey;
                        const colorClass = TAG_COLORS[colorKey];

                        return (
                          <button
                            key={colorKey}
                            type="button"
                            onClick={() => setSelectedColor(colorKey)}
                            className={`h-8 w-8 rounded-md transition-all duration-150 ${colorClass.split(' ')[0]} ${
                              isSelected
                                ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                                : "hover:scale-105 active:scale-95 border border-slate-200"
                            }`}
                            style={{
                              animation: 'fade-in 150ms ease-out',
                              animationDelay: `${index * 30}ms`,
                              animationFillMode: 'both',
                            }}
                            aria-label={`Select ${colorKey} color`}
                            title={colorKey}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100">
                {showColorPicker ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddTag}
                      disabled={!newTagLabel.trim()}
                      className="flex-1"
                    >
                      Create Tag
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowColorPicker(false)}
                    >
                      Back
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setPickerOpen(false);
                      setNewTagLabel("");
                    }}
                    className="flex-1"
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Display tags */}
      <TagList
        tags={tags}
        onRemove={handleRemoveTag}
        emptyMessage="No tags added"
      />
    </div>
  );
}

export default TagEditor;
