import React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../../../lib/utils";

/**
 * Single item in the Needs Attention tray (non-draggable, click to edit)
 */
function NeedsAttentionItem({ entry, diagnosticInfo, onEdit }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md cursor-pointer",
        "hover:border-amber-300 hover:bg-amber-100/50 transition-all"
      )}
      onClick={() => onEdit?.(entry)}
    >
      {/* Warning icon */}
      <div className="text-amber-500">
        <AlertTriangle className="h-3 w-3" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-700 truncate">
          {entry.resolvedTitle || entry.customData?.title || "Untitled"}
        </div>
        {/* Diagnostic subtitle */}
        <div className="text-2xs text-amber-600 font-mono truncate">
          Missing from projection • timeField={diagnosticInfo.timeField} • hasExplicitTime={String(diagnosticInfo.hasExplicitTime)}
        </div>
      </div>

      {/* Entry type badge */}
      <span className="text-3xs px-1 py-0.5 bg-amber-100 text-amber-700 rounded">
        {diagnosticInfo.isBanner ? "banner" : (entry.type || "entry")}
      </span>
    </div>
  );
}

/**
 * NeedsAttentionTray
 *
 * A DEV-only tray that displays schedule entries that couldn't be projected
 * into the schedule (missing from rowsById).
 *
 * Shows:
 * - Entry title
 * - Diagnostic info: timeField and hasExplicitTime values
 * - Click to open editor modal
 */
export default function NeedsAttentionTray({
  entries = [],
  diagnosticInfoMap = new Map(), // Map<entryId, { timeField, hasExplicitTime }>
  onEditEntry,
}) {
  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "border border-dashed border-amber-300 rounded-lg p-3 bg-amber-50/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">
          Needs Attention
        </span>
        <span className="text-2xs text-amber-600 bg-amber-200 px-1.5 py-0.5 rounded-full">
          {entries.length}
        </span>
        <span className="ml-auto text-3xs text-amber-500 bg-amber-100 px-1.5 py-0.5 rounded">
          DEV
        </span>
      </div>

      {/* Hint */}
      <p className="text-2xs text-amber-600 mb-2">
        These items couldn't be projected into the schedule. Click to edit.
      </p>

      {/* List of items */}
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => (
          <NeedsAttentionItem
            key={entry.id}
            entry={entry}
            diagnosticInfo={diagnosticInfoMap.get(entry.id) || { timeField: "unknown", hasExplicitTime: false }}
            onEdit={onEditEntry}
          />
        ))}
      </div>
    </div>
  );
}
