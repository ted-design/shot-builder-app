import React, { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import type { DayDetails, CallSheetLayoutV2, CallSheetHeaderItem, CallSheetTextStyle } from "../../../types/callsheet";
import { buildCallSheetVariableContext, resolveCallSheetVariable } from "../../../lib/callsheet/variables";

type ColumnKey = "left" | "center" | "right";

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function getColumnLabel(key: ColumnKey) {
  if (key === "left") return "Left";
  if (key === "center") return "Center";
  return "Right";
}

function getDefaultItem(type: CallSheetHeaderItem["type"]): CallSheetHeaderItem {
  if (type === "image") {
    return { type: "image", value: "", enabled: true, style: { align: "center" } };
  }
  if (type === "variable") {
    return { type: "variable", value: "@projectTitle", enabled: true, style: { align: "center" } };
  }
  return { type: "text", value: "Text", enabled: true, style: { align: "center", fontSize: 14 } };
}

function SortableItem({
  id,
  item,
  onToggle,
  onDuplicate,
  onDelete,
  disabled,
}: {
  id: string;
  item: CallSheetHeaderItem;
  onToggle: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 dark:border-slate-700 dark:bg-slate-900"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 opacity-70 group-hover:opacity-100 transition-opacity"
        {...attributes}
        {...listeners}
        aria-label="Drag header item"
        disabled={disabled}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">
          {item.type}
        </div>
        <div className="truncate text-sm text-slate-800 dark:text-slate-200">
          {item.type === "image" ? item.value || "Image URL…" : item.value || "—"}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onToggle}
          disabled={disabled}
          aria-label={item.enabled ? "Disable item" : "Enable item"}
          title={item.enabled ? "Disable item" : "Enable item"}
        >
          {item.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onDuplicate}
          disabled={disabled}
          aria-label="Duplicate item"
          title="Duplicate item"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Delete item"
          title="Delete item"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function applyStyleUpdate(style: CallSheetTextStyle | null | undefined, updates: Partial<CallSheetTextStyle>) {
  const base = style && typeof style === "object" ? style : {};
  return { ...base, ...updates };
}

export default function HeaderEditorV2({
  layout,
  schedule,
  dayDetails,
  onUpdateLayout,
  readOnly = false,
}: {
  layout: CallSheetLayoutV2;
  schedule: any;
  dayDetails: DayDetails | null;
  onUpdateLayout: (next: CallSheetLayoutV2) => void;
  readOnly?: boolean;
}) {
  const [activeColumn, setActiveColumn] = useState<ColumnKey>("center");
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const header = layout.header;
  const items = header[activeColumn]?.items || [];

  const ctx = useMemo(
    () =>
      buildCallSheetVariableContext({
        schedule,
        dayDetails,
      }),
    [dayDetails, schedule]
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => items.map((_, idx) => `${activeColumn}:${idx}`), [activeColumn, items]);

  const selectedItem = selectedIndex >= 0 && selectedIndex < items.length ? items[selectedIndex] : null;

  const updateHeader = (updates: Partial<CallSheetLayoutV2["header"]>) => {
    onUpdateLayout({ ...layout, header: { ...layout.header, ...updates } });
  };

  const updateItems = (nextItems: CallSheetHeaderItem[]) => {
    updateHeader({ [activeColumn]: { items: nextItems } } as any);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.findIndex((id) => id === active.id);
    const newIndex = ids.findIndex((id) => id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(items, oldIndex, newIndex);
    updateItems(next);
    if (selectedIndex === oldIndex) setSelectedIndex(newIndex);
  };

  const setItem = (index: number, nextItem: CallSheetHeaderItem) => {
    const next = items.map((it, idx) => (idx === index ? nextItem : it));
    updateItems(next);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, idx) => idx !== index);
    updateItems(next);
    setSelectedIndex((prev) => {
      if (prev === index) return -1;
      if (prev > index) return prev - 1;
      return prev;
    });
  };

  const duplicateItem = (index: number) => {
    const source = items[index];
    if (!source) return;
    const next = [...items.slice(0, index + 1), { ...source }, ...items.slice(index + 1)];
    updateItems(next);
    setSelectedIndex(index + 1);
  };

  const addItem = (type: CallSheetHeaderItem["type"]) => {
    const next = [...items, getDefaultItem(type)];
    updateItems(next);
    setSelectedIndex(next.length - 1);
  };

  const renderedValue = useMemo(() => {
    if (!selectedItem) return "";
    if (selectedItem.type === "variable") return resolveCallSheetVariable(selectedItem.value, ctx);
    return selectedItem.value;
  }, [ctx, selectedItem]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Header</div>
            <div className="text-xs text-slate-500">3-column layout with variables, text, and images.</div>
          </div>
          <div className="flex items-center gap-2">
            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-medium text-slate-500">Preset</span>
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={header.preset}
                onChange={(e) => updateHeader({ preset: e.target.value as any })}
                disabled={readOnly}
              >
                <option value="classic">Classic</option>
                <option value="center-logo">Center logo</option>
                <option value="multiple-logos">Multiple logos</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-[11px] font-medium text-slate-500">Center shape</span>
              <select
                className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                value={header.centerShape || "none"}
                onChange={(e) => updateHeader({ centerShape: e.target.value as any })}
                disabled={readOnly}
              >
                <option value="none">None</option>
                <option value="circle">Circle</option>
                <option value="rectangle">Rectangle</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-2 md:grid-cols-3">
          {(["left", "center", "right"] as ColumnKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveColumn(key);
                setSelectedIndex(-1);
              }}
              className={[
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                activeColumn === key
                  ? "border-blue-300 bg-blue-50 dark:border-blue-900/50 dark:bg-blue-900/20"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {getColumnLabel(key)}
              </div>
              <div className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                {(header[key]?.items?.length || 0) === 0 ? "Empty" : `${header[key].items.length} items`}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {getColumnLabel(activeColumn)} items
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => addItem("variable")}
                disabled={readOnly}
              >
                <Plus className="h-4 w-4" />
                Add variable
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => addItem("text")}
                disabled={readOnly}
              >
                <Plus className="h-4 w-4" />
                Add text
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => addItem("image")}
                disabled={readOnly}
              >
                <Plus className="h-4 w-4" />
                Add image
              </Button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
              No items in this column yet.
            </div>
          ) : (
            <div className="space-y-2">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                  {items.map((item, idx) => {
                    const id = `${activeColumn}:${idx}`;
                    return (
                      <div
                        key={id}
                        onClick={() => setSelectedIndex(idx)}
                        className={[
                          "w-full text-left cursor-pointer",
                          selectedIndex === idx ? "ring-2 ring-blue-500 rounded-md" : "",
                        ].join(" ")}
                      >
                        <SortableItem
                          id={id}
                          item={item}
                          onToggle={() => setItem(idx, { ...item, enabled: !item.enabled })}
                          onDuplicate={() => duplicateItem(idx)}
                          onDelete={() => removeItem(idx)}
                          disabled={readOnly}
                        />
                      </div>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">Edit item</div>
            {selectedItem ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelectedIndex(-1)}
                disabled={readOnly}
              >
                Done
              </Button>
            ) : null}
          </div>
          {!selectedItem ? (
            <div className="rounded-lg border border-dashed border-slate-300 p-6 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">
              Select an item to edit.
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
              {selectedItem.type === "variable" ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Variable</span>
                  <select
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={selectedItem.value}
                    onChange={(e) => setItem(selectedIndex, { ...selectedItem, value: e.target.value })}
                    disabled={readOnly}
                  >
                    {Object.keys(ctx).map((key) => (
                      <option key={key} value={key}>
                        {key} {ctx[key as keyof typeof ctx] ? `— ${ctx[key as keyof typeof ctx]}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {selectedItem.type === "text" ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Text</span>
                  <Input
                    value={selectedItem.value}
                    onChange={(e) => setItem(selectedIndex, { ...selectedItem, value: e.target.value })}
                    disabled={readOnly}
                  />
                </label>
              ) : null}

              {selectedItem.type === "image" ? (
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Image URL</span>
                  <Input
                    value={selectedItem.value}
                    onChange={(e) => setItem(selectedIndex, { ...selectedItem, value: e.target.value })}
                    placeholder="https://…"
                    disabled={readOnly}
                  />
                </label>
              ) : null}

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Align</span>
                  <select
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={selectedItem.style?.align || "left"}
                    onChange={(e) =>
                      setItem(selectedIndex, {
                        ...selectedItem,
                        style: applyStyleUpdate(selectedItem.style, { align: e.target.value as any }),
                      })
                    }
                    disabled={readOnly}
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Font size</span>
                  <Input
                    type="number"
                    value={selectedItem.style?.fontSize ?? 14}
                    onChange={(e) =>
                      setItem(selectedIndex, {
                        ...selectedItem,
                        style: applyStyleUpdate(selectedItem.style, {
                          fontSize: Number(e.target.value || 14),
                        }),
                      })
                    }
                    disabled={readOnly || selectedItem.type === "image"}
                    min={8}
                    max={48}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Color</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={isHexColor(selectedItem.style?.color || "") ? (selectedItem.style?.color as string) : "#0F172A"}
                      onChange={(e) =>
                        setItem(selectedIndex, {
                          ...selectedItem,
                          style: applyStyleUpdate(selectedItem.style, { color: e.target.value }),
                        })
                      }
                      className="h-10 w-12 rounded border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900"
                      disabled={readOnly || selectedItem.type === "image"}
                      aria-label="Text color"
                    />
                    <Input
                      value={selectedItem.style?.color || ""}
                      onChange={(e) =>
                        setItem(selectedIndex, {
                          ...selectedItem,
                          style: applyStyleUpdate(selectedItem.style, { color: e.target.value }),
                        })
                      }
                      placeholder="#0F172A"
                      disabled={readOnly || selectedItem.type === "image"}
                    />
                  </div>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Line height</span>
                  <Input
                    type="number"
                    value={selectedItem.style?.lineHeight ?? 1.2}
                    onChange={(e) =>
                      setItem(selectedIndex, {
                        ...selectedItem,
                        style: applyStyleUpdate(selectedItem.style, {
                          lineHeight: Number(e.target.value || 1.2),
                        }),
                      })
                    }
                    disabled={readOnly || selectedItem.type === "image"}
                    min={0.8}
                    max={3}
                    step={0.1}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Margin top (px)</span>
                  <Input
                    type="number"
                    value={selectedItem.style?.marginTop ?? 0}
                    onChange={(e) =>
                      setItem(selectedIndex, {
                        ...selectedItem,
                        style: applyStyleUpdate(selectedItem.style, {
                          marginTop: Number(e.target.value || 0),
                        }),
                      })
                    }
                    disabled={readOnly}
                    step={1}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Margin bottom (px)</span>
                  <Input
                    type="number"
                    value={selectedItem.style?.marginBottom ?? 0}
                    onChange={(e) =>
                      setItem(selectedIndex, {
                        ...selectedItem,
                        style: applyStyleUpdate(selectedItem.style, {
                          marginBottom: Number(e.target.value || 0),
                        }),
                      })
                    }
                    disabled={readOnly}
                    step={1}
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="grid gap-1 text-sm">
                  <span className="text-xs font-medium text-slate-500">Text wrap</span>
                  <select
                    className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                    value={selectedItem.style?.wrap || "wrap"}
                    onChange={(e) =>
                      setItem(selectedIndex, {
                        ...selectedItem,
                        style: applyStyleUpdate(selectedItem.style, { wrap: e.target.value as any }),
                      })
                    }
                    disabled={readOnly || selectedItem.type === "image"}
                  >
                    <option value="wrap">Wrap</option>
                    <option value="nowrap">No wrap</option>
                  </select>
                </label>

                <div className="md:col-span-2 flex items-end justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setItem(selectedIndex, {
                        ...selectedItem,
                        style: applyStyleUpdate(selectedItem.style, {
                          fontSize: 14,
                          color: "#0F172A",
                          align: "left",
                          lineHeight: 1.2,
                          marginTop: 0,
                          marginBottom: 0,
                          marginLeft: 0,
                          marginRight: 0,
                          wrap: "wrap",
                        }),
                      })
                    }
                    disabled={readOnly}
                  >
                    Reset formatting
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-300">
                Preview value: <span className="font-medium">{renderedValue || "—"}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
