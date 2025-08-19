import React, { createContext, useContext } from 'react'
import { useAuth } from '../hooks/useAuth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const { user, loading } = useAuth()
  
  // Demo mode for preview - check if we're in demo mode
  const isDemoMode = window.location.search.includes('demo=true') || true // Force demo mode for testing
  
  const contextValue = {
    user: isDemoMode ? {
      displayName: 'Demo User',
      email: 'demo@shotbuilder.app',
      uid: 'demo-user-id',
      customClaims: { role: 'admin', orgId: 'demo-org' }
    } : user,
    loading: isDemoMode ? false : loading,
    role: isDemoMode ? 'admin' : (user?.customClaims?.role || null),
    orgId: isDemoMode ? 'demo-org' : (user?.customClaims?.orgId || null),
    hasPermission: (resource, action) => {
      if (isDemoMode) return true // Demo mode has all permissions
      
      if (!user?.customClaims?.role) return false
      
      // Simple permission check - in a real app this would be more sophisticated
      const role = user.customClaims.role
      if (role === 'admin') return true
      
      // Basic role-based permissions
      const permissions = {
        producer: ['projects', 'talent', 'locations', 'pullRequests'],
        editor: ['projects', 'talent', 'locations', 'shots'],
        catalog: ['products'],
        warehouse: ['pullRequests'],
        viewer: []
      }
      
      return permissions[role]?.includes(resource) || false
    },
    isAuthenticated: isDemoMode || !!user
  }
  
  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}