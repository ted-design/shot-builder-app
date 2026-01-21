export function isProjectLeakDebugEnabled() {
  if (!import.meta.env.DEV) return false;
  try {
    return localStorage.getItem("debugProjectLeak") === "1";
  } catch {
    return false;
  }
}

export function projectLeakLog(message, data) {
  if (!isProjectLeakDebugEnabled()) return;
  if (typeof data === "undefined") {
    console.debug(`[ProjectLeak] ${message}`);
    return;
  }
  console.debug(`[ProjectLeak] ${message}`, data);
}

export function projectLeakLogOnce(seenRef, key, message, data) {
  if (!isProjectLeakDebugEnabled()) return;
  if (!seenRef || !("current" in seenRef)) return;
  if (!seenRef.current) seenRef.current = new Set();
  if (seenRef.current.has(key)) return;
  seenRef.current.add(key);
  projectLeakLog(message, data);
}

/**
 * Warn if a query/subscription is using context-derived projectId inside a project route.
 * Should be called when a component starts a project-scoped query.
 *
 * Usage:
 *   projectLeakWarnIfContextFallback("ShotsPage", { source: "URL", projectId });
 *   // or with context fallback detection:
 *   projectLeakWarnIfContextFallback("ShotsPage", {
 *     source: urlProjectId ? "URL" : "context",
 *     projectId,
 *     urlProjectId,
 *     currentProjectId
 *   });
 */
export function projectLeakWarnIfContextFallback(componentName, { source, projectId, urlProjectId, currentProjectId }) {
  if (!isProjectLeakDebugEnabled()) return;
  if (source === "context" || (!urlProjectId && currentProjectId)) {
    console.warn(
      `[ProjectLeak] ⚠️ ${componentName} using context-derived projectId (should use URL param)`,
      { source, projectId, urlProjectId, currentProjectId }
    );
  } else {
    projectLeakLog(`${componentName}:query.start`, { source: "URL", projectId });
  }
}
