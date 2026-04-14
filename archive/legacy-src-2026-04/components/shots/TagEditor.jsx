// src/components/shots/TagEditor.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Tag as TagIcon, Check } from "lucide-react";
import {
  TagBadge,
  TagList,
  TAG_COLORS,
  getTagSwatchClasses,
} from "../ui/TagBadge";
import { Button } from "../ui/button";
import { useAvailableTags } from "../../hooks/useAvailableTags";
import { DEFAULT_TAG_GROUPS, DEFAULT_TAG_GROUP_ORDER } from "../../lib/defaultTags";

const PROJECT_GROUP_ID = "project";
const PROJECT_GROUP_LABEL = "Project Tags";
const DEFAULT_GROUP_META = new Map(
  DEFAULT_TAG_GROUPS.map((group) => [group.id, group])
);
const GROUP_ORDER_INDEX = new Map(
  DEFAULT_TAG_GROUP_ORDER.map((groupId, index) => [groupId, index])
);

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

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setShowColorPicker(false);
    setNewTagLabel("");
  }, []);

  const trimmedInput = newTagLabel.trim();
  const normalizedInput = trimmedInput.toLowerCase();

  // Organise available tags into groups, applying search filters and excluding already selected tags
  const filteredTagGroups = React.useMemo(() => {
    const currentTagIds = new Set(tags.map((t) => t.id));
    const groups = new Map();

    availableTags.forEach((tag) => {
      if (!tag || !tag.id || !tag.label) return;
      if (currentTagIds.has(tag.id)) return;

      const tagLabel = tag.label.trim();
      if (!tagLabel) return;

      if (normalizedInput && !tagLabel.toLowerCase().includes(normalizedInput)) {
        return;
      }

      const tagGroupId = tag.groupId || PROJECT_GROUP_ID;
      const meta = DEFAULT_GROUP_META.get(tagGroupId) || null;
      const groupLabel = tag.groupLabel || meta?.label || (tagGroupId === PROJECT_GROUP_ID ? PROJECT_GROUP_LABEL : "Other Tags");
      const groupDescription = tag.groupDescription || meta?.description || null;

      if (!groups.has(tagGroupId)) {
        groups.set(tagGroupId, {
          groupId: tagGroupId,
          groupLabel,
          groupDescription,
          tags: [],
        });
      }

      groups.get(tagGroupId).tags.push(tag);
    });

    const groupArray = Array.from(groups.values()).map((group) => ({
      ...group,
      tags: group.tags.sort((a, b) => a.label.localeCompare(b.label)),
    }));

    return groupArray.sort((a, b) => {
      const orderA = GROUP_ORDER_INDEX.has(a.groupId) ? GROUP_ORDER_INDEX.get(a.groupId) : Number.MAX_SAFE_INTEGER;
      const orderB = GROUP_ORDER_INDEX.has(b.groupId) ? GROUP_ORDER_INDEX.get(b.groupId) : Number.MAX_SAFE_INTEGER;

      if (orderA !== orderB) {
        return orderA - orderB;
      }

      return a.groupLabel.localeCompare(b.groupLabel);
    });
  }, [availableTags, normalizedInput, tags]);

  const totalFilteredTags = React.useMemo(
    () => filteredTagGroups.reduce((count, group) => count + group.tags.length, 0),
    [filteredTagGroups]
  );

  // Check if there's an exact match (case-insensitive) in available tags
  const exactMatch = React.useMemo(() => {
    if (!normalizedInput) return null;

    return availableTags.find(
      (tag) => tag.label.toLowerCase() === normalizedInput
    );
  }, [availableTags, normalizedInput]);

  const hasSearchTerm = Boolean(trimmedInput);
  const highlightContainerClass = hasSearchTerm
    ? "bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
    : "bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800";
  const highlightTextClass = hasSearchTerm
    ? "text-green-900 dark:text-green-100"
    : "text-blue-900 dark:text-blue-100";
  const highlightIconTone = hasSearchTerm
    ? "text-green-600 dark:text-green-300"
    : "text-blue-600 dark:text-blue-300";

  // Close picker on click outside
  useEffect(() => {
    if (!isPickerOpen) return undefined;

    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        closePicker();
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        if (showColorPicker) {
          setShowColorPicker(false);
        } else {
          closePicker();
        }
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPickerOpen, showColorPicker, closePicker]);

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
      const fallbackMeta = tag.groupId ? DEFAULT_GROUP_META.get(tag.groupId) : null;
      const groupId = tag.groupId || PROJECT_GROUP_ID;
      const groupLabel = tag.groupLabel
        || fallbackMeta?.label
        || (groupId === PROJECT_GROUP_ID ? PROJECT_GROUP_LABEL : null);
      const groupDescription = tag.groupDescription
        || fallbackMeta?.description
        || null;

      onChange([
        ...tags,
        {
          id: tag.id,
          label: tag.label,
          color: tag.color,
          groupId,
          groupLabel,
          groupDescription,
          isDefault: Boolean(tag.isDefault),
        },
      ]);
      setNewTagLabel("");
      setSelectedColor("blue");
      closePicker();
    },
    [tags, onChange, closePicker]
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
      groupId: PROJECT_GROUP_ID,
      groupLabel: PROJECT_GROUP_LABEL,
      groupDescription: null,
      isDefault: false,
    };

    onChange([...tags, newTag]);
    setNewTagLabel("");
    setSelectedColor("blue");
    closePicker();
  }, [newTagLabel, selectedColor, tags, onChange, exactMatch, handleSelectExistingTag, closePicker]);

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
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              if (isPickerOpen) {
                closePicker();
              } else {
                setPickerOpen(true);
              }
            }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-all hover:-translate-y-0.5 active:translate-y-0"
          >
            <Plus className={`h-3.5 w-3.5 transition-transform ${isPickerOpen ? 'rotate-45' : ''}`} />
            Add tag
          </button>
        </div>

        {isPickerOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6 sm:px-6">
            <div
              role="presentation"
              className="absolute inset-0 bg-slate-900/10 backdrop-blur-sm"
              onMouseDown={closePicker}
            />
            <div
              ref={pickerRef}
              role="dialog"
              aria-modal="true"
              aria-label="Tag picker"
              className="relative z-10 w-full max-w-md overflow-hidden rounded-card border border-slate-200 bg-white shadow-xl animate-fade-in dark:border-slate-700 dark:bg-slate-900"
            >
              <div className="p-4 space-y-3">
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
                {!showColorPicker && (
                  <>
                    {totalFilteredTags > 0 && (
                      <div className={`${highlightContainerClass} rounded-md p-2`}>
                        <p className={`mb-2 flex items-center gap-1 text-xs font-semibold ${highlightTextClass}`}>
                          {hasSearchTerm ? (
                            <Check className={`h-3 w-3 ${highlightIconTone}`} />
                          ) : (
                            <TagIcon className={`h-3 w-3 ${highlightIconTone}`} />
                          )}
                          {hasSearchTerm
                            ? `Click to reuse existing tag (${totalFilteredTags} match${totalFilteredTags !== 1 ? 'es' : ''})`
                            : `Select from existing tags (${totalFilteredTags})`}
                        </p>
                        <div className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
                          {filteredTagGroups.map((group) => (
                            <div key={group.groupId} className="space-y-1.5">
                              <div className="flex items-center justify-between">
                                <p className="text-xxs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                                  {group.groupLabel}
                                </p>
                                {!hasSearchTerm && group.groupDescription && (
                                  <span className="ml-2 text-2xs text-slate-400 dark:text-slate-500">
                                    {group.groupDescription}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1">
                                {group.tags.map((tag) => {
                                  const isExactMatch = hasSearchTerm && tag.label.toLowerCase() === normalizedInput;
                                  const buttonClasses = [
                                    "group flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-1.5 text-left text-sm transition-colors",
                                    hasSearchTerm
                                      ? "hover:bg-green-100 dark:hover:bg-green-900/30"
                                      : "hover:bg-blue-100 dark:hover:bg-blue-900/30",
                                    isExactMatch
                                      ? "bg-green-100 dark:bg-green-900/40 ring-1 ring-green-500"
                                      : "bg-white dark:bg-slate-800",
                                  ].join(" ");

                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={() => handleSelectExistingTag(tag)}
                                      className={buttonClasses}
                                    >
                                      <TagBadge tag={tag} />
                                      <div className="ml-auto flex items-center gap-2">
                                        {tag.isDefault && (
                                          <span className="text-2xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                            Default
                                          </span>
                                        )}
                                        {isExactMatch && (
                                          <span className="text-xs font-medium text-green-700 dark:text-green-300">
                                            Exact match
                                          </span>
                                        )}
                                        <Check className={`h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 ${highlightIconTone}`} />
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!hasSearchTerm && totalFilteredTags === 0 && !loadingTags && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        All available tags are already added. Start typing to create a new tag.
                      </div>
                    )}

                    {hasSearchTerm && totalFilteredTags === 0 && !exactMatch && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
                        No existing tags match "{trimmedInput}"
                      </div>
                    )}
                  </>
                )}

                {/* Create new tag option */}
                {!showColorPicker && hasSearchTerm && !exactMatch && (
                  <button
                    type="button"
                    onClick={() => setShowColorPicker(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-slate-300 text-sm text-slate-600 hover:border-primary hover:bg-primary/5 hover:text-primary transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                    Create "{trimmedInput}"
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
                        const swatchClasses = getTagSwatchClasses(colorKey);

                        return (
                          <button
                            key={colorKey}
                            type="button"
                            onClick={() => setSelectedColor(colorKey)}
                            className={`h-8 w-8 rounded-md transition-all duration-150 ${swatchClasses} ${
                              isSelected
                                ? "ring-2 ring-offset-2 ring-slate-900 scale-110"
                                : "hover:scale-105 active:scale-95 border border-slate-200"
                            }`}
                            style={{
                              animation: "fade-in 150ms ease-out",
                              animationDelay: `${index * 30}ms`,
                              animationFillMode: "both",
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
              <div className="flex items-center gap-2 border-t border-slate-100 px-4 py-3">
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
                    onClick={closePicker}
                    className="flex-1"
                  >
                    Close
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
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
