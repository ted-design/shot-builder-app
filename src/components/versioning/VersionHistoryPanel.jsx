import React, { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { History, RotateCcw, X, User, ChevronDown, Info } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { Button } from "../ui/button";
import {
  useVersionHistory,
  useRestoreVersion,
  formatVersionTimestamp,
  getChangeSummaries,
  getNotesBeforeAfter,
  getNotesSnapshotPreview,
  getRestoreNotesComparison,
  stripNotesHtml,
} from "../../hooks/useVersionHistory";
import { notesMeaningfullyDifferent } from "../../lib/versionLogger";
import ConfirmDialog from "../common/ConfirmDialog";
import { toast as toastLib } from "../../lib/toast";

// ---------------------------------------------------------------------------
// Helpers — presentation-only, no data mutation
// ---------------------------------------------------------------------------

/**
 * Group consecutive rollback versions for compressed display.
 *
 * Returns an array of "display groups".  Most groups have a single version.
 * Consecutive rollback entries are collapsed into one group with `collapsed: true`.
 */
function groupVersionsForDisplay(versions) {
  if (!versions || versions.length === 0) return [];

  const groups = [];
  let i = 0;

  while (i < versions.length) {
    const v = versions[i];

    if (v.changeType === "rollback") {
      // Collect consecutive rollbacks
      const run = [v];
      let j = i + 1;
      while (j < versions.length && versions[j].changeType === "rollback") {
        run.push(versions[j]);
        j++;
      }

      if (run.length >= 2) {
        groups.push({ type: "rollback-group", versions: run });
      } else {
        groups.push({ type: "single", version: v, originalIndex: i });
      }
      i = j;
    } else {
      groups.push({ type: "single", version: v, originalIndex: i });
      i++;
    }
  }

  return groups;
}

/**
 * Determine if a version represents a meaningful change.
 *
 * A version is NOT meaningful if:
 * - It has no changedFields at all (metadata-only churn)
 * - Its only changedFields entry is "notes" but the visible text didn't
 *   actually change compared to the adjacent older version
 *
 * Rollback and create versions are always considered meaningful.
 */
function isVersionMeaningful(version, olderVersion) {
  // Creates and rollbacks are always meaningful
  if (version.changeType === "create" || version.changeType === "rollback") {
    return true;
  }

  const fields = version.changedFields;

  // No changedFields → metadata-only churn
  if (!fields || fields.length === 0) {
    return false;
  }

  // If the only changed field is "notes", double-check with normalized text
  if (fields.length === 1 && fields[0] === "notes" && olderVersion?.snapshot) {
    const prevNotes = olderVersion.snapshot.notes;
    const currNotes = version.snapshot?.notes;
    if (!notesMeaningfullyDifferent(prevNotes, currNotes)) {
      return false;
    }
  }

  return true;
}

/**
 * Scroll to the shot notes section and apply a temporary highlight.
 * Uses a data attribute selector to find the notes canvas element.
 */
function scrollToNotesAndHighlight() {
  // Small delay to let the panel close and Firestore subscription update the UI
  requestAnimationFrame(() => {
    setTimeout(() => {
      const notesEl =
        document.querySelector("[data-section='shot-notes']") ||
        document.querySelector("[data-testid='shot-notes-canvas']");

      if (!notesEl) return;

      notesEl.scrollIntoView({ behavior: "smooth", block: "center" });

      // Apply temporary highlight
      notesEl.style.transition = "background-color 0.3s ease";
      notesEl.style.backgroundColor = "rgb(236 253 245)"; // emerald-50
      setTimeout(() => {
        notesEl.style.backgroundColor = "transparent";
        // Clean up inline styles after transition
        setTimeout(() => {
          notesEl.style.removeProperty("transition");
          notesEl.style.removeProperty("background-color");
        }, 600);
      }, 2000);
    }, 300);
  });
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/**
 * VersionHistoryPanel - Slide-out panel showing document version history
 *
 * Features:
 * - Real-time list of document versions
 * - Shows who made changes and when
 * - Lightweight change summaries per version
 * - Grouped consecutive restore versions
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
 * @param {object} [props.currentEntityData] - Live entity data from editor context (used for restore comparison)
 */
export default function VersionHistoryPanel({
  open,
  onClose,
  clientId,
  entityType,
  entityId,
  entityName,
  currentEntityData,
}) {
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [hasNewerChanges, setHasNewerChanges] = useState(false);
  const [isCheckingPreflight, setIsCheckingPreflight] = useState(false);
  const [filterMode, setFilterMode] = useState("meaningful"); // "meaningful" | "all"

  const { versions: rawVersions, isLoading, error } = useVersionHistory(
    clientId,
    entityType,
    entityId,
    { enabled: open }
  );
  // Defensive: ensure versions is always an array even if hook returns undefined briefly
  const versions = rawVersions ?? [];

  // Filter versions based on meaningful-only mode
  const filteredVersions = useMemo(() => {
    if (filterMode === "all") return versions;
    return versions.filter((v, i) => {
      const older = i + 1 < versions.length ? versions[i + 1] : null;
      return isVersionMeaningful(v, older);
    });
  }, [versions, filterMode]);

  const meaningfulCount = useMemo(() => {
    if (filterMode === "meaningful") return filteredVersions.length;
    return versions.filter((v, i) => {
      const older = i + 1 < versions.length ? versions[i + 1] : null;
      return isVersionMeaningful(v, older);
    }).length;
  }, [versions, filteredVersions, filterMode]);

  // Build display groups (consecutive rollbacks collapsed)
  const displayGroups = useMemo(
    () => groupVersionsForDisplay(filteredVersions),
    [filteredVersions]
  );

  const { restore, isRestoring } = useRestoreVersion(
    clientId,
    entityType,
    entityId,
    {
      onSuccess: () => {
        // Check if notes were part of the restored version
        const hadNotes = selectedVersion?.changedFields?.includes("notes") ||
          selectedVersion?.snapshot?.notes !== undefined;

        // VH.4 — Post-restore sanity: check if notes actually changed
        if (hadNotes && currentEntityData) {
          const currentNorm = stripNotesHtml(currentEntityData.notes, 999999) ?? "";
          const targetNorm = stripNotesHtml(selectedVersion?.snapshot?.notes, 999999) ?? "";
          if (currentNorm === targetNorm) {
            toastLib.info({
              title: "Restored",
              description: "Notes were already up to date — no visible change.",
            });
          }
        }

        setShowRestoreConfirm(false);
        setSelectedVersion(null);
        setHasNewerChanges(false);

        // Post-restore: scroll to notes section and highlight it
        if (hadNotes) {
          scrollToNotesAndHighlight();
        }
      },
    }
  );

  /**
   * Preflight check: fetch current entity and compare updatedAt against version.createdAt.
   * If the entity has been modified after the version was created, warn the user.
   */
  const handleRestoreClick = useCallback(async (version) => {
    // Guard: prevent double-clicks while preflight is running
    if (isCheckingPreflight || isRestoring) return;

    setSelectedVersion(version);
    setIsCheckingPreflight(true);
    setHasNewerChanges(false);

    try {
      const entityRef = doc(db, "clients", clientId, entityType, entityId);
      const entityDoc = await getDoc(entityRef);

      if (!entityDoc.exists()) {
        setHasNewerChanges(true);
        setShowRestoreConfirm(true);
        return;
      }

      const entityData = entityDoc.data();
      const entityUpdatedAt = entityData?.updatedAt;
      const versionCreatedAt = version.createdAt;

      if (!entityUpdatedAt || !versionCreatedAt) {
        setHasNewerChanges(true);
      } else {
        const updatedMs = entityUpdatedAt.toMillis
          ? entityUpdatedAt.toMillis()
          : new Date(entityUpdatedAt).getTime();
        const versionMs = versionCreatedAt.toMillis
          ? versionCreatedAt.toMillis()
          : new Date(versionCreatedAt).getTime();

        setHasNewerChanges(updatedMs > versionMs);
      }

      setShowRestoreConfirm(true);
    } catch (preflightError) {
      console.error("[VersionHistoryPanel] Preflight check failed:", preflightError);
      setHasNewerChanges(true);
      setShowRestoreConfirm(true);
    } finally {
      setIsCheckingPreflight(false);
    }
  }, [clientId, entityType, entityId, isCheckingPreflight, isRestoring]);

  const handleConfirmRestore = async () => {
    if (selectedVersion) {
      await restore(selectedVersion.id);
    }
  };

  const handleCloseConfirm = useCallback(() => {
    setShowRestoreConfirm(false);
    setSelectedVersion(null);
    setHasNewerChanges(false);
  }, []);

  // Build change summaries for the selected version (shown in confirm dialog)
  const selectedSummaries = useMemo(() => {
    if (!selectedVersion) return [];
    const idx = versions.findIndex((v) => v.id === selectedVersion.id);
    const older = idx >= 0 && idx + 1 < versions.length ? versions[idx + 1] : null;
    return getChangeSummaries(selectedVersion, older, 4);
  }, [selectedVersion, versions]);

  // VH.4 — Restore notes comparison: CURRENT live state vs TARGET snapshot
  const restoreNotesComparison = useMemo(() => {
    if (!selectedVersion || !currentEntityData) return null;
    return getRestoreNotesComparison(currentEntityData, selectedVersion);
  }, [selectedVersion, currentEntityData]);

  if (!open) return null;

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-[60]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel — full-height right-side drawer */}
      <div
        className="fixed inset-y-0 right-0 w-full max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-xl z-[61] flex flex-col"
        role="dialog"
        aria-labelledby="version-history-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
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

        {/* Entity name + info note */}
        <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700">
          {entityName && (
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {entityName}
              </p>
            </div>
          )}
          <div className="flex items-start gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/10">
            <Info className="h-3.5 w-3.5 text-blue-400 dark:text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Each version shows what changed. Click a version to see
              details, or restore to revert.
            </p>
          </div>
        </div>

        {/* Scroll area */}
        <div
          className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50 dark:bg-slate-800/20"
          data-testid="version-list-scroll-area"
        >
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to load version history. Please try again.
                </p>
              </div>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <History className="h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
              <p className="font-medium text-slate-500 dark:text-slate-400 text-center">
                No versions recorded yet
              </p>
              <p className="text-sm text-slate-400 dark:text-slate-500 text-center mt-1">
                Make an edit to this shot and check back.
              </p>
            </div>
          ) : (
            <>
              {/* Section header with filter toggle */}
              <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Versions
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {filteredVersions.length}
                  </span>
                </div>
                {/* Filter toggle — pill buttons */}
                <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setFilterMode("meaningful")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      filterMode === "meaningful"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    Meaningful
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      filterMode === "all"
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              {filteredVersions.length === 0 ? (
                /* Meaningful filter empty state */
                <div className="flex flex-col items-center justify-center py-12 px-4">
                  <History className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                  <p className="font-medium text-slate-500 dark:text-slate-400 text-center">
                    No meaningful changes yet
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center mt-1">
                    Edits will appear here once something changes.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFilterMode("all")}
                    className="mt-3 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Show all {versions.length} version{versions.length === 1 ? "" : "s"}
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {displayGroups.map((group, groupIdx) => {
                    if (group.type === "rollback-group") {
                      return (
                        <RollbackGroup
                          key={group.versions[0].id}
                          group={group}
                          isFirstGroup={groupIdx === 0}
                          versions={versions}
                          onRestore={handleRestoreClick}
                          isRestoreDisabled={isCheckingPreflight || isRestoring}
                        />
                      );
                    }

                    // Determine the global index of this version in the FULL list (for diff context)
                    const globalIndex = versions.indexOf(group.version);
                    const olderVersion =
                      globalIndex >= 0 && globalIndex + 1 < versions.length
                        ? versions[globalIndex + 1]
                        : null;

                    return (
                      <VersionItem
                        key={group.version.id}
                        version={group.version}
                        olderVersion={olderVersion}
                        isCurrent={groupIdx === 0 && group.originalIndex === 0}
                        onRestore={() => handleRestoreClick(group.version)}
                        isRestoreDisabled={isCheckingPreflight || isRestoring}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer info */}
        <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 px-4 py-3">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Versions are kept for 15 days. Older versions are automatically
            removed.
          </p>
        </div>
      </div>

      {/* Restore confirmation dialog — improved copy (D) */}
      <ConfirmDialog
        open={showRestoreConfirm}
        onClose={handleCloseConfirm}
        onConfirm={handleConfirmRestore}
        title={hasNewerChanges ? "Restore — Newer Edits Will Be Overwritten" : "Restore Version"}
        message={
          <RestoreConfirmBody
            hasNewerChanges={hasNewerChanges}
            summaries={selectedSummaries}
            restoreNotesComparison={restoreNotesComparison}
          />
        }
        confirmLabel={hasNewerChanges ? "Restore Anyway" : "Restore"}
        cancelLabel="Cancel"
        variant={hasNewerChanges ? "destructive" : "default"}
        loading={isRestoring}
      />
    </>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// Restore confirmation body — shows what will change (C + D)
// ---------------------------------------------------------------------------

function RestoreConfirmBody({ hasNewerChanges, summaries, restoreNotesComparison }) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {hasNewerChanges
          ? "This shot has been edited since this version was saved. Restoring will replace the current shot with this earlier version. A backup of the current state will be saved automatically."
          : "This will replace the current shot with the selected version. A backup of the current state will be saved automatically."}
      </p>
      {/* VH.4 — Notes: CURRENT live state vs TARGET snapshot */}
      {restoreNotesComparison && (
        <div className={`rounded-md px-3 py-2 space-y-2 ${
          restoreNotesComparison.notesWillChange
            ? "bg-blue-50 dark:bg-blue-900/20"
            : "bg-slate-50 dark:bg-slate-800/40"
        }`}>
          {restoreNotesComparison.notesWillChange ? (
            <>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Notes will change:
              </p>
              <div>
                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Current</span>
                <p className="text-sm text-slate-500 dark:text-slate-400 italic leading-relaxed line-through decoration-slate-300 dark:decoration-slate-600">
                  {restoreNotesComparison.current}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Restored to</span>
                <p className="text-sm text-slate-700 dark:text-slate-200 italic leading-relaxed">
                  {restoreNotesComparison.target}
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Notes will not change — already matches this version.
            </p>
          )}
        </div>
      )}
      {summaries.length > 0 && (
        <div className="rounded-md bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Fields in this version:
          </p>
          <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
            {summaries.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsed rollback group (A — consecutive restore grouping)
// ---------------------------------------------------------------------------

function RollbackGroup({ group, isFirstGroup, versions, onRestore, isRestoreDisabled }) {
  const [expanded, setExpanded] = useState(false);
  const count = group.versions.length;
  const newest = group.versions[0];

  return (
    <div>
      {/* Group header */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
          isFirstGroup ? "bg-slate-50/50 dark:bg-slate-800/20" : ""
        }`}
      >
        <RotateCcw className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Restored {count} times
            </span>
            {isFirstGroup && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Current
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatVersionTimestamp(newest.createdAt)}
            {" — "}
            <span className="text-slate-400 dark:text-slate-500">
              {expanded ? "Hide" : "Show"} details
            </span>
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform flex-shrink-0 ${
            expanded ? "" : "-rotate-90"
          }`}
        />
      </button>

      {/* Expanded individual versions */}
      {expanded && (
        <div className="border-l-2 border-amber-200 dark:border-amber-800/40 ml-6">
          {group.versions.map((version) => {
            const globalIdx = versions.indexOf(version);
            const olderVersion =
              globalIdx >= 0 && globalIdx + 1 < versions.length
                ? versions[globalIdx + 1]
                : null;
            return (
              <VersionItem
                key={version.id}
                version={version}
                olderVersion={olderVersion}
                isCurrent={isFirstGroup && version === newest}
                onRestore={() => onRestore(version)}
                isRestoreDisabled={isRestoreDisabled}
                compact
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Individual version item (A + B + C)
// ---------------------------------------------------------------------------

function VersionItem({ version, olderVersion, isCurrent, onRestore, isRestoreDisabled, compact = false }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showEditDiff, setShowEditDiff] = useState(false);

  // --- A: Version type semantics ---
  const changeTypeConfig = {
    create: {
      label: "Created",
      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    },
    update: {
      label: "Edited",
      color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    },
    rollback: {
      label: "Restored",
      color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    },
  };

  const config = changeTypeConfig[version.changeType] || changeTypeConfig.update;
  const fieldCount = version.changedFields?.length || 0;
  const isRollback = version.changeType === "rollback";

  // --- C: Lightweight change summaries ---
  const summaries = useMemo(
    () => getChangeSummaries(version, olderVersion, 2),
    [version, olderVersion]
  );

  // --- VH.4: Snapshot-first notes preview (the state stored in THIS version) ---
  const snapshotPreview = useMemo(
    () => getNotesSnapshotPreview(version),
    [version]
  );

  // --- VH.4: Before/after diff (secondary, collapsed by default for edits) ---
  const notesBeforeAfter = useMemo(
    () => (isRollback ? null : getNotesBeforeAfter(version, olderVersion)),
    [version, olderVersion, isRollback]
  );

  return (
    <div
      className={`${compact ? "px-3 py-2" : "px-4 py-3"} hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${
        isCurrent && !compact ? "bg-slate-50/50 dark:bg-slate-800/20" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0 mt-0.5">
          {version.createdByAvatar ? (
            <img
              src={version.createdByAvatar}
              alt={version.createdByName}
              className={`${compact ? "h-6 w-6" : "h-7 w-7"} rounded-full object-cover`}
            />
          ) : (
            <div className={`${compact ? "h-6 w-6" : "h-7 w-7"} rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center`}>
              <User className={`${compact ? "h-3 w-3" : "h-3.5 w-3.5"} text-slate-500 dark:text-slate-400`} />
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Row 1: author + badges */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`font-medium ${compact ? "text-xs" : "text-sm"} text-slate-900 dark:text-slate-100`}>
              {version.createdByName}
            </span>
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium ${config.color}`}
            >
              {config.label}
            </span>
            {isCurrent && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                Current
              </span>
            )}
          </div>

          {/* Row 2: timestamp */}
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {formatVersionTimestamp(version.createdAt)}
          </p>

          {/* Row 3 (A): Restore context line — cleaner for rollbacks */}
          {isRollback && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5 italic">
              Restore event
            </p>
          )}

          {/* Row 4 (C): Inline change summaries — always visible, up to 2 */}
          {!isRollback && summaries.length > 0 && (
            <div className="mt-1 space-y-0.5">
              {summaries.map((summary, i) => (
                <p key={i} className="text-xs text-slate-500 dark:text-slate-400">
                  {summary}
                </p>
              ))}
            </div>
          )}

          {/* VH.4 — Snapshot-first notes preview (primary content cue) */}
          {snapshotPreview && (
            <div className="mt-1.5 rounded bg-slate-100 dark:bg-slate-800/60 px-2 py-1.5">
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Notes snapshot
              </span>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {snapshotPreview}
              </p>
            </div>
          )}

          {/* VH.4 — Edit diff (secondary, collapsed by default, hidden for rollbacks) */}
          {notesBeforeAfter && !isRollback && (
            <button
              type="button"
              onClick={() => setShowEditDiff(!showEditDiff)}
              className="mt-1 text-left group"
            >
              <span className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                {showEditDiff ? "Hide" : "Show"} edit diff
              </span>
            </button>
          )}
          {showEditDiff && notesBeforeAfter && !isRollback && (
            <div className="mt-1 rounded bg-slate-50 dark:bg-slate-800/40 px-2 py-1.5 space-y-1">
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                Changed in this edit:
              </span>
              {notesBeforeAfter.before !== null && (
                <div>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">Before</span>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-through decoration-slate-300 dark:decoration-slate-600">
                    {notesBeforeAfter.before}
                  </p>
                </div>
              )}
              <div>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wide">After</span>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {notesBeforeAfter.after}
                </p>
              </div>
            </div>
          )}

          {/* Row 5: expandable field list for full detail */}
          {fieldCount > 0 && (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1.5 w-full text-left group"
            >
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ChevronDown
                  className={`h-3 w-3 flex-shrink-0 transition-transform ${
                    isExpanded ? "" : "-rotate-90"
                  }`}
                />
                <span>
                  {fieldCount} {fieldCount === 1 ? "field" : "fields"}
                </span>
                <span className="text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors">
                  — {isExpanded ? "Hide" : "Show"}
                </span>
              </div>
            </button>
          )}

          {/* Expanded field list */}
          {isExpanded && version.changedFields && (
            <div className="mt-1 ml-4 pl-3 border-l-2 border-slate-200 dark:border-slate-700">
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

        {/* Action column: Restore button or Current indicator */}
        <div className="flex-shrink-0 mt-0.5">
          {isCurrent ? (
            <span className="sr-only">Current version</span>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRestore}
              disabled={isRestoreDisabled}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Restore
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
