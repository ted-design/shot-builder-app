import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { onIdTokenChanged, type User } from "firebase/auth"
import { auth } from "@/shared/lib/firebase"
import { callFunction } from "@/shared/lib/callFunction"
import { normalizeRole } from "@/shared/lib/rbac"
import type { AuthClaims, AuthUser, Role } from "@/shared/types"

interface AuthState {
  readonly user: AuthUser | null
  readonly claims: AuthClaims | null
  readonly loading: boolean
  readonly error: string | null
  readonly claimingInvitation: boolean
}

interface AuthContextValue extends AuthState {
  readonly role: Role
  readonly clientId: string | null
  readonly signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function mapUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
  }
}

export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    claims: null,
    loading: true,
    error: null,
    claimingInvitation: false,
  })

  const claimAttemptedRef = useRef(false)

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        claimAttemptedRef.current = false
        setState({ user: null, claims: null, loading: false, error: null, claimingInvitation: false })
        return
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult()
        const rawRole = tokenResult.claims["role"]
        const rawClientId = tokenResult.claims["clientId"]

        const role = normalizeRole(rawRole)
        const clientId =
          typeof rawClientId === "string" && rawClientId.length > 0
            ? rawClientId
            : null

        if (!clientId) {
          if (!claimAttemptedRef.current) {
            claimAttemptedRef.current = true
            setState((prev) => ({
              ...prev,
              user: mapUser(firebaseUser),
              loading: false,
              claimingInvitation: true,
            }))

            try {
              const result = await callFunction<{
                ok: boolean
                reason?: string
                role?: string
                clientId?: string
              }>("claimInvitation", {})

              if (result.ok) {
                const claimedRole = typeof result.role === "string" ? result.role : null
                if (claimedRole) {
                  try {
                    sessionStorage.setItem("ph_welcome_role", claimedRole)
                  } catch {
                    // sessionStorage unavailable — skip welcome toast
                  }
                }
                await firebaseUser.getIdToken(true)
                return
              }
            } catch {
              // Claim failed — fall through to pending access
            }
          }

          setState({
            user: mapUser(firebaseUser),
            claims: null,
            loading: false,
            error: "No clientId in auth claims. Contact your administrator.",
            claimingInvitation: false,
          })
          return
        }

        setState({
          user: mapUser(firebaseUser),
          claims: { role, clientId },
          loading: false,
          error: null,
          claimingInvitation: false,
        })
      } catch (err) {
        setState({
          user: mapUser(firebaseUser),
          claims: null,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load auth claims",
          claimingInvitation: false,
        })
      }
    })

    return unsubscribe
  }, [])

  const signOut = async () => {
    await auth.signOut()
  }

  const value: AuthContextValue = {
    ...state,
    role: state.claims?.role ?? "viewer",
    clientId: state.claims?.clientId ?? null,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return ctx
}
