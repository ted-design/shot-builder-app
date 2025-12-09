import React, { useState } from "react";
import { History, RotateCcw, X, User, ChevronRight } from "lucide-react";
import { Button } from "../ui/button";
import {
  useVersionHistory,
  useRestoreVersion,
  formatChangedFields,
  formatVersionTimestamp,
} from "../../hooks/useVersionHistory";
import ConfirmDialog from "../common/ConfirmDialog";

/**
 * VersionHistoryPanel - Slide-out panel showing document version history
 *
 * Features:
 * - Real-time list of document versions
 * - Shows who made changes and when
 * - Restore to any previous version
 * - Confirmation before restore
 *
 * @param {Object} props
 * @param {boolean} props.open - Whether the panel is open
 * @param {Function} props.onClose - Callback to close the panel
 * @param {string} props.clientId - Client ID
 * @param {string} props.entityType - Entity type (shots, productFamilies, talent, locations)
 * @param {string} props.entityId - Entity document ID
 * @param {string} props.entityName - Display name of the entity (for UI)
 */
export default function VersionHistoryPanel({
  open,
  onClose,
  clientId,
  entityType,
  entityId,
  entityName,
}) {
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);

  const { versions, isLoading, error } = useVersionHistory(
    clientId,
    entityType,
    entityId,
    { enabled: open }
  );

  const { restore, isRestoring } = useRestoreVersion(
    clientId,
    entityType,
    entityId,
    {
      onSuccess: () => {
        setShowRestoreConfirm(false);
        setSelectedVersion(null);
      },
    }
  );

  const handleRestoreClick = (version) => {
    setSelectedVersion(version);
    setShowRestoreConfirm(true);
  };

  const handleConfirmRestore = async () => {
    if (selectedVersion) {
      await restore(selectedVersion.id);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white dark:bg-slate-900 shadow-xl z-50 flex flex-col"
        role="dialog"
        aria-labelledby="version-history-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-slate-500" />
            <h2
              id="version-history-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Version History
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close version history"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Entity name */}
        {entityName && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {entityName}
            </p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {error && (
            <div className="p-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to load version history. Please try again.
                </p>
              </div>
            </div>
          )}

          {!isLoading && !error && versions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <History className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-center">
                No version history yet.
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center mt-1">
                Versions are saved automatically when you make changes.
              </p>
            </div>
          )}

          {!isLoading && !error && versions.length > 0 && (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {versions.map((version, index) => (
                <VersionItem
                  key={version.id}
                  version={version}
                  isLatest={index === 0}
                  onRestore={() => handleRestoreClick(version)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Versions are kept for 15 days. Older versions are automatically
            removed.
          </p>
        </div>
      </div>

      {/* Restore confirmation dialog */}
      <ConfirmDialog
        open={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={handleConfirmRestore}
        title="Restore Version"
        message={`Are you sure you want to restore to this version? The current state will be saved as a new version before restoring.`}
        confirmLabel="Restore"
        cancelLabel="Cancel"
        loading={isRestoring}
      />
    </>
  );
}

/**
 * Individual version item in the history list
 */
function VersionItem({ version, isLatest, onRestore }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const changeTypeLabels = {
    create: "Created",
    update: "Updated",
    rollback: "Restored",
  };

  const changeTypeColors = {
    create: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    update: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    rollback: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <div className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {version.createdByAvatar ? (
            <img
              src={version.createdByAvatar}
              alt={version.createdByName}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <User className="h-4 w-4 text-slate-500 dark:text-slate-400" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-slate-900 dark:text-slate-100">
              {version.createdByName}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                changeTypeColors[version.changeType] || changeTypeColors.update
              }`}
            >
              {changeTypeLabels[version.changeType] || "Updated"}
            </span>
            {isLatest && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                Current
              </span>
            )}
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {formatVersionTimestamp(version.createdAt)}
          </p>

          {/* Changed fields summary */}
          {version.changedFields && version.changedFields.length > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition-colors"
            >
              <ChevronRight
                className={`h-3 w-3 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              />
              {formatChangedFields(version.changedFields)}
            </button>
          )}

          {/* Expanded field list */}
          {isExpanded && version.changedFields && (
            <div className="mt-2 pl-4 border-l-2 border-slate-200 dark:border-slate-700">
              <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-0.5">
                {version.changedFields.map((field) => (
                  <li key={field} className="capitalize">
                    {field.replace(/([A-Z])/g, " $1").trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Restore button (hidden for current version) */}
        {!isLatest && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRestore}
            className="flex-shrink-0"
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Restore
          </Button>
        )}
      </div>
    </div>
  );
}
