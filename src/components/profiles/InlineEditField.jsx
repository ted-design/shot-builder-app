/**
 * InlineEditField — Reusable inline edit component (R.4)
 *
 * Implements the canonical inline editing model from R.1/R.3:
 * - Click field → transforms to input
 * - Enter/blur → save
 * - Escape → cancel
 * - Error state shown inline
 *
 * DESIGN PRINCIPLES:
 * - Edit-in-place by default (no modals for existing entities)
 * - Clear visual affordances for edit state
 * - Optimistic UI with error rollback
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, X, Loader2 } from "lucide-react";

/**
 * InlineEditField
 *
 * @param {Object} props
 * @param {string} props.value - Current display value
 * @param {function} props.onSave - Async save handler (receives new value)
 * @param {string} [props.placeholder] - Placeholder when empty
 * @param {boolean} [props.disabled] - Disable editing
 * @param {string} [props.className] - Additional classes for the container
 * @param {string} [props.inputClassName] - Additional classes for the input
 * @param {'text'|'email'|'tel'|'url'|'textarea'} [props.type] - Input type
 * @param {boolean} [props.multiline] - Use textarea instead of input
 * @param {number} [props.rows] - Rows for textarea
 */
export default function InlineEditField({
  value = "",
  onSave,
  placeholder = "Click to edit",
  disabled = false,
  className = "",
  inputClassName = "",
  type = "text",
  multiline = false,
  rows = 3,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  // Sync with external value changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(value);
    }
  }, [value, isEditing]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for easy replacement
      if (inputRef.current.select) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleStartEdit = useCallback(() => {
    if (disabled || isSaving) return;
    setIsEditing(true);
    setEditValue(value);
    setError(null);
  }, [disabled, isSaving, value]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setEditValue(value);
    setError(null);
  }, [value]);

  const handleSave = useCallback(async () => {
    const trimmed = editValue.trim();

    // No change — just exit edit mode
    if (trimmed === (value || "").trim()) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(trimmed || null);
      setIsEditing(false);
    } catch (err) {
      console.error("[InlineEditField] Save failed:", err);
      setError(err?.message || "Failed to save");
      // Keep edit mode open on error
    } finally {
      setIsSaving(false);
    }
  }, [editValue, value, onSave]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Enter" && e.metaKey && multiline) {
      e.preventDefault();
      handleSave();
    }
  }, [handleCancel, handleSave, multiline]);

  const handleBlur = useCallback((e) => {
    // Don't save on blur if clicking save/cancel buttons
    if (e.relatedTarget?.closest("[data-inline-edit-action]")) {
      return;
    }
    handleSave();
  }, [handleSave]);

  // View mode
  if (!isEditing) {
    const isEmpty = !value || !value.trim();
    return (
      <button
        type="button"
        onClick={handleStartEdit}
        disabled={disabled}
        className={`
          group text-left w-full rounded-md px-2 py-1 -mx-2 -my-1
          transition-colors duration-150
          ${disabled
            ? "cursor-default opacity-60"
            : "hover:bg-slate-100 dark:hover:bg-slate-700/50 cursor-text"
          }
          ${className}
        `}
      >
        <span className={`
          ${isEmpty
            ? "text-slate-400 dark:text-slate-500 italic"
            : "text-slate-900 dark:text-slate-100"
          }
        `}>
          {isEmpty ? placeholder : value}
        </span>
        {!disabled && (
          <span className="ml-1 opacity-0 group-hover:opacity-50 transition-opacity text-xs text-slate-400">
            (click to edit)
          </span>
        )}
      </button>
    );
  }

  // Edit mode
  const InputComponent = multiline ? "textarea" : "input";
  const inputProps = multiline
    ? { rows }
    : { type };

  return (
    <div className={`relative ${className}`}>
      <div className="flex items-start gap-1">
        <InputComponent
          ref={inputRef}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          placeholder={placeholder}
          className={`
            flex-1 rounded-md border px-2 py-1 text-base
            transition-colors duration-150
            focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
            disabled:opacity-60 disabled:cursor-not-allowed
            ${error
              ? "border-red-300 dark:border-red-700"
              : "border-slate-300 dark:border-slate-600"
            }
            bg-white dark:bg-slate-800
            text-slate-900 dark:text-slate-100
            placeholder:text-slate-400 dark:placeholder:text-slate-500
            ${multiline ? "resize-none" : ""}
            ${inputClassName}
          `}
          {...inputProps}
        />

        {/* Save/Cancel buttons */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            type="button"
            data-inline-edit-action="save"
            onClick={handleSave}
            disabled={isSaving}
            className="p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 disabled:opacity-50"
            title="Save (Enter)"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
          <button
            type="button"
            data-inline-edit-action="cancel"
            onClick={handleCancel}
            disabled={isSaving}
            className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 disabled:opacity-50"
            title="Cancel (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
