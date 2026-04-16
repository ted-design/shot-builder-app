import React, { useEffect, useRef } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useProjectScope } from "../context/ProjectScopeContext";
import { LoadingOverlay } from "../components/ui/LoadingSpinner";
import { isProjectLeakDebugEnabled, projectLeakLog } from "../lib/debugProjectLeak";

/**
 * ProjectParamScope
 * Syncs :projectId from the current route into ProjectScopeContext.
 *
 * CRITICAL FIX (2025-01): We no longer block on `!ready` (localStorage hydration).
 * The URL param is the single source of truth for project-scoped routes.
 * Children render immediately with the URL projectId; context sync happens
 * in background for sidebar/nav components that still read from context.
 */
export default function ProjectParamScope() {
  const { projectId } = useParams();
  const { currentProjectId, setCurrentProjectId, ready } = useProjectScope();
  const debugLoggedRef = useRef(false);
  const mismatchStartRef = useRef(null);
  const prevSyncingRef = useRef(null);

  // Sync URL param to context (background operation - does not block render)
  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      setCurrentProjectId(projectId);
    }
  }, [projectId, currentProjectId, setCurrentProjectId]);

  // Track context sync state for debug logging only (does NOT block render)
  const isContextSyncing = projectId && projectId !== currentProjectId;

  useEffect(() => {
    if (!isProjectLeakDebugEnabled()) return;
    if (prevSyncingRef.current === isContextSyncing) return;
    prevSyncingRef.current = isContextSyncing;
    projectLeakLog(isContextSyncing ? "sync.start" : "sync.done", {
      projectId,
      currentProjectId,
      ready,
    });
  }, [isContextSyncing, projectId, currentProjectId, ready]);

  // DEV-only: log if context mismatch persists unusually long (>1s)
  // This is now for diagnostic purposes only - it doesn't block the UI
  useEffect(() => {
    if (import.meta.env.DEV && localStorage.getItem("debugProjectScope") === "1") {
      if (isContextSyncing) {
        if (!mismatchStartRef.current) {
          mismatchStartRef.current = Date.now();
          debugLoggedRef.current = false;
        }
        const timer = setTimeout(() => {
          if (isContextSyncing && !debugLoggedRef.current) {
            console.warn("[ProjectParamScope] Context sync mismatch persisted >1s (non-blocking)", {
              projectId,
              currentProjectId,
              ready,
              elapsed: Date.now() - mismatchStartRef.current,
            });
            debugLoggedRef.current = true;
          }
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        mismatchStartRef.current = null;
        debugLoggedRef.current = false;
      }
    }
  }, [isContextSyncing, projectId, currentProjectId, ready]);

  // Only block render if URL param is missing entirely (malformed route)
  const isMissingUrlParam = !projectId;
  if (isMissingUrlParam) {
    return (
      <div className="flex h-full min-h-[200px] items-center justify-center">
        <LoadingOverlay message="No project specified…" />
      </div>
    );
  }

  return <Outlet />;
}
