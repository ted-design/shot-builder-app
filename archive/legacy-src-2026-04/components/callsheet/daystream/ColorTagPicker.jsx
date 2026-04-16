import React from "react";
import { X } from "lucide-react";
import { cn } from "../../../lib/utils";
import { COLOR_TAGS } from "../../../types/schedule";

/**
 * ColorTagPicker
 *
 * A compact color dot picker for schedule entry tagging.
 * Displays 8 color options + a clear option.
 * Used in DayStreamBlock and DayStreamBanner edit modes.
 */
export default function ColorTagPicker({ value = null, onChange, className = "" }) {
  return (
    <div className={cn("grid grid-cols-5 gap-1 w-fit", className)}>
      {/* Clear button - shown first */}
      <button
        type="button"
        onClick={() => onChange(null)}
        className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center transition-all",
          "border border-slate-300 hover:border-slate-400",
          !value
            ? "bg-slate-100 ring-2 ring-slate-400 ring-offset-1"
            : "bg-white hover:bg-slate-50"
        )}
        title="No color"
      >
        <X className="w-3 h-3 text-slate-400" />
      </button>

      {/* Color dots */}
      {COLOR_TAGS.map((color) => (
        <button
          key={color.id}
          type="button"
          onClick={() => onChange(color.id)}
          className={cn(
            "w-5 h-5 rounded-full transition-all border-2",
            value === color.id
              ? "ring-2 ring-offset-1 scale-110"
              : "hover:scale-110 border-transparent"
          )}
          style={{
            backgroundColor: color.value,
            borderColor: value === color.id ? color.value : "transparent",
            "--tw-ring-color": color.value,
          }}
          title={color.label}
        />
      ))}
    </div>
  );
}

