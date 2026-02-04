/**
 * Firestore path builders for vNext.
 *
 * Unlike legacy `src/lib/paths.js`, clientId is ALWAYS required (no hardcoded default).
 * All functions return string arrays suitable for Firestore `collection()` / `doc()`.
 */

// --- Projects ---

export const projectsPath = (clientId: string): string[] => [
  "clients",
  clientId,
  "projects",
]

export const projectPath = (projectId: string, clientId: string): string[] => [
  ...projectsPath(clientId),
  projectId,
]

export const projectMembersPath = (
  projectId: string,
  clientId: string,
): string[] => [...projectPath(projectId, clientId), "members"]

// --- Shots (global, not project-scoped) ---

export const shotsPath = (clientId: string): string[] => [
  "clients",
  clientId,
  "shots",
]

export const shotPath = (shotId: string, clientId: string): string[] => [
  ...shotsPath(clientId),
  shotId,
]

// --- Pulls (project-scoped) ---

export const pullsPath = (
  projectId: string,
  clientId: string,
): string[] => [...projectPath(projectId, clientId), "pulls"]

export const pullPath = (
  pullId: string,
  projectId: string,
  clientId: string,
): string[] => [...pullsPath(projectId, clientId), pullId]

// --- Lanes (project-scoped) ---

export const lanesPath = (
  projectId: string,
  clientId: string,
): string[] => [...projectPath(projectId, clientId), "lanes"]

// --- Product Families & SKUs ---

export const productFamiliesPath = (clientId: string): string[] => [
  "clients",
  clientId,
  "productFamilies",
]

export const productFamilySkusPath = (
  familyId: string,
  clientId: string,
): string[] => [...productFamiliesPath(clientId), familyId, "skus"]

export const productFamilySamplesPath = (
  familyId: string,
  clientId: string,
): string[] => [...productFamiliesPath(clientId), familyId, "samples"]

export const productFamilyCommentsPath = (
  familyId: string,
  clientId: string,
): string[] => [...productFamiliesPath(clientId), familyId, "comments"]

export const productFamilyDocumentsPath = (
  familyId: string,
  clientId: string,
): string[] => [...productFamiliesPath(clientId), familyId, "documents"]

// --- Talent ---

export const talentPath = (clientId: string): string[] => [
  "clients",
  clientId,
  "talent",
]

// --- Locations ---

export const locationsPath = (clientId: string): string[] => [
  "clients",
  clientId,
  "locations",
]

// --- Crew ---

export const crewPath = (clientId: string): string[] => [
  "clients",
  clientId,
  "crew",
]

// --- Schedules (project-scoped) ---

export const schedulesPath = (
  projectId: string,
  clientId: string,
): string[] => [...projectPath(projectId, clientId), "schedules"]

export const schedulePath = (
  projectId: string,
  scheduleId: string,
  clientId: string,
): string[] => [...schedulesPath(projectId, clientId), scheduleId]

export const scheduleEntriesPath = (
  projectId: string,
  scheduleId: string,
  clientId: string,
): string[] => [...schedulePath(projectId, scheduleId, clientId), "entries"]

export const scheduleDayDetailsPath = (
  projectId: string,
  scheduleId: string,
  clientId: string,
): string[] => [...schedulePath(projectId, scheduleId, clientId), "dayDetails"]

export const scheduleTalentCallsPath = (
  projectId: string,
  scheduleId: string,
  clientId: string,
): string[] => [...schedulePath(projectId, scheduleId, clientId), "talentCalls"]

export const scheduleCrewCallsPath = (
  projectId: string,
  scheduleId: string,
  clientId: string,
): string[] => [...schedulePath(projectId, scheduleId, clientId), "crewCalls"]

export const scheduleClientCallsPath = (
  projectId: string,
  scheduleId: string,
  clientId: string,
): string[] => [...schedulePath(projectId, scheduleId, clientId), "clientCalls"]

export const callSheetConfigPath = (
  projectId: string,
  scheduleId: string,
  clientId: string,
): string[] => [
  ...schedulePath(projectId, scheduleId, clientId),
  "callSheet",
  "config",
]
