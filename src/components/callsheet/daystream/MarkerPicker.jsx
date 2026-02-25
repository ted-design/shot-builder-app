import React, { useState } from "react";
import PropTypes from "prop-types";
import { X, ChevronDown } from "lucide-react";
import { cn } from "../../../lib/utils";
import { MARKER_ICONS, MARKER_COLORS } from "../../../types/schedule";
import { MARKER_ICON_MAP } from "../../../lib/markerIcons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../ui/popover";

/**
 * MarkerPicker
 *
 * A compact picker for schedule entry markers (icon + color).
 * Shows as a small button that opens a popover with icon and color selection.
 * Used in DayStreamBlock and DayStreamBanner edit modes.
 */
export default function MarkerPicker({ value = null, onChange, className = "" }) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIcon, setSelectedIcon] = useState(value?.icon || null);
  const [selectedColor, setSelectedColor] = useState(
    value?.color || MARKER_COLORS[0]?.value || "#EF4444"
  );

  // Get current icon component
  const CurrentIcon = value?.icon ? MARKER_ICON_MAP[value.icon] : null;

  const handleIconSelect = (iconId) => {
    setSelectedIcon(iconId);
    // If we have both icon and color, emit the change immediately
    onChange({ icon: iconId, color: selectedColor });
  };

  const handleColorSelect = (colorValue) => {
    setSelectedColor(colorValue);
    // If we have an icon selected, update the marker
    if (selectedIcon) {
      onChange({ icon: selectedIcon, color: colorValue });
    }
  };

  const handleClear = () => {
    setSelectedIcon(null);
    onChange(null);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors",
            value
              ? "border-slate-300 bg-white hover:bg-slate-50"
              : "border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50",
            className
          )}
          title={value ? `Marker: ${value.icon}` : "Add marker"}
        >
          {value && CurrentIcon ? (
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: value.color }}
            >
              <CurrentIcon className="w-2.5 h-2.5 text-white" />
            </div>
          ) : (
            <span className="text-3xs text-slate-400">+ Icon</span>
          )}
          <ChevronDown className="w-2.5 h-2.5 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-3"
        align="start"
        side="bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-3">
          {/* Header with clear button */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-600">Marker</span>
            {value && (
              <button
                type="button"
                onClick={handleClear}
                className="text-2xs text-slate-400 hover:text-slate-600 flex items-center gap-0.5"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>

          {/* Icon grid */}
          <div>
            <div className="text-2xs text-slate-400 mb-1.5">Icon</div>
            <div className="grid grid-cols-4 gap-1.5">
              {MARKER_ICONS.map((iconDef) => {
                const IconComp = MARKER_ICON_MAP[iconDef.id];
                const isSelected = (value?.icon || selectedIcon) === iconDef.id;
                return (
                  <button
                    key={iconDef.id}
                    type="button"
                    onClick={() => handleIconSelect(iconDef.id)}
                    className={cn(
                      "w-7 h-7 rounded flex items-center justify-center transition-all",
                      isSelected
                        ? "bg-slate-100 ring-2 ring-slate-400 ring-offset-1"
                        : "hover:bg-slate-50 border border-slate-200"
                    )}
                    title={iconDef.label}
                  >
                    <IconComp className="w-4 h-4 text-slate-600" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color grid */}
          <div>
            <div className="text-2xs text-slate-400 mb-1.5">Color</div>
            <div className="grid grid-cols-4 gap-1.5">
              {MARKER_COLORS.map((colorDef) => {
                const isSelected = (value?.color || selectedColor) === colorDef.value;
                return (
                  <button
                    key={colorDef.id}
                    type="button"
                    onClick={() => handleColorSelect(colorDef.value)}
                    className={cn(
                      "w-7 h-7 rounded-full transition-all border-2",
                      isSelected
                        ? "ring-2 ring-offset-1 scale-110"
                        : "hover:scale-110 border-transparent"
                    )}
                    style={{
                      backgroundColor: colorDef.value,
                      borderColor: isSelected ? colorDef.value : "transparent",
                      "--tw-ring-color": colorDef.value,
                    }}
                    title={colorDef.label}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

MarkerPicker.propTypes = {
  /** Current marker value ({ icon: string, color: string }) or null */
  value: PropTypes.shape({
    icon: PropTypes.string.isRequired,
    color: PropTypes.string.isRequired,
  }),
  /** Callback when marker changes, receives marker object or null */
  onChange: PropTypes.func.isRequired,
  /** Additional CSS classes */
  className: PropTypes.string,
};
