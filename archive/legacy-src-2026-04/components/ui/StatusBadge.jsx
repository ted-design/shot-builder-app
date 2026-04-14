// src/components/ui/StatusBadge.jsx
import React from "react";

/**
 * StatusBadge component displays semantic status indicators with consistent
 * styling across the app. Uses pill shape (rounded-badge) and semantic colors.
 *
 * Design system specs:
 * - Height: 20px
 * - Padding: 0 8px (px-2)
 * - Border-radius: 10px (rounded-badge)
 * - Font: 12px (text-xs), medium weight (font-medium)
 */

const STATUS_COLORS = {
  // Active/positive states - emerald
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  new: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  complete: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",

  // Warning/caution states - amber
  discontinued: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "on-hold": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",

  // Informational states
  planning: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",

  // Neutral states - gray
  inactive: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",
  archived: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300",

  // Error/danger states - red
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function StatusBadge({
  status,
  variant,
  children,
  className = "",
  ...props
}) {
  // Use variant prop if provided, otherwise derive from status
  const colorKey = variant || status?.toLowerCase();
  const colorClass = STATUS_COLORS[colorKey] || STATUS_COLORS.inactive;

  return (
    <span
      className={`inline-flex items-center px-2 h-5 rounded-badge text-xs font-medium ${colorClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </span>
  );
}
