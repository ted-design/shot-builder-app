/**
 * ColumnLabelEditor - Inline label editing for export columns
 *
 * Shows column toggle with an edit icon. Clicking the edit icon
 * transforms the row into an inline input field for editing the label.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Pencil, Check, X, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * @typedef {Object} ColumnLabelEditorProps
 * @property {string} columnId - Unique identifier for the column
 * @property {string} defaultLabel - The default/original label
 * @property {string} currentLabel - The current (possibly custom) label
 * @property {React.ElementType} icon - Lucide icon component
 * @property {boolean} isEnabled - Whether the column is enabled
 * @property {(columnId: string) => void} onToggle - Callback when toggled
 * @property {(columnId: string, label: string) => void} onLabelChange - Callback when label changes
 * @property {(columnId: string) => void} onLabelReset - Callback to reset to default
 */

export default function ColumnLabelEditor({
  columnId,
  defaultLabel,
  currentLabel,
  icon: Icon,
  isEnabled,
  onToggle,
  onLabelChange,
  onLabelReset,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(currentLabel || defaultLabel);
  const inputRef = useRef(null);

  const hasCustomLabel = currentLabel && currentLabel !== defaultLabel;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setEditValue(currentLabel || defaultLabel);
    setIsEditing(true);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== defaultLabel) {
      onLabelChange(columnId, trimmed);
    } else {
      onLabelReset(columnId);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(currentLabel || defaultLabel);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  const handleReset = (e) => {
    e.stopPropagation();
    onLabelReset(columnId);
    setEditValue(defaultLabel);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 py-1.5 px-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        {/* Icon */}
        <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          className="flex-1 px-2 py-1 text-sm bg-white dark:bg-slate-800 border border-blue-300 dark:border-blue-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={defaultLabel}
        />

        {/* Actions */}
        <button
          type="button"
          onClick={handleSave}
          className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
        >
          <Check className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1.5 px-2 rounded-lg transition-colors',
        'hover:bg-slate-50 dark:hover:bg-slate-800/50',
        !isEnabled && 'opacity-50'
      )}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isEnabled}
        onChange={() => onToggle(columnId)}
        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
      />

      {/* Icon */}
      <Icon className="w-4 h-4 text-slate-400 flex-shrink-0" />

      {/* Label */}
      <span
        className={cn(
          'flex-1 text-sm',
          isEnabled
            ? 'text-slate-700 dark:text-slate-300'
            : 'text-slate-400 dark:text-slate-500'
        )}
      >
        {currentLabel || defaultLabel}
        {hasCustomLabel && (
          <span className="ml-1 text-xs text-blue-500">(custom)</span>
        )}
      </span>

      {/* Edit button */}
      <button
        type="button"
        onClick={handleStartEdit}
        disabled={!isEnabled}
        className={cn(
          'p-1 rounded transition-colors',
          isEnabled
            ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700'
            : 'text-slate-300 cursor-not-allowed'
        )}
        title="Edit label"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      {/* Reset button (only shown if custom) */}
      {hasCustomLabel && (
        <button
          type="button"
          onClick={handleReset}
          className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded transition-colors"
          title="Reset to default"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
