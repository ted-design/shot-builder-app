import { auth } from '../firebase'
import { ROLE_PERMISSIONS } from './constants'

/**
 * Get current user's role from custom claims
 */
export function getUserRole(user = auth.currentUser) {
  if (!user) return null
  
  return user.customClaims?.role || null
}

/**
 * Get current user's organization ID from custom claims
 */
export function getUserOrgId(user = auth.currentUser) {
  if (!user) return null
  
  return user.customClaims?.orgId || null
}

/**
 * Check if user has specific permission for a resource
 */
export function hasPermission(resource, action) {
  const role = getUserRole()
  if (!role) return false
  
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) return false
  
  return permissions[resource]?.includes(action) || false
}

/**
 * Check if user is admin
 */
export function isAdmin() {
  return getUserRole() === 'admin'
}

/**
 * Get user display name or email
 */
export function getUserDisplayName() {
  const user = auth.currentUser
  if (!user) return ''
  
  return user.displayName || user.email || 'Unknown User'
}

/**
 * Wait for auth state to be ready
 */
export function waitForAuth() {
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe()
      resolve(user)
    })
  })
}