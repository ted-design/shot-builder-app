// src/components/shots/TagEditor.jsx
import React, { useState, useCallback, useRef, useEffect } from "react";
import { Plus, Tag as TagIcon } from "lucide-react";
import { TagBadge, TagList, TAG_COLORS } from "../ui/TagBadge";
import { Button } from "../ui/button";

/**
 * TagEditor component for adding/removing tags on shots
 *
 * Features:
 * - Display existing tags
 * - Dropdown for creating new tags
 * - Color picker grid
 * - Label input
 * - Remove tags
 *
 * @param {Object} props
 * @param {Array} props.tags - Current tags array
 * @param {Function} props.onChange - Callback when tags change
 * @param {string} props.className - Additional CSS classes
 */
export function TagEditor({ tags = [], onChange, className = "" }) {
  const [isPickerOpen, setPickerOpen] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [selectedColor, setSelectedColor] = useState("blue");
  const pickerRef = useRef(null);

  // Close picker on click outside
  useEffect(() => {
    if (!isPickerOpen) return undefined;

    function handleClickOutside(event) {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setPickerOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setPickerOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPickerOpen]);

  const handleAddTag = useCallback(() => {
    const trimmedLabel = newTagLabel.trim();
    if (!trimmedLabel) return;

    // Check for duplicate labels (case insensitive)
    const isDuplicate = tags.some(
      (tag) => tag.label.toLowerCase() === trimmedLabel.toLowerCase()
    );

    if (isDuplicate) {
      // Optionally show a toast/error message
      console.warn("[TagEditor] Duplicate tag label:", trimmedLabel);
      return;
    }

    const newTag = {
      id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      label: trimmedLabel,
      color: selectedColor,
    };

    onChange([...tags, newTag]);
    setNewTagLabel("");
    setSelectedColor("blue");
    setPickerOpen(false);
  }, [newTagLabel, selectedColor, tags, onChange]);

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
            <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-md border border-slate-200 bg-white p-4 shadow-lg animate-fade-in animate-slide-in-from-top origin-top" style={{ animationDuration: '200ms' }}>
              <div className="space-y-3">
                <div>
                  <label htmlFor="tag-label" className="block text-xs font-medium text-slate-700 mb-1">
                    Label
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

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddTag}
                    disabled={!newTagLabel.trim()}
                    className="flex-1"
                  >
                    Add Tag
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setPickerOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
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
