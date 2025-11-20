import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, GripVertical, Lock, Unlock } from "lucide-react";
import { Button } from "../ui/button";

/**
 * FieldSettingsMenu
 * - Shows a popover listing fields with: drag handle, label, visibility toggle, and lock toggle
 * - Supports reordering via HTML5 drag & drop
 * - Dimmed label style when not visible
 */
export default function FieldSettingsMenu({
  fields = [], // [{ key, label }]
  visibleMap = {}, // { [key]: boolean }
  lockedKeys = [], // string[]
  order = [], // string[]
  onToggleVisible, // (key) => void
  onToggleLock, // (key) => void
  onReorder, // (nextOrderArray) => void
  buttonLabel, // optional custom button label
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const dragKeyRef = useRef(null);

  const lockedSet = useMemo(() => new Set(Array.isArray(lockedKeys) ? lockedKeys : []), [lockedKeys]);

  // Normalised ordered list of field entries
  const orderedFields = useMemo(() => {
    const map = new Map(fields.map((f) => [f.key, f]));
    const known = new Set(map.keys());
    const base = Array.isArray(order) && order.length > 0 ? order.filter((k) => known.has(k)) : fields.map((f) => f.key);
    // Append any new/unknown keys that weren't in stored order
    const missing = fields.map((f) => f.key).filter((k) => !base.includes(k));
    return [...base, ...missing].map((k) => map.get(k));
  }, [fields, order]);

  const hiddenCount = useMemo(() => orderedFields.filter((f) => !visibleMap[f.key]).length, [orderedFields, visibleMap]);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (!rootRef.current) return;
      if (rootRef.current.contains(event.target)) return;
      setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleDragStart = (key) => (event) => {
    dragKeyRef.current = key;
    try {
      event.dataTransfer.setData("text/plain", key);
      event.dataTransfer.effectAllowed = "move";
    } catch (_) {}
  };
  const handleDragOver = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  };
  const handleDrop = (overKey) => (event) => {
    event.preventDefault();
    const fromKey = dragKeyRef.current;
    dragKeyRef.current = null;
    if (!fromKey || fromKey === overKey) return;
    const currentOrder = orderedFields.map((f) => f.key);
    const fromIndex = currentOrder.indexOf(fromKey);
    const toIndex = currentOrder.indexOf(overKey);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = currentOrder.slice();
    next.splice(fromIndex, 1);
    next.splice(toIndex, 0, fromKey);
    onReorder?.(next);
  };

  return (
    <div className="relative" ref={rootRef}>
      <Button
        type="button"
        variant={open ? "secondary" : "ghost"}
        size="sm"
        onClick={() => setOpen((p) => !p)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="gap-2"
      >
        {hiddenCount > 0 ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        <span className="whitespace-nowrap">
          {buttonLabel || `${hiddenCount} hidden fields`}
        </span>
      </Button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-2 text-sm shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          <ul className="max-h-96 overflow-auto py-1">
            {orderedFields.map(({ key, label }) => {
              const visible = Boolean(visibleMap[key]);
              const locked = lockedSet.has(key);
              return (
                <li
                  key={key}
                  draggable
                  onDragStart={handleDragStart(key)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop(key)}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-slate-700 hover:bg-slate-50 active:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden="true" />
                    <span
                      className={`truncate ${visible ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-500"}`}
                    >
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${locked ? "opacity-50 cursor-not-allowed" : ""}`}
                      aria-label={visible ? `Hide ${label}` : `Show ${label}`}
                      aria-pressed={visible}
                      disabled={locked}
                      onClick={() => !locked && onToggleVisible?.(key)}
                    >
                      {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                      aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
                      aria-pressed={locked}
                      onClick={() => onToggleLock?.(key)}
                    >
                      {locked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

