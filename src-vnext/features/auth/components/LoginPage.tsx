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
    <div className="flex min-h-screen flex-col md:flex-row">

      {/* LEFT: Lifestyle photo panel
          Mobile: fixed 260px height band at top
          Desktop (md+): 45% width, full viewport height
          Large (lg+): 52% width */}
      <div
        className="relative h-[260px] flex-none overflow-hidden md:h-auto md:w-[45%] lg:w-[52%]"
        style={{ minHeight: undefined }}
      >
        {/* Hero image — covers full panel */}
        <img
          src="/images/login-hero.webp"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-center"
        />

        {/* Mobile vignette: fade bottom edge into background */}
        <div
          className="absolute inset-0 md:hidden"
          style={{
            background:
              "linear-gradient(to bottom, transparent 40%, rgba(9,9,11,0.85) 100%)",
          }}
        />

        {/* Desktop vignette: fade right edge into sign-in panel */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{
            background:
              "linear-gradient(to right, transparent 50%, rgba(9,9,11,0.7) 100%)",
          }}
        />

      </div>

      {/* RIGHT: Sign-in panel */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-14 md:py-20 lg:px-20"
        style={{ backgroundColor: "var(--color-bg)" }}
      >
        {/* Unbound Merino brand logo — centered independently
            Uses white PNG (properly cropped) with CSS invert for light mode.
            The black PNG has excessive canvas padding (8860x4725) making it unusable at small sizes. */}
        <div className="mb-10">
          <img
            src="/images/brands/unbound-logo-white.png"
            alt="Unbound Merino"
            className="h-auto w-[300px] invert dark:invert-0"
          />
        </div>

        {/* Sign-in content — constrained max-width */}
        <div className="flex w-full max-w-sm flex-col gap-10">

          {/* App identity */}
          <div className="flex flex-col gap-2.5">
            <span
              className="text-xxs font-semibold uppercase tracking-[0.1em]"
              style={{ color: "var(--color-accent, #E31E24)" }}
            >
              Production Hub
            </span>
            <h1
              className="text-2xl font-light tracking-tighter"
              style={{ color: "var(--color-text)", lineHeight: "1.15" }}
            >
              Sign in to continue.
            </h1>
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)", lineHeight: "1.5" }}
            >
              Production planning for Unbound Merino.
              <br />
              Request access from your admin to get started.
            </p>
          </div>

          {/* Sign-in form */}
          <div className="flex flex-col gap-4">
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              Use your Unbound Merino Google account
            </p>

            {/* Google sign-in — white background per Google brand guidelines */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={signingIn}
              className="flex w-full items-center justify-center gap-3 rounded-button bg-white px-5 py-[13px] text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-50"
            >
              <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 24 24">
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

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div
                className="h-px flex-1"
                style={{ backgroundColor: "var(--color-border)" }}
              />
              <span
                className="text-xxs tracking-[0.04em]"
                style={{ color: "var(--color-text-subtle)" }}
              >
                Access by invite only
              </span>
              <div
                className="h-px flex-1"
                style={{ backgroundColor: "var(--color-border)" }}
              />
            </div>

            {/* Access note */}
            <p
              className="text-xxs leading-relaxed"
              style={{ color: "var(--color-text-muted)" }}
            >
              This app is restricted to Unbound Merino production staff. Contact
              your admin if you need access.
            </p>

            {/* Error message */}
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        </div>

        {/* Built by Immediate — absolute bottom-center of sign-in panel */}
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-[5px] md:bottom-8">
          <span
            className="text-3xs font-medium uppercase tracking-[0.06em]"
            style={{ color: "var(--color-text-subtle)" }}
          >
            built by
          </span>
          <img
            src="/images/brands/immediate-logo-black.png"
            alt="Immediate"
            className="h-5 w-auto dark:hidden"
          />
          <img
            src="/images/brands/immediate-logo-white.png"
            alt="Immediate"
            className="hidden h-5 w-auto dark:block"
          />
        </div>
      </div>
    </div>
  )
}
