// Updated paths for org-based structure

/**
 * Get the current user's organization ID from auth claims
 * Falls back to a default for development
 */
export function getCurrentOrgId() {
  // In production, this should come from Firebase custom claims
  // For now, we'll use a default during development
  return 'unbound-merino'
}

/**
 * Get the currently active project ID from localStorage
 */
export function getActiveProjectId() {
  return localStorage.getItem('ACTIVE_PROJECT_ID') || 'default-project'
}

// Organization paths (new structure)
export const orgPath = (orgId = getCurrentOrgId()) => ['orgs', orgId]

// Organization members
export const membersPath = (orgId = getCurrentOrgId()) => [...orgPath(orgId), 'members']

// Projects within organization  
export const projectsPath = (orgId = getCurrentOrgId()) => [...orgPath(orgId), 'projects']

export const projectPath = (projectId, orgId = getCurrentOrgId()) => [
  ...projectsPath(orgId), 
  projectId
]

// Project-specific collections
export const projectShotsPath = (projectId, orgId = getCurrentOrgId()) => [
  ...projectPath(projectId, orgId), 
  'shots'
]

export const projectDaysPath = (projectId, orgId = getCurrentOrgId()) => [
  ...projectPath(projectId, orgId), 
  'days'
]

export const pullRequestsPath = (projectId, orgId = getCurrentOrgId()) => [
  ...projectPath(projectId, orgId), 
  'pullRequests'
]

// Global collections within organization
export const productsPath = (orgId = getCurrentOrgId()) => [...orgPath(orgId), 'products']

export const productFamiliesPath = (orgId = getCurrentOrgId()) => [
  ...orgPath(orgId), 
  'productFamilies'
]

export const talentPath = (orgId = getCurrentOrgId()) => [...orgPath(orgId), 'talent']

export const locationsPath = (orgId = getCurrentOrgId()) => [...orgPath(orgId), 'locations']

// Event logs for auditing
export const eventLogsPath = (orgId = getCurrentOrgId()) => [...orgPath(orgId), 'eventLogs']