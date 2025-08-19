import { useState, useEffect } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../firebase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Force token refresh to get latest custom claims
          await user.getIdToken(true)
          const idTokenResult = await user.getIdTokenResult()
          
          // If user doesn't have custom claims, initialize them
          if (!idTokenResult.claims.orgId || !idTokenResult.claims.role) {
            const initializeUser = httpsCallable(functions, 'initializeUser')
            await initializeUser()
            
            // Refresh token again to get the new claims
            await user.getIdToken(true)
            const updatedTokenResult = await user.getIdTokenResult()
            
            setUser({
              ...user,
              customClaims: updatedTokenResult.claims
            })
          } else {
            setUser({
              ...user,
              customClaims: idTokenResult.claims
            })
          }
        } catch (error) {
          console.error('Error initializing user:', error)
          // Still set user even if initialization fails
          setUser(user)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    
    return () => unsubscribe()
  }, [])
  
  return { user, loading }
}