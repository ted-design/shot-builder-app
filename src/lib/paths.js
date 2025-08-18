// src/lib/paths.js (global shots version)

// Identifier for the client/tenant collection.  If you support multiple
// organisations you can parameterise this as needed.  This constant is
// referenced by various Firestore path helpers.
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

// -----------------------------------------------------------------------------
// Firestore path helpers
//
// The original app stored shots inside a `shots` subcollection of each
// project, which made it cumbersome to reassign shots from one project to
// another.  This version centralises shots under a single collection
// (`clients/{clientId}/shots`) and adds a `projectId` field to each shot
// document.  To fetch shots for the active project you query this root
// collection with `where('projectId', '==', getActiveProjectId())`.

// Top‑level path to a project document.  Pass a project ID (not optional)
// because project documents still live under the `projects` subcollection.
export const projectPath = (projectId) => [
  "clients",
  CLIENT_ID,
  "projects",
  projectId,
];

// Path to the global shots collection.  Do not pass a project ID here.
export const shotsPath = () => ["clients", CLIENT_ID, "shots"];

// Paths to other top‑level collections.  These remain unchanged from the
// original app because products, talent and locations are not scoped to a
// project.
export const productsPath = ["clients", CLIENT_ID, "products"];
export const talentPath = ["clients", CLIENT_ID, "talent"];
export const locationsPath = ["clients", CLIENT_ID, "locations"];

// Lanes (for the planner) remain scoped to the project.  They are stored
// under `projects/{projectId}/lanes` because each project maintains its own
// set of lanes (e.g. shoot dates).  These helpers take a project ID so you
// can explicitly target a project or call them with getActiveProjectId().
export const lanesPath = (projectId) => [...projectPath(projectId), "lanes"];

// Pulls continue to live under a project as well.  In the future you might
// centralise pulls like shots, but for now we leave the existing structure.
export const pullsPath = (projectId) => [...projectPath(projectId), "pulls"];