import { useMemo, useRef } from "react";
import { Eye, EyeOff, GripVertical, Lock, Unlock } from "lucide-react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

/**
 * FieldSettingsMenu
 * - Shows a dropdown listing fields with: drag handle, label, visibility toggle, and lock toggle
 * - Supports reordering via HTML5 drag & drop
 * - Dimmed label style when not visible
 * - Show All / Hide All quick actions
 *
 * Uses Radix UI DropdownMenu for automatic menu coordination
 * (closes when another dropdown opens).
 */
export default function FieldSettingsMenu({
  fields = [], // [{ key, label }]
  visibleMap = {}, // { [key]: boolean }
  lockedKeys = [], // string[]
  order = [], // string[]
  onToggleVisible, // (key) => void
  onToggleLock, // (key) => void
  onReorder, // (nextOrderArray) => void
  onShowAll, // () => void
  onHideAll, // () => void
  buttonLabel, // optional custom button label
  variant = "outline", // button variant
  iconOnly = false, // show only icon (no label)
}) {
  const dragKeyRef = useRef(null);

  const lockedSet = useMemo(
    () => new Set(Array.isArray(lockedKeys) ? lockedKeys : []),
    [lockedKeys]
  );

  // Normalised ordered list of field entries
  const orderedFields = useMemo(() => {
    const map = new Map(fields.map((f) => [f.key, f]));
    const known = new Set(map.keys());
    const base =
      Array.isArray(order) && order.length > 0
        ? order.filter((k) => known.has(k))
        : fields.map((f) => f.key);
    // Append any new/unknown keys that weren't in stored order
    const missing = fields.map((f) => f.key).filter((k) => !base.includes(k));
    return [...base, ...missing].map((k) => map.get(k));
  }, [fields, order]);

  const hiddenCount = useMemo(
    () => orderedFields.filter((f) => !visibleMap[f.key]).length,
    [orderedFields, visibleMap]
  );

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={iconOnly ? "icon" : "sm"}
          className={iconOnly ? "" : "gap-2"}
          aria-label={iconOnly ? "Field visibility" : undefined}
        >
          {hiddenCount > 0 ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
          {!iconOnly && (
            <span className="whitespace-nowrap">
              {buttonLabel || `${hiddenCount} hidden`}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-72 p-2"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header with Show All / Hide All */}
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Fields
          </span>
          <div className="flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShowAll?.();
              }}
              className="text-primary hover:underline"
            >
              Show All
            </button>
            <span className="text-slate-300 dark:text-slate-600">|</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onHideAll?.();
              }}
              className="text-primary hover:underline"
            >
              Hide All
            </button>
          </div>
        </div>

        {/* Field list with drag & drop */}
        <ul className="max-h-96 overflow-auto">
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
                  <GripVertical
                    className="h-4 w-4 flex-shrink-0 text-slate-400 cursor-grab"
                    aria-hidden="true"
                  />
                  <span
                    className={`truncate ${
                      visible
                        ? "text-slate-900 dark:text-slate-100"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${
                      locked ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    aria-label={visible ? `Hide ${label}` : `Show ${label}`}
                    aria-pressed={visible}
                    disabled={locked}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!locked) onToggleVisible?.(key);
                    }}
                  >
                    {visible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                    aria-label={locked ? `Unlock ${label}` : `Lock ${label}`}
                    aria-pressed={locked}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLock?.(key);
                    }}
                  >
                    {locked ? (
                      <Lock className="h-4 w-4" />
                    ) : (
                      <Unlock className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
