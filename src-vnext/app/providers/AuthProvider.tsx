import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { onIdTokenChanged, type User } from "firebase/auth"
import { auth } from "@/shared/lib/firebase"
import { normalizeRole } from "@/shared/lib/rbac"
import type { AuthClaims, AuthUser, Role } from "@/shared/types"

interface AuthState {
  readonly user: AuthUser | null
  readonly claims: AuthClaims | null
  readonly loading: boolean
  readonly error: string | null
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
  })

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setState({ user: null, claims: null, loading: false, error: null })
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
          setState({
            user: mapUser(firebaseUser),
            claims: null,
            loading: false,
            error: "No clientId in auth claims. Contact your administrator.",
          })
          return
        }

        setState({
          user: mapUser(firebaseUser),
          claims: { role, clientId },
          loading: false,
          error: null,
        })
      } catch (err) {
        setState({
          user: mapUser(firebaseUser),
          claims: null,
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load auth claims",
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
