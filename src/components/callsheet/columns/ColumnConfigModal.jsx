// src/components/callsheet/columns/ColumnConfigModal.jsx
// Modal for configuring column visibility, order, and sizes

import React, { useState, useCallback } from "react";
import {
  X,
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Check,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { DEFAULT_COLUMNS } from "../../../types/schedule";

// Width options with labels
const WIDTH_OPTIONS = [
  { value: "xs", label: "X-Small" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "X-Large" },
];

/**
 * ColumnConfigModal - Modal for editing column configuration
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether modal is open
 * @param {Function} props.onClose - Callback to close modal
 * @param {Array} props.columns - Current column configuration
 * @param {Function} props.onSave - Callback to save changes
 */
function ColumnConfigModal({
  isOpen,
  onClose,
  columns = DEFAULT_COLUMNS,
  onSave,
}) {
  // Local state for editing
  const [editedColumns, setEditedColumns] = useState(() =>
    [...columns].sort((a, b) => a.order - b.order)
  );
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Reset to match props when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setEditedColumns([...columns].sort((a, b) => a.order - b.order));
    }
  }, [isOpen, columns]);

  // Handle label change
  const handleLabelChange = useCallback((key, newLabel) => {
    setEditedColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, label: newLabel } : col
      )
    );
  }, []);

  // Handle width change
  const handleWidthChange = useCallback((key, newWidth) => {
    setEditedColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, width: newWidth } : col
      )
    );
  }, []);

  // Toggle visibility
  const handleToggleVisibility = useCallback((key) => {
    setEditedColumns((prev) =>
      prev.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col
      )
    );
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

    setEditedColumns((prev) => {
      const newColumns = [...prev];
      const [draggedItem] = newColumns.splice(draggedIndex, 1);
      newColumns.splice(index, 0, draggedItem);

      // Update order values
      return newColumns.map((col, i) => ({ ...col, order: i }));
    });

    setDraggedIndex(index);
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // Reset to defaults
  const handleReset = useCallback(() => {
    setEditedColumns([...DEFAULT_COLUMNS].sort((a, b) => a.order - b.order));
  }, []);

  // Save changes
  const handleSave = useCallback(() => {
    const sanitized = editedColumns.map((col) => {
      if (col.width === "hidden") {
        return { ...col, width: "md", visible: false };
      }
      return col;
    });
    onSave?.(sanitized);
    onClose();
  }, [editedColumns, onSave, onClose]);

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
        aria-labelledby="column-config-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2
            id="column-config-title"
            className="text-lg font-semibold text-slate-900 dark:text-slate-100"
          >
            Edit Fields
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
            Drag to reorder columns. Click the eye icon to show/hide.
          </p>

          <div className="space-y-2">
            {editedColumns.map((column, index) => (
              <div
                key={column.key}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                  draggedIndex === index
                    ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                } ${!column.visible ? "opacity-60" : ""}`}
              >
                {/* Drag handle */}
                <div className="cursor-grab text-slate-400 hover:text-slate-600">
                  <GripVertical className="h-4 w-4" />
                </div>

                {/* Visibility toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleVisibility(column.key)}
                  className={`rounded p-1 transition-colors ${
                    column.visible
                      ? "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                      : "text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-700"
                  }`}
                  title={column.visible ? "Hide column" : "Show column"}
                >
                  {column.visible ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </button>

                {/* Label input */}
                <Input
                  type="text"
                  value={column.label}
                  onChange={(e) => handleLabelChange(column.key, e.target.value)}
                  className="flex-1"
                />

                {/* Width selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="w-24">
                      {WIDTH_OPTIONS.find((w) => w.value === column.width)?.label ||
                        "Medium"}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {WIDTH_OPTIONS.map((option) => (
                      <DropdownMenuItem
                        key={option.value}
                        onClick={() => handleWidthChange(column.key, option.value)}
                        className="justify-between"
                      >
                        {option.label}
                        {column.width === option.value && (
                          <Check className="ml-2 h-4 w-4" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <Button
            variant="outline"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-4 w-4" />
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

export default ColumnConfigModal;
