import React from "react";
import { Users, User, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import {
  useEntityPresence,
  formatFieldNames,
} from "../../hooks/useEntityPresence";

/**
 * ActiveEditorsBar - Shows who is currently editing the document
 *
 * Displays a collapsible bar at the top of a modal showing active editors
 * with their avatars and which fields they're editing.
 *
 * @param {Object} props
 * @param {string} props.clientId - Client ID
 * @param {string} props.entityType - Entity type (shots, productFamilies, talent, locations)
 * @param {string} props.entityId - Entity document ID
 * @param {boolean} props.enabled - Whether to enable presence tracking (default: true)
 */
export default function ActiveEditorsBar({
  clientId,
  entityType,
  entityId,
  enabled = true,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const { activeEditors, isLoading, hasActiveEditors } = useEntityPresence(
    clientId,
    entityType,
    entityId,
    { enabled, excludeSelf: true }
  );

  // Don't render if no active editors
  if (!hasActiveEditors || isLoading) {
    return null;
  }

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
      {/* Main bar */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-2 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />

          {/* Stacked avatars */}
          <div className="flex -space-x-2">
            {activeEditors.slice(0, 3).map((editor, index) => (
              <div
                key={editor.userId}
                className="relative"
                style={{ zIndex: 3 - index }}
              >
                {editor.userAvatar ? (
                  <img
                    src={editor.userAvatar}
                    alt={editor.userName}
                    className="h-6 w-6 rounded-full border-2 border-blue-50 dark:border-blue-900 object-cover"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full border-2 border-blue-50 dark:border-blue-900 bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
                    <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
            ))}
            {activeEditors.length > 3 && (
              <div className="h-6 w-6 rounded-full border-2 border-blue-50 dark:border-blue-900 bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-medium text-blue-700 dark:text-blue-300">
                +{activeEditors.length - 3}
              </div>
            )}
          </div>

          {/* Summary text */}
          <span className="text-sm text-blue-700 dark:text-blue-300">
            {activeEditors.length === 1 ? (
              <>
                <span className="font-medium">{activeEditors[0].userName}</span>
                {" is editing"}
              </>
            ) : (
              <>
                <span className="font-medium">
                  {activeEditors.length} people
                </span>
                {" are editing"}
              </>
            )}
          </span>
        </div>

        {/* Expand/collapse icon */}
        {activeEditors.length > 0 && (
          <div className="text-blue-500 dark:text-blue-400">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </div>
        )}
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-3 pt-1 space-y-2">
          {activeEditors.map((editor) => (
            <div
              key={editor.userId}
              className="flex items-center gap-2 text-sm"
            >
              {editor.userAvatar ? (
                <img
                  src={editor.userAvatar}
                  alt={editor.userName}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center">
                  <User className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                </div>
              )}
              <span className="text-slate-700 dark:text-slate-300">
                <span className="font-medium">{editor.userName}</span>
                <span className="text-slate-500 dark:text-slate-400">
                  {" "}
                  is editing {formatFieldNames(editor.fields)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * CompactActiveEditors - A more compact version for tight spaces
 *
 * Shows just avatars with a tooltip for details.
 *
 * @param {Object} props
 * @param {string} props.clientId - Client ID
 * @param {string} props.entityType - Entity type
 * @param {string} props.entityId - Entity document ID
 * @param {boolean} props.enabled - Whether to enable presence tracking
 */
export function CompactActiveEditors({
  clientId,
  entityType,
  entityId,
  enabled = true,
}) {
  const { activeEditors, hasActiveEditors } = useEntityPresence(
    clientId,
    entityType,
    entityId,
    { enabled, excludeSelf: true }
  );

  if (!hasActiveEditors) {
    return null;
  }

  const summary =
    activeEditors.length === 1
      ? `${activeEditors[0].userName} is editing ${formatFieldNames(activeEditors[0].fields)}`
      : `${activeEditors.length} people are editing`;

  return (
    <div
      className="inline-flex items-center gap-1"
      title={summary}
    >
      <div className="flex -space-x-1.5">
        {activeEditors.slice(0, 3).map((editor, index) => (
          <div
            key={editor.userId}
            className="relative"
            style={{ zIndex: 3 - index }}
          >
            {editor.userAvatar ? (
              <img
                src={editor.userAvatar}
                alt={editor.userName}
                className="h-5 w-5 rounded-full border border-white dark:border-slate-800 object-cover"
              />
            ) : (
              <div className="h-5 w-5 rounded-full border border-white dark:border-slate-800 bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <User className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
              </div>
            )}
          </div>
        ))}
      </div>
      {activeEditors.length > 3 && (
        <span className="text-xs text-slate-500 dark:text-slate-400">
          +{activeEditors.length - 3}
        </span>
      )}
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
      </span>
    </div>
  );
}
