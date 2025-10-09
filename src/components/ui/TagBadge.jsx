// src/components/ui/TagBadge.jsx
import React from "react";
import { X } from "lucide-react";

/**
 * Tag color variants using Tailwind classes
 * Maps color keys to background and text colors
 */
export const TAG_COLORS = {
  red: "bg-red-100 text-red-800 border-red-200",
  orange: "bg-orange-100 text-orange-800 border-orange-200",
  amber: "bg-amber-100 text-amber-800 border-amber-200",
  yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
  green: "bg-green-100 text-green-800 border-green-200",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200",
  blue: "bg-blue-100 text-blue-800 border-blue-200",
  indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
  purple: "bg-purple-100 text-purple-800 border-purple-200",
  pink: "bg-pink-100 text-pink-800 border-pink-200",
  gray: "bg-gray-100 text-gray-800 border-gray-200",
};

/**
 * TagBadge component displays color-coded tags with optional remove action
 *
 * @param {Object} props
 * @param {Object} props.tag - Tag object with { id, label, color }
 * @param {Function} props.onRemove - Optional callback when X is clicked
 * @param {string} props.className - Additional CSS classes
 */
export function TagBadge({ tag, onRemove, className = "", ...props }) {
  if (!tag || !tag.label) return null;

  const colorClass = TAG_COLORS[tag.color] || TAG_COLORS.gray;
  const hasRemove = typeof onRemove === "function";

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 h-5 rounded-full border text-xs font-medium ${colorClass} ${className}`.trim()}
      {...props}
    >
      <span className="truncate max-w-[120px]" title={tag.label}>
        {tag.label}
      </span>
      {hasRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(tag);
          }}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
          aria-label={`Remove ${tag.label} tag`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/**
 * TagList component displays multiple tags in a flex wrap layout
 */
export function TagList({ tags, onRemove, className = "", emptyMessage = "No tags" }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return emptyMessage ? (
      <p className="text-xs text-slate-500">{emptyMessage}</p>
    ) : null;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`.trim()}>
      {tags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} onRemove={onRemove} />
      ))}
    </div>
  );
}
