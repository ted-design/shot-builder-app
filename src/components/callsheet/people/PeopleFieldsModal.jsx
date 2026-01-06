import React, { useCallback, useMemo, useState } from "react";
import { X, GripVertical, Eye, EyeOff, RotateCcw, Check } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";

const WIDTH_OPTIONS = [
  { value: "xs", label: "X-Small" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "X-Large" },
  { value: "hidden", label: "Hidden" },
];

export default function PeopleFieldsModal({
  isOpen,
  onClose,
  columns,
  defaultColumns,
  title = "Edit Fields",
  sectionTitle = "",
  onSectionTitleChange,
  onSave,
}) {
  const defaults = useMemo(() => (Array.isArray(defaultColumns) ? defaultColumns : []), [defaultColumns]);

  const [editedColumns, setEditedColumns] = useState(() =>
    [...(Array.isArray(columns) ? columns : defaults)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );
  const [draggedIndex, setDraggedIndex] = useState(null);

  React.useEffect(() => {
    if (!isOpen) return;
    setEditedColumns(
      [...(Array.isArray(columns) ? columns : defaults)].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    );
  }, [columns, defaults, isOpen]);

  const defaultsByKey = useMemo(() => new Map(defaults.map((col) => [col.key, col])), [defaults]);

  const handleLabelChange = useCallback((key, newLabel) => {
    setEditedColumns((prev) => prev.map((col) => (col.key === key ? { ...col, label: newLabel } : col)));
  }, []);

  const handleWidthChange = useCallback((key, newWidth) => {
    setEditedColumns((prev) =>
      prev.map((col) =>
        col.key === key
          ? {
              ...col,
              width: newWidth,
              visible: newWidth === "hidden" ? false : col.visible,
            }
          : col
      )
    );
  }, []);

  const handleToggleVisibility = useCallback((key) => {
    setEditedColumns((prev) => prev.map((col) => (col.key === key ? { ...col, visible: !col.visible } : col)));
  }, []);

  const handleResetField = useCallback(
    (key) => {
      const defaultColumn = defaultsByKey.get(key);
      if (!defaultColumn) return;
      setEditedColumns((prev) =>
        prev.map((col) => {
          if (col.key !== key) return col;
          return {
            ...col,
            label: defaultColumn.label,
            width: defaultColumn.width,
            visible: defaultColumn.visible,
          };
        })
      );
    },
    [defaultsByKey]
  );

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    setEditedColumns((prev) => {
      const next = [...prev];
      const [draggedItem] = next.splice(draggedIndex, 1);
      next.splice(index, 0, draggedItem);
      return next.map((col, idx) => ({ ...col, order: idx }));
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => setDraggedIndex(null);

  const handleReset = useCallback(() => {
    setEditedColumns([...defaults].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
  }, [defaults]);

  const handleSave = useCallback(() => {
    const sanitized = editedColumns.map((col) => {
      if (col.width === "hidden") return { ...col, visible: false };
      return col;
    });
    onSave?.(sanitized);
    onClose?.();
  }, [editedColumns, onClose, onSave]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        className="relative max-h-[85vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-xl dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-fields-title"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 id="people-fields-title" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="max-h-[calc(85vh-130px)] overflow-y-auto p-4">
          <div className="mb-4 space-y-3">
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">Section title</div>
              <div className="mt-1 text-xs text-slate-500">Used as the section header label in the call sheet.</div>
              <Input
                type="text"
                value={sectionTitle}
                onChange={(e) => onSectionTitleChange?.(e.target.value)}
                className="mt-2"
                placeholder="Talent"
              />
            </div>
            <p className="text-sm text-slate-500">
              Drag to reorder fields. Use the eye to show/hide and the size dropdown to set widths.
            </p>
          </div>

          <div className="space-y-2">
            {editedColumns.map((column, index) => (
              <div
                key={column.key}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={[
                  "flex items-center gap-3 rounded-lg border p-3 transition-all",
                  draggedIndex === index
                    ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/20"
                    : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
                  !column.visible ? "opacity-60" : "",
                ].join(" ")}
              >
                <div className="cursor-grab text-slate-400 hover:text-slate-600">
                  <GripVertical className="h-4 w-4" />
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleVisibility(column.key)}
                  className={[
                    "rounded p-1 transition-colors",
                    column.visible
                      ? "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                      : "text-slate-300 hover:bg-slate-100 dark:text-slate-600 dark:hover:bg-slate-700",
                  ].join(" ")}
                  title={column.visible ? "Hide field" : "Show field"}
                >
                  {column.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>

                <Input
                  type="text"
                  value={column.label}
                  onChange={(e) => handleLabelChange(column.key, e.target.value)}
                  className="flex-1"
                />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="min-w-[110px] justify-between">
                      {WIDTH_OPTIONS.find((opt) => opt.value === column.width)?.label || "Size"}
                      <ChevronDownIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {WIDTH_OPTIONS.map((opt) => (
                      <DropdownMenuItem key={opt.value} onClick={() => handleWidthChange(column.key, opt.value)}>
                        <span className="flex-1">{opt.label}</span>
                        {column.width === opt.value ? <Check className="h-4 w-4 text-blue-600" /> : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => handleResetField(column.key)}
                  title="Reset field"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <Button variant="outline" onClick={handleReset}>
            Reset all to default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" className="ml-2 text-slate-500">
      <path
        fill="currentColor"
        d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z"
      />
    </svg>
  );
}

