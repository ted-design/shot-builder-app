// src/lib/paths.js (updated)

// Identifier for the client/tenant collection.  If you support multiple
// organisations you can parameterise this as needed.
export const CLIENT_ID = "unbound-merino";

/**
 * Return the currently active project ID.  We read from localStorage on
 * demand rather than caching the value at import time.  This allows the
 * active project to change at runtime (e.g. when the user clicks “Set
 * Active” in the Projects page) without requiring a full reload of the
 * module.
 */
export function getActiveProjectId() {
  return localStorage.getItem("ACTIVE_PROJECT_ID") || "default-project";
}

// Firestore path helpers.  Each helper takes a project ID (when needed)
// because the active project may change.  Call getActiveProjectId() in
// your component to obtain the current ID and pass it to these helpers.
export const projectPath = (projectId) => ["clients", CLIENT_ID, "projects", projectId];
export const shotsPath = (projectId) => [...projectPath(projectId), "shots"];
export const productsPath = ["clients", CLIENT_ID, "products"];
export const talentPath = ["clients", CLIENT_ID, "talent"];
export const locationsPath = ["clients", CLIENT_ID, "locations"];
export const lanesPath = (projectId) => [...projectPath(projectId), "lanes"];
export const pullsPath = (projectId) => [...projectPath(projectId), "pulls"];