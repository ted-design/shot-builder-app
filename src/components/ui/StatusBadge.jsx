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
  active: "bg-emerald-100 text-emerald-800",
  new: "bg-emerald-100 text-emerald-800",
  complete: "bg-emerald-100 text-emerald-800",
  completed: "bg-emerald-100 text-emerald-800",

  // Warning/caution states - amber
  discontinued: "bg-amber-100 text-amber-800",
  pending: "bg-amber-100 text-amber-800",

  // Informational states - blue
  planning: "bg-blue-100 text-blue-800",
  info: "bg-blue-100 text-blue-800",

  // Neutral states - gray
  inactive: "bg-gray-100 text-gray-800",
  archived: "bg-gray-100 text-gray-800",

  // Error/danger states - red
  error: "bg-red-100 text-red-800",
  failed: "bg-red-100 text-red-800",
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
