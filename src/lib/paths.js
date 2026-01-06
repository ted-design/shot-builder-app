// src/lib/paths.js (global shots version)

import { readStorage } from "./safeStorage";

// Identifier for the client/tenant collection.  If you support multiple
// organisations you can parameterise this as needed.  This constant is
// referenced by various Firestore path helpers.
export const CLIENT_ID = "unbound-merino";

const resolveClientId = (explicitClientId) => explicitClientId ?? CLIENT_ID;

/**
 * Return the currently active project ID.  We read from localStorage on
 * demand rather than caching the value at import time.  This allows the
 * active project to change at runtime (e.g. when the user clicks “Set
 * Active” in the Projects page) without requiring a full reload of the
 * module.
 */
export const DEFAULT_PROJECT_ID = "default-project";

export function getActiveProjectId() {
  const stored = readStorage("ACTIVE_PROJECT_ID", DEFAULT_PROJECT_ID);
  if (stored && typeof stored === "string") {
    return stored;
  }
  return DEFAULT_PROJECT_ID;
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

// Path to the projects collection
export const projectsPath = (clientId) => [
  "clients",
  resolveClientId(clientId),
  "projects",
];

// Top‑level path to a project document.  Pass a project ID (not optional)
// because project documents still live under the `projects` subcollection.
export const projectPath = (projectId, clientId) => [
  "clients",
  resolveClientId(clientId),
  "projects",
  projectId,
];

// Path to the global shots collection.  Do not pass a project ID here.
export const shotsPath = (clientId) => ["clients", resolveClientId(clientId), "shots"];

// Legacy project-scoped shots path retained for backwards compatibility. Older
// installs stored shots under each project (`projects/{projectId}/shots`).
// Planner and shot management screens can subscribe to this collection to
// surface pre-migration data alongside the new global shots collection.
export const legacyProjectShotsPath = (projectId, clientId) => [
  ...projectPath(projectId, clientId),
  "shots",
];

// Paths to other top‑level collections.  These remain unchanged from the
// original app because products, talent and locations are not scoped to a
// project.
export const legacyProductsPath = (clientId) => [
  "clients",
  resolveClientId(clientId),
  "products",
];
export const productFamiliesPath = (clientId) => [
  "clients",
  resolveClientId(clientId),
  "productFamilies",
];
export const productsPath = (clientId) => productFamiliesPath(clientId);
export const productFamilyPath = (familyId, clientId) => [
  ...productFamiliesPath(clientId),
  familyId,
];
export const productFamilySkusPath = (familyId, clientId) => [
  ...productFamiliesPath(clientId),
  familyId,
  "skus",
];
export const productFamilySkuPath = (familyId, skuId, clientId) => [
  ...productFamiliesPath(clientId),
  familyId,
  "skus",
  skuId,
];
export const talentPath = (clientId) => ["clients", resolveClientId(clientId), "talent"];
export const locationsPath = (clientId) => ["clients", resolveClientId(clientId), "locations"];
export const crewPath = (clientId) => ["clients", resolveClientId(clientId), "crew"];
export const crewMemberPath = (crewMemberId, clientId) => [...crewPath(clientId), crewMemberId];

// Lanes (for the planner) remain scoped to the project.  They are stored
// under `projects/{projectId}/lanes` because each project maintains its own
// set of lanes (e.g. shoot dates).  These helpers take a project ID so you
// can explicitly target a project or call them with getActiveProjectId().
export const lanesPath = (projectId, clientId) => [...projectPath(projectId, clientId), "lanes"];

// Pulls continue to live under a project as well.  In the future you might
// centralise pulls like shots, but for now we leave the existing structure.
export const pullsPath = (projectId, clientId) => [...projectPath(projectId, clientId), "pulls"];

// Centralised color swatches (per-client)
export const colorSwatchesPath = (clientId) => [
  "clients",
  resolveClientId(clientId),
  "colorSwatches",
];
export const colorSwatchPath = (colorKey, clientId) => [
  ...colorSwatchesPath(clientId),
  colorKey,
];

// =============================================================================
// Schedule paths (for Call Sheet Builder)
// =============================================================================

// Path to all schedules for a project
export const schedulesPath = (projectId, clientId) => [
  ...projectPath(projectId, clientId),
  "schedules",
];

// Path to a specific schedule document
export const schedulePath = (projectId, scheduleId, clientId) => [
  ...schedulesPath(projectId, clientId),
  scheduleId,
];

// Path to schedule entries subcollection
export const scheduleEntriesPath = (projectId, scheduleId, clientId) => [
  ...schedulePath(projectId, scheduleId, clientId),
  "entries",
];

// Path to a specific schedule entry
export const scheduleEntryPath = (projectId, scheduleId, entryId, clientId) => [
  ...scheduleEntriesPath(projectId, scheduleId, clientId),
  entryId,
];

// =============================================================================
// Project crew paths
// =============================================================================

// Path to all crew assignments for a project
export const projectCrewAssignmentsPath = (projectId, clientId) => [
  ...projectPath(projectId, clientId),
  "crewAssignments",
];

// Path to a specific crew assignment document
export const projectCrewAssignmentPath = (projectId, assignmentId, clientId) => [
  ...projectCrewAssignmentsPath(projectId, clientId),
  assignmentId,
];

// =============================================================================
// Department paths (org + project)
// =============================================================================

// Organization-wide departments live under the client.
export const departmentsPath = (clientId) => [
  "clients",
  resolveClientId(clientId),
  "departments",
];

export const departmentPath = (departmentId, clientId) => [
  ...departmentsPath(clientId),
  departmentId,
];

export const departmentPositionsPath = (departmentId, clientId) => [
  ...departmentPath(departmentId, clientId),
  "positions",
];

export const departmentPositionPath = (departmentId, positionId, clientId) => [
  ...departmentPositionsPath(departmentId, clientId),
  positionId,
];

// Project-scoped departments live under the project document.
export const projectDepartmentsPath = (projectId, clientId) => [
  ...projectPath(projectId, clientId),
  "departments",
];

export const projectDepartmentPath = (projectId, departmentId, clientId) => [
  ...projectDepartmentsPath(projectId, clientId),
  departmentId,
];

export const projectDepartmentPositionsPath = (projectId, departmentId, clientId) => [
  ...projectDepartmentPath(projectId, departmentId, clientId),
  "positions",
];

export const projectDepartmentPositionPath = (projectId, departmentId, positionId, clientId) => [
  ...projectDepartmentPositionsPath(projectId, departmentId, clientId),
  positionId,
];
