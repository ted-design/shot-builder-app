// src/components/callsheet/vertical/MarkerPicker.jsx
// Marker picker for schedule entries - visual icon with colored background

import React, { useState } from "react";
import {
  Star,
  AlertTriangle,
  Clock,
  Camera,
  User,
  Zap,
  Heart,
  Flag,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "../../ui/popover";
import { MARKER_ICONS, MARKER_COLORS } from "../../../types/schedule";

/**
 * Icon component mapping from icon ID to Lucide component.
 */
const ICON_COMPONENTS = {
  star: Star,
  alert: AlertTriangle,
  clock: Clock,
  camera: Camera,
  user: User,
  zap: Zap,
  heart: Heart,
  flag: Flag,
};

/**
 * Get the icon component for a marker icon ID.
 */
export function getMarkerIcon(iconId) {
  return ICON_COMPONENTS[iconId] || Star;
}

/**
 * MarkerPicker - A popover picker for selecting marker icon + color.
 *
 * @param {object} props
 * @param {object|null} props.value - Current marker value { icon, color } or null
 * @param {Function} props.onChange - Callback when marker changes (receives marker object or null)
 * @param {boolean} props.disabled - Whether picker is disabled
 */
function MarkerPicker({ value, onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(value?.icon || "star");
  const [selectedColor, setSelectedColor] = useState(value?.color || MARKER_COLORS[0].value);

  const handleIconSelect = (iconId) => {
    setSelectedIcon(iconId);
    // Apply immediately with current color
    onChange?.({ icon: iconId, color: selectedColor });
  };

  const handleColorSelect = (colorValue) => {
    setSelectedColor(colorValue);
    // Apply immediately with current icon
    onChange?.({ icon: selectedIcon, color: colorValue });
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.(null);
    setIsOpen(false);
  };

  // Get current icon component
  const CurrentIcon = value ? getMarkerIcon(value.icon) : null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          className={[
            "relative flex h-6 w-6 items-center justify-center rounded-full transition-all",
            value
              ? "ring-1 ring-white/50 shadow-sm"
              : "border border-dashed border-slate-300 hover:border-slate-400 dark:border-slate-600 dark:hover:border-slate-500",
            disabled && "cursor-not-allowed opacity-50",
          ]
            .filter(Boolean)
            .join(" ")}
          style={value ? { backgroundColor: value.color } : undefined}
          title={value ? "Edit marker" : "Add marker"}
          aria-label={value ? "Edit marker" : "Add marker"}
        >
          {value && CurrentIcon ? (
            <CurrentIcon className="h-3.5 w-3.5 text-white" />
          ) : (
            <span className="text-xs text-slate-400">+</span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-56 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-3">
          {/* Icon grid */}
          <div>
            <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Icon
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MARKER_ICONS.map((icon) => {
                const IconComponent = ICON_COMPONENTS[icon.id];
                const isSelected = (value?.icon || selectedIcon) === icon.id;
                return (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => handleIconSelect(icon.id)}
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
                      isSelected
                        ? "bg-slate-200 dark:bg-slate-700"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800",
                    ].join(" ")}
                    title={icon.label}
                  >
                    <IconComponent className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color grid */}
          <div>
            <div className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Color
            </div>
            <div className="grid grid-cols-4 gap-2">
              {MARKER_COLORS.map((color) => {
                const isSelected = (value?.color || selectedColor) === color.value;
                return (
                  <button
                    key={color.id}
                    type="button"
                    onClick={() => handleColorSelect(color.value)}
                    className={[
                      "flex h-9 w-9 items-center justify-center rounded-lg transition-all",
                      isSelected && "ring-2 ring-slate-400 ring-offset-2 dark:ring-offset-slate-900",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    title={color.label}
                  >
                    <span
                      className="h-6 w-6 rounded-full"
                      style={{ backgroundColor: color.value }}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Clear button */}
          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-3 w-3" />
              Clear marker
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default MarkerPicker;
