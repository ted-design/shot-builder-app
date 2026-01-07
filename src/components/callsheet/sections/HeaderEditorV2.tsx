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
import {
  GripVertical,
  Trash2,
  Copy,
  Type,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Minus,
  Plus,
  Check,
  Circle,
  Square,
  ChevronDown,
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";
import type {
  DayDetails,
  CallSheetLayoutV2,
  CallSheetHeaderItem,
  CallSheetTextStyle,
} from "../../../types/callsheet";
import {
  buildCallSheetVariableContext,
  resolveCallSheetVariable,
} from "../../../lib/callsheet/variables";

type ColumnKey = "left" | "center" | "right";

const PRESET_COLORS = [
  "#000000",
  "#FFFFFF",
  "#374151",
  "#6B7280",
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
];

function getDefaultItem(type: CallSheetHeaderItem["type"]): CallSheetHeaderItem {
  if (type === "image") {
    return { type: "image", value: "", enabled: true, style: { align: "center" } };
  }
  if (type === "variable") {
    return { type: "variable", value: "@projectTitle", enabled: true, style: { align: "left", fontSize: 26 } };
  }
  return { type: "text", value: "Text", enabled: true, style: { align: "left", fontSize: 16 } };
}

function applyStyleUpdate(style: CallSheetTextStyle | null | undefined, updates: Partial<CallSheetTextStyle>) {
  const base = style && typeof style === "object" ? style : {};
  return { ...base, ...updates };
}

// Toggle Switch Component (iOS-style)
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={[
        "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
        checked ? "bg-blue-600" : "bg-slate-200",
        disabled ? "opacity-50 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <span
        className={[
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

// Font Size Stepper Component
function FontSizeStepper({
  value,
  onChange,
  disabled,
  min = 8,
  max = 72,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  const handleDecrement = () => {
    if (value > min) onChange(value - 1);
  };
  const handleIncrement = () => {
    if (value < max) onChange(value + 1);
  };

  return (
    <div className="flex items-center rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const newVal = parseInt(e.target.value, 10);
          if (!isNaN(newVal) && newVal >= min && newVal <= max) {
            onChange(newVal);
          }
        }}
        disabled={disabled}
        className="h-7 w-10 border-x border-slate-200 bg-transparent text-center text-xs font-medium focus:outline-none dark:border-slate-700"
        min={min}
        max={max}
      />
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className="flex h-7 w-7 items-center justify-center text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-700"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

// Alignment Dropdown Component
function AlignmentDropdown({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const icons = {
    left: AlignLeft,
    center: AlignCenter,
    right: AlignRight,
  };
  const Icon = icons[value as keyof typeof icons] || AlignLeft;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <Icon className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onChange("left")}>
          <AlignLeft className="mr-2 h-4 w-4" />
          Left
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("center")}>
          <AlignCenter className="mr-2 h-4 w-4" />
          Center
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("right")}>
          <AlignRight className="mr-2 h-4 w-4" />
          Right
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Color Picker Dropdown Component
function ColorPickerDropdown({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const displayColor = value || "#000000";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
        >
          <span
            className="h-4 w-4 rounded-full border border-slate-300"
            style={{ backgroundColor: displayColor }}
          />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <div className="grid grid-cols-6 gap-1.5 mb-2">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onChange(color)}
              className={[
                "h-6 w-6 rounded-full border-2 transition-transform hover:scale-110",
                displayColor === color ? "border-blue-500" : "border-transparent",
              ].join(" ")}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
          <input
            type="color"
            value={displayColor}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border-0 p-0"
          />
          <Input
            value={displayColor}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 flex-1 text-xs"
            placeholder="#000000"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Margin Control Component with uniform and individual modes
function MarginControl({
  value,
  onChange,
  disabled,
}: {
  value: { top?: number; bottom?: number; left?: number; right?: number };
  onChange: (value: { top?: number; bottom?: number; left?: number; right?: number }) => void;
  disabled?: boolean;
}) {
  const [isUniform, setIsUniform] = React.useState(true);
  const top = value.top ?? 0;
  const bottom = value.bottom ?? 0;
  const left = value.left ?? 0;
  const right = value.right ?? 0;
  const uniformValue = top; // Use top as the uniform value

  const handleUniformChange = (newVal: number) => {
    onChange({ top: newVal, bottom: newVal, left: newVal, right: newVal });
  };

  const handleIndividualChange = (side: "top" | "bottom" | "left" | "right", newVal: number) => {
    onChange({ ...value, [side]: newVal });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          title="Margins"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="space-y-3">
          {/* Mode toggle */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Margins</span>
            <div className="flex items-center gap-1 rounded border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-slate-700">
              <button
                type="button"
                onClick={() => setIsUniform(true)}
                className={[
                  "px-2 py-1 text-[10px] rounded-l transition-colors",
                  isUniform
                    ? "bg-white text-slate-800 shadow-sm dark:bg-slate-600 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
                ].join(" ")}
              >
                Uniform
              </button>
              <button
                type="button"
                onClick={() => setIsUniform(false)}
                className={[
                  "px-2 py-1 text-[10px] rounded-r transition-colors",
                  !isUniform
                    ? "bg-white text-slate-800 shadow-sm dark:bg-slate-600 dark:text-white"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400",
                ].join(" ")}
              >
                Individual
              </button>
            </div>
          </div>

          {isUniform ? (
            /* Uniform mode */
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 w-12">All</span>
              <input
                type="number"
                value={uniformValue}
                onChange={(e) => handleUniformChange(parseInt(e.target.value) || 0)}
                disabled={disabled}
                className="h-7 w-full rounded border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                min={0}
                max={100}
              />
              <span className="text-[10px] text-slate-400">px</span>
            </div>
          ) : (
            /* Individual mode */
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-8">Top</span>
                <input
                  type="number"
                  value={top}
                  onChange={(e) => handleIndividualChange("top", parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="h-6 w-full rounded border border-slate-200 bg-white px-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  min={0}
                  max={100}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-8">Btm</span>
                <input
                  type="number"
                  value={bottom}
                  onChange={(e) => handleIndividualChange("bottom", parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="h-6 w-full rounded border border-slate-200 bg-white px-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  min={0}
                  max={100}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-8">Left</span>
                <input
                  type="number"
                  value={left}
                  onChange={(e) => handleIndividualChange("left", parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="h-6 w-full rounded border border-slate-200 bg-white px-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  min={0}
                  max={100}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-500 w-8">Right</span>
                <input
                  type="number"
                  value={right}
                  onChange={(e) => handleIndividualChange("right", parseInt(e.target.value) || 0)}
                  disabled={disabled}
                  className="h-6 w-full rounded border border-slate-200 bg-white px-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  min={0}
                  max={100}
                />
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Line Height Dropdown with named presets (SetHero style)
const LINE_HEIGHT_PRESETS = [
  { value: 1.0, label: "Tight" },
  { value: 1.2, label: "Normal" },
  { value: 1.5, label: "Loose" },
  { value: 2.0, label: "Extra Loose" },
];

function getLineHeightLabel(value: number): string {
  const preset = LINE_HEIGHT_PRESETS.find((p) => Math.abs(p.value - value) < 0.05);
  return preset?.label || "Normal";
}

function LineHeightDropdown({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}) {
  const currentLabel = getLineHeightLabel(value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          <span className="min-w-[60px] text-left">{currentLabel}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {LINE_HEIGHT_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.value}
            onClick={() => onChange(preset.value)}
            className={value === preset.value ? "bg-slate-100 dark:bg-slate-700" : ""}
          >
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Sortable Header Item Component
function SortableHeaderItem({
  id,
  item,
  ctx,
  onUpdate,
  onToggle,
  onDuplicate,
  onDelete,
  disabled,
}: {
  id: string;
  item: CallSheetHeaderItem;
  ctx: Record<string, string>;
  onUpdate: (updates: Partial<CallSheetHeaderItem>) => void;
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

  const displayValue = useMemo(() => {
    if (item.type === "image") return item.value || "No image selected";
    if (item.type === "variable") return item.value;
    return item.value || "Empty text";
  }, [item]);

  const resolvedValue = useMemo(() => {
    if (item.type === "variable") {
      return resolveCallSheetVariable(item.value, ctx);
    }
    return item.value;
  }, [item, ctx]);

  const isImage = item.type === "image";
  const fontSize = item.style?.fontSize ?? 16;
  const color = item.style?.color ?? "#000000";
  const align = item.style?.align ?? "left";
  const lineHeight = item.style?.lineHeight ?? 1.2;
  const margins = {
    top: item.style?.marginTop ?? 0,
    bottom: item.style?.marginBottom ?? 0,
    left: item.style?.marginLeft ?? 0,
    right: item.style?.marginRight ?? 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-lg border bg-white dark:bg-slate-900 transition-shadow",
        item.enabled ? "border-slate-200 dark:border-slate-700" : "border-slate-200/60 dark:border-slate-700/60",
        isDragging ? "shadow-lg" : "shadow-sm",
      ].join(" ")}
    >
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {/* Drag handle */}
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
          {...attributes}
          {...listeners}
          disabled={disabled}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Type icon */}
        <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded bg-slate-100 dark:bg-slate-800">
          {isImage ? (
            <Image className="h-3.5 w-3.5 text-slate-500" />
          ) : (
            <Type className="h-3.5 w-3.5 text-slate-500" />
          )}
        </div>

        {/* Value display */}
        <div className="flex-1 min-w-0">
          <div
            className={[
              "text-sm font-medium truncate",
              item.enabled ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500",
            ].join(" ")}
            title={displayValue}
          >
            {displayValue}
          </div>
          {item.type === "variable" && resolvedValue && resolvedValue !== displayValue && (
            <div className="text-xs text-slate-400 truncate" title={resolvedValue}>
              → {resolvedValue}
            </div>
          )}
        </div>

        {/* Toggle switch */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <ToggleSwitch checked={item.enabled} onChange={() => onToggle()} disabled={disabled} />
          <span className={["text-[10px] font-medium", item.enabled ? "text-blue-600" : "text-slate-400"].join(" ")}>
            {item.enabled ? "on" : "off"}
          </span>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          className="flex-shrink-0 p-1.5 rounded text-red-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Formatting controls row */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 rounded-b-lg">
        {/* Alignment */}
        <AlignmentDropdown
          value={align}
          onChange={(val) => onUpdate({ style: applyStyleUpdate(item.style, { align: val as any }) })}
          disabled={disabled}
        />

        {/* Font size stepper (not for images) */}
        {!isImage && (
          <FontSizeStepper
            value={fontSize}
            onChange={(val) => onUpdate({ style: applyStyleUpdate(item.style, { fontSize: val }) })}
            disabled={disabled}
          />
        )}

        {/* Color picker (not for images) */}
        {!isImage && (
          <ColorPickerDropdown
            value={color}
            onChange={(val) => onUpdate({ style: applyStyleUpdate(item.style, { color: val }) })}
            disabled={disabled}
          />
        )}

        {/* Line height (not for images) */}
        {!isImage && (
          <LineHeightDropdown
            value={lineHeight}
            onChange={(val) => onUpdate({ style: applyStyleUpdate(item.style, { lineHeight: val }) })}
            disabled={disabled}
          />
        )}

        {/* Margins */}
        <MarginControl
          value={margins}
          onChange={(val) =>
            onUpdate({
              style: applyStyleUpdate(item.style, {
                marginTop: val.top,
                marginBottom: val.bottom,
                marginLeft: val.left,
                marginRight: val.right,
              }),
            })
          }
          disabled={disabled}
        />

        {/* Spacer */}
        <div className="flex-1" />

        {/* Duplicate button */}
        <button
          type="button"
          onClick={onDuplicate}
          disabled={disabled}
          className="flex-shrink-0 p-1.5 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-700"
          title="Duplicate"
        >
          <Copy className="h-4 w-4" />
        </button>
      </div>

      {/* Variable selector (inline for variable type) */}
      {item.type === "variable" && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
          <select
            className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            value={item.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            disabled={disabled}
          >
            {Object.keys(ctx).map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Text input (inline for text type) */}
      {item.type === "text" && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
          <Input
            value={item.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Enter text..."
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
      )}

      {/* Image URL input (inline for image type) */}
      {item.type === "image" && (
        <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800">
          <Input
            value={item.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Enter image URL..."
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
      )}
    </div>
  );
}

// Column Button Component with visibility toggle and shape picker
function ColumnButton({
  column,
  isActive,
  itemCount,
  disabled,
  onSelect,
  shape,
  onShapeChange,
  isVisible,
  onVisibilityToggle,
}: {
  column: ColumnKey;
  isActive: boolean;
  itemCount: number;
  disabled: boolean;
  onSelect: () => void;
  shape?: string;
  onShapeChange?: (shape: string) => void;
  isVisible: boolean;
  onVisibilityToggle: () => void;
}) {
  const [isHovered, setIsHovered] = React.useState(false);
  const isCenter = column === "center";
  const label = column.toUpperCase();

  // Get shape styling for center button
  const getShapeClass = () => {
    if (!isCenter) return "w-24 h-16 rounded-lg";
    if (shape === "circle") return "w-16 h-16 rounded-full";
    if (shape === "rectangle") return "w-20 h-14 rounded-lg";
    return "w-16 h-14 rounded-lg";
  };

  return (
    <div
      className="relative flex flex-col items-center gap-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Shape picker for center (shown above button) */}
      {isCenter && onShapeChange && (
        <div className="flex items-center gap-1 mb-1">
          <button
            type="button"
            onClick={() => onShapeChange("none")}
            disabled={disabled}
            className={[
              "w-5 h-5 flex items-center justify-center rounded transition-colors",
              shape === "none"
                ? "bg-slate-700 text-white"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400",
            ].join(" ")}
            title="No shape"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onShapeChange("rectangle")}
            disabled={disabled}
            className={[
              "w-5 h-5 flex items-center justify-center rounded transition-colors",
              shape === "rectangle"
                ? "bg-slate-700 text-white"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400",
            ].join(" ")}
            title="Rectangle"
          >
            <Square className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => onShapeChange("circle")}
            disabled={disabled}
            className={[
              "w-5 h-5 flex items-center justify-center rounded transition-colors",
              shape === "circle"
                ? "bg-slate-700 text-white"
                : "bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400",
            ].join(" ")}
            title="Circle"
          >
            <Circle className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Main column button */}
      <button
        type="button"
        onClick={onSelect}
        disabled={disabled}
        className={[
          "relative flex flex-col items-center justify-center font-semibold transition-all",
          getShapeClass(),
          isActive
            ? "bg-blue-600 text-white shadow-md"
            : isVisible
              ? "bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300"
              : "bg-slate-200 text-slate-400 dark:bg-slate-700 dark:text-slate-500",
          isCenter ? "text-xs" : "text-sm",
        ].join(" ")}
      >
        {/* Checkmark for active column */}
        {isActive && (
          <Check className={`absolute ${isCenter ? "top-0.5 right-0.5 h-3 w-3" : "top-1 right-1 h-3.5 w-3.5"}`} />
        )}

        {/* Visibility toggle (shown on hover) */}
        {isHovered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVisibilityToggle();
            }}
            className={[
              "absolute top-1 left-1 p-0.5 rounded transition-colors",
              isActive
                ? "text-white/80 hover:text-white hover:bg-white/20"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600",
            ].join(" ")}
            title={isVisible ? "Hide column" : "Show column"}
          >
            {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
        )}

        <span>{label}</span>
        {itemCount > 0 && (
          <span className={`text-[${isCenter ? "9" : "10"}px] opacity-75`}>
            {isCenter ? itemCount : `${itemCount} items`}
          </span>
        )}
      </button>
    </div>
  );
}

// Visual Column Selector Component
function VisualColumnSelector({
  activeColumn,
  onSelectColumn,
  centerShape,
  onChangeCenterShape,
  header,
  columnVisibility,
  onToggleColumnVisibility,
  disabled,
}: {
  activeColumn: ColumnKey;
  onSelectColumn: (col: ColumnKey) => void;
  centerShape: string;
  onChangeCenterShape: (shape: string) => void;
  header: CallSheetLayoutV2["header"];
  columnVisibility: { left: boolean; center: boolean; right: boolean };
  onToggleColumnVisibility: (col: ColumnKey) => void;
  disabled: boolean;
}) {
  const leftCount = header.left?.items?.length || 0;
  const centerCount = header.center?.items?.length || 0;
  const rightCount = header.right?.items?.length || 0;

  return (
    <div className="flex items-end justify-center gap-3 py-4">
      {/* LEFT column button */}
      <ColumnButton
        column="left"
        isActive={activeColumn === "left"}
        itemCount={leftCount}
        disabled={disabled}
        onSelect={() => onSelectColumn("left")}
        isVisible={columnVisibility.left}
        onVisibilityToggle={() => onToggleColumnVisibility("left")}
      />

      {/* CENTER column with shape */}
      <ColumnButton
        column="center"
        isActive={activeColumn === "center"}
        itemCount={centerCount}
        disabled={disabled}
        onSelect={() => onSelectColumn("center")}
        shape={centerShape}
        onShapeChange={onChangeCenterShape}
        isVisible={columnVisibility.center}
        onVisibilityToggle={() => onToggleColumnVisibility("center")}
      />

      {/* RIGHT column button */}
      <ColumnButton
        column="right"
        isActive={activeColumn === "right"}
        itemCount={rightCount}
        disabled={disabled}
        onSelect={() => onSelectColumn("right")}
        isVisible={columnVisibility.right}
        onVisibilityToggle={() => onToggleColumnVisibility("right")}
      />
    </div>
  );
}

// Main Header Editor Component
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
  const [activeColumn, setActiveColumn] = useState<ColumnKey>("left");

  const header = layout.header;
  const items = header[activeColumn]?.items || [];
  const centerShape = header.centerShape || "circle";

  // Column visibility state (stored in layout or derived from items)
  const columnVisibility = useMemo(() => ({
    left: header.left?.items?.some((item) => item.enabled) !== false,
    center: header.center?.items?.some((item) => item.enabled) !== false,
    right: header.right?.items?.some((item) => item.enabled) !== false,
  }), [header]);

  const toggleColumnVisibility = (col: ColumnKey) => {
    const currentItems = header[col]?.items || [];
    const anyEnabled = currentItems.some((item) => item.enabled);
    // Toggle all items in the column
    const updatedItems = currentItems.map((item) => ({ ...item, enabled: !anyEnabled }));
    updateHeader({ [col]: { items: updatedItems } } as any);
  };

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
  };

  const updateItem = (index: number, updates: Partial<CallSheetHeaderItem>) => {
    const next = items.map((it, idx) => (idx === index ? { ...it, ...updates } : it));
    updateItems(next);
  };

  const removeItem = (index: number) => {
    const next = items.filter((_, idx) => idx !== index);
    updateItems(next);
  };

  const duplicateItem = (index: number) => {
    const source = items[index];
    if (!source) return;
    const next = [...items.slice(0, index + 1), { ...source }, ...items.slice(index + 1)];
    updateItems(next);
  };

  const addItem = (type: CallSheetHeaderItem["type"]) => {
    const next = [...items, getDefaultItem(type)];
    updateItems(next);
  };

  const columnLabel = activeColumn === "left" ? "Left" : activeColumn === "center" ? "Center" : "Right";

  return (
    <div className="space-y-4">
      {/* Visual Column Selector */}
      <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Select Column</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={readOnly}>
                Load preset
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => updateHeader({ preset: "classic" })}>
                Classic
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateHeader({ preset: "center-logo" })}>
                Center logo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateHeader({ preset: "multiple-logos" })}>
                Multiple logos
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <VisualColumnSelector
          activeColumn={activeColumn}
          onSelectColumn={setActiveColumn}
          centerShape={centerShape}
          onChangeCenterShape={(shape) => updateHeader({ centerShape: shape as any })}
          header={header}
          columnVisibility={columnVisibility}
          onToggleColumnVisibility={toggleColumnVisibility}
          disabled={readOnly}
        />
      </div>

      {/* Section Title */}
      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        {columnLabel} Sections:
      </div>

      {/* Items List */}
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-400">
          No items in this column yet. Add text or an image below.
        </div>
      ) : (
        <div className="space-y-2">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {items.map((item, idx) => {
                const id = `${activeColumn}:${idx}`;
                return (
                  <SortableHeaderItem
                    key={id}
                    id={id}
                    item={item}
                    ctx={ctx}
                    onUpdate={(updates) => updateItem(idx, updates)}
                    onToggle={() => updateItem(idx, { enabled: !item.enabled })}
                    onDuplicate={() => duplicateItem(idx)}
                    onDelete={() => removeItem(idx)}
                    disabled={readOnly}
                  />
                );
              })}
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Add Buttons */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => addItem("text")}
          disabled={readOnly}
          className="gap-2"
        >
          <Type className="h-4 w-4" />
          + Add Text
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => addItem("image")}
          disabled={readOnly}
          className="gap-2"
        >
          <Image className="h-4 w-4" />
          + Add Image
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => addItem("variable")}
          disabled={readOnly}
          className="gap-2"
        >
          <span className="font-mono text-xs">@</span>
          + Add Variable
        </Button>
      </div>
    </div>
  );
}
