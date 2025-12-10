import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function OverviewToolbar({
  anchorId = "shots-toolbar-anchor",
  children,
  filterPills = [],
  onRemoveFilter,
}) {
  const content = (
    <div
      className="border-b border-neutral-200/60 dark:border-neutral-700/60 pb-4"
      role="toolbar"
      aria-label="Shots toolbar"
    >
      <div className="px-6 py-3 space-y-3">
        {children}
        {filterPills.length > 0 && (
          <div className="flex w-full flex-wrap gap-2">
            {filterPills.map((pill) => (
              <button
                key={pill.key}
                type="button"
                onClick={() => onRemoveFilter?.(pill.key)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary transition hover:bg-primary/20 dark:border-primary/30 dark:bg-primary/15"
              >
                <span>
                  {pill.label}
                  {pill.value ? `: ${pill.value}` : ""}
                </span>
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return content;
  }

  const anchor = document.getElementById(anchorId);
  return anchor ? createPortal(content, anchor) : content;
}
