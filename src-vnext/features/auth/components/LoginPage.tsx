import { useNavigate, useLocation } from "react-router-dom"
import { signInWithPopup } from "firebase/auth"
import { auth, provider } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
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
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        {/* App identity */}
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-3xl font-light tracking-tight text-white">
            Production Hub
          </h1>
          <p className="text-sm text-zinc-400">
            Production planning, simplified.
          </p>
        </div>

        {/* Sign-in card */}
        <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur">
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm text-zinc-400">
              Sign in to continue
            </p>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-50"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              {signingIn ? "Signing in\u2026" : "Sign in with Google"}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <p className="max-w-sm text-center text-sm text-red-400">
            {error}
          </p>
        )}
      </div>

      {/* Built by Immediate */}
      <div className="absolute bottom-6 flex items-center gap-2">
        <span className="text-xs text-zinc-600">built by</span>
        <img
          src="/images/brands/immediate-logo-white.png"
          alt="Immediate"
          className="h-4 opacity-40"
        />
      </div>
    </div>
  )
}
