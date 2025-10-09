// src/components/shots/BulkTaggingToolbar.jsx
import { useState, useRef, useEffect } from "react";
import { X, Tag, Plus, Minus } from "lucide-react";
import { Button } from "../ui/button";
import { TagBadge, TAG_COLORS } from "../ui/TagBadge";

// Default color for new tags
const DEFAULT_TAG_COLOR = "blue";

/**
 * BulkTaggingToolbar
 *
 * Sticky toolbar that appears when shots are selected, providing bulk tagging operations.
 *
 * Features:
 * - Apply tags to multiple shots at once
 * - Remove tags from multiple shots
 * - Tag selector dropdown with color picker
 * - Clear selection button
 * - Selection count display
 */
export default function BulkTaggingToolbar({
  selectedCount,
  onClearSelection,
  onApplyTags,
  onRemoveTags,
  availableTags = [],
  isProcessing = false,
}) {
  const [mode, setMode] = useState(null); // 'apply' or 'remove'
  const [selectedTagForApply, setSelectedTagForApply] = useState(null);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState(DEFAULT_TAG_COLOR);
  const [isCreatingNewTag, setIsCreatingNewTag] = useState(false);
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
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mode]);

  const handleApplyClick = () => {
    setMode(mode === "apply" ? null : "apply");
    setIsCreatingNewTag(false);
    setNewTagLabel("");
  };

  const handleRemoveClick = () => {
    setMode(mode === "remove" ? null : "remove");
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

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleCreateAndApplyTag();
    } else if (event.key === "Escape") {
      setMode(null);
      setIsCreatingNewTag(false);
    }
  };

  return (
    <div className="sticky top-28 z-30 border-b border-primary/20 bg-primary/10 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-primary">
            {selectedCount} {selectedCount === 1 ? "shot" : "shots"} selected
          </span>
          <div className="h-4 w-px bg-primary/30" />
          <div className="flex items-center gap-2" ref={dropdownRef}>
            {/* Apply Tags Button */}
            <div className="relative">
              <Button
                type="button"
                size="sm"
                variant={mode === "apply" ? "default" : "outline"}
                onClick={handleApplyClick}
                disabled={isProcessing}
                className="flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Apply Tags
              </Button>

              {/* Apply Tags Dropdown */}
              {mode === "apply" && (
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
                            onKeyDown={handleKeyDown}
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
                variant={mode === "remove" ? "default" : "outline"}
                onClick={handleRemoveClick}
                disabled={isProcessing || availableTags.length === 0}
                className="flex items-center gap-1.5"
              >
                <Minus className="h-4 w-4" />
                Remove Tags
              </Button>

              {/* Remove Tags Dropdown */}
              {mode === "remove" && (
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
          Clear selection
        </Button>
      </div>

      {/* Processing indicator */}
      {isProcessing && (
        <div className="mt-2 text-xs text-primary">Processing bulk operation...</div>
      )}
    </div>
  );
}
