// src/lib/paths.js
export const CLIENT_ID = "unbound-merino";

// Active project handling: stored in localStorage so you can pick it in Projects page
export const getActiveProjectId = () =>
  localStorage.getItem("ACTIVE_PROJECT_ID") || "default-project";
export const ACTIVE_PROJECT_ID = getActiveProjectId();

// Firestore path helpers
export const projectPath = (projectId) => ["clients", CLIENT_ID, "projects", projectId];
export const shotsPath = (projectId) => [...projectPath(projectId), "shots"];
export const productsPath = ["clients", CLIENT_ID, "products"];
export const talentPath = ["clients", CLIENT_ID, "talent"];
export const locationsPath = ["clients", CLIENT_ID, "locations"];
export const lanesPath = (projectId) => [...projectPath(projectId), "lanes"];
export const pullsPath = (projectId) => [...projectPath(projectId), "pulls"];
