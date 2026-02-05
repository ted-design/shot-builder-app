import { useNavigate, useLocation } from "react-router-dom"
import { signInWithPopup } from "firebase/auth"
import { auth, provider } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import { Button } from "@/ui/button"
import { useEffect, useState } from "react"

interface LocationState {
  readonly from?: { readonly pathname: string }
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  const from = (location.state as LocationState)?.from?.pathname ?? "/projects"

  useEffect(() => {
    if (!loading && user) {
      navigate(from, { replace: true })
    }
  }, [loading, user, navigate, from])

  const handleGoogleSignIn = async () => {
    setSigningIn(true)
    setError(null)
    try {
      await signInWithPopup(auth, provider)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed")
      setSigningIn(false)
    }
  }

  if (loading) return null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--color-bg)] p-6">
      <div className="flex flex-col items-center gap-2">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          Shot Builder
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Sign in to continue
        </p>
      </div>

      <Button onClick={handleGoogleSignIn} disabled={signingIn} size="lg">
        {signingIn ? "Signing in..." : "Sign in with Google"}
      </Button>

      {error && (
        <p className="max-w-sm text-center text-sm text-[var(--color-error)]">
          {error}
        </p>
      )}
    </div>
  )
}
