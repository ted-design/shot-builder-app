// Minimal scope helper to derive project/org scope from context
// JSDoc mirrors the TS type in src/types/scope.ts

import { useProjectScope } from "../context/ProjectScopeContext";

/**
 * @typedef {{ type: 'org' } | { type: 'project', projectId: string }} Scope
 */

/**
 * Returns a Scope object based on the current ProjectScopeContext.
 * If no active project is selected, returns org scope.
 * @returns {Scope}
 */
export function useScopeFromContext() {
  const { currentProjectId } = useProjectScope();
  if (currentProjectId) return { type: "project", projectId: currentProjectId };
  return { type: "org" };
}

/**
 * Utility to build a Scope explicitly
 * @param {'org'|'project'} type
 * @param {string=} projectId
 * @returns {Scope}
 */
export function buildScope(type, projectId) {
  if (type === "project" && projectId) return { type: "project", projectId };
  return { type: "org" };
}

