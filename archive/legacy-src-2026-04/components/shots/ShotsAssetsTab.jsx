import React, { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import ScopedTalentList from "./ScopedTalentList";
import ScopedLocationList from "./ScopedLocationList";
import { projectLeakLog, projectLeakLogOnce } from "../../lib/debugProjectLeak";

/**
 * ShotsAssetsTab
 * Displays project-scoped talent and locations.
 *
 * CRITICAL: Uses URL param as single source of truth for projectId.
 * Does NOT fall back to context - if URL param is missing, this is an error state.
 */
export default function ShotsAssetsTab() {
  const { projectId } = useParams();
  const scope = useMemo(() => ({ type: "project", projectId }), [projectId]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!projectId) {
      projectLeakLog("ShotsAssetsTab:error", { reason: "URL param projectId is missing" });
      return;
    }
    projectLeakLogOnce(seenRef, `ShotsAssetsTab:${projectId}`, "render", {
      source: "URL",
      projectId,
    });
  }, [projectId]);

  // If projectId is missing, show error state (should not happen with correct routing)
  if (!projectId) {
    return (
      <div className="mx-auto max-w-7xl p-4 sm:p-6">
        <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          No project selected. Please navigate to a project first.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-8">
      <ScopedTalentList scope={scope} />
      <ScopedLocationList scope={scope} />
    </div>
  );
}
