/**
 * ScopeContextBar - Displays current scope (Product vs Colorway) with actions
 *
 * Design system:
 * - Subtle indicator showing current filtering scope
 * - Clear differentiation between product-level and colorway-level views
 * - Quick actions to change or clear scope
 *
 * Usage:
 * <ScopeContextBar
 *   colorway={{ id: "...", colorName: "Navy" }}
 *   onClear={() => setSelectedColorwayId(null)}
 *   onChange={() => setActiveSection("colorways")}
 * />
 */

import { X } from "lucide-react";

export default function ScopeContextBar({
  colorway,
  onClear,
  onChange,
}) {
  if (colorway) {
    // Colorway scope - show selected colorway with clear action
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-slate-400 dark:text-slate-500">for</span>
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
          {colorway.colorName}
          <button
            type="button"
            onClick={onClear}
            className="p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
            aria-label="Clear colorway filter"
          >
            <X className="w-3 h-3" />
          </button>
        </span>
        {onChange && (
          <button
            type="button"
            onClick={onChange}
            className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 underline underline-offset-2"
          >
            Change
          </button>
        )}
      </div>
    );
  }

  // Product scope - show "all colorways" indicator
  return (
    <span className="text-xs text-slate-400 dark:text-slate-500 italic">
      (All colorways)
    </span>
  );
}

/**
 * Compact variant for use inside toolbars
 */
export function ScopeContextPill({ colorway, onClear }) {
  if (!colorway) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900">
      {colorway.colorName}
      {onClear && (
        <button
          type="button"
          onClick={onClear}
          className="p-0.5 rounded-full hover:bg-slate-600 dark:hover:bg-slate-300 transition-colors"
          aria-label="Clear filter"
        >
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  );
}
