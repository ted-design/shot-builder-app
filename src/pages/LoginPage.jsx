import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithPopup,
  signInWithRedirect,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import { auth, provider } from "../lib/firebase";
import { isMobileBrowser } from "../lib/isMobileBrowser";
import { useAuth } from "../context/AuthContext";
import { getAuthDebugState } from "../context/AuthContext";

const mapAuthError = (error) => {
  const code = error?.code;
  switch (code) {
    case "auth/invalid-email":
      return "Enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    default:
      return error?.message || "Authentication failed.";
  }
};

export default function LoginPage() {
  const nav = useNavigate();
  const { user, ready, initializing, loadingClaims, checkingRedirect } = useAuth();
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");

  // Navigate away once auth is ready and user is present
  useEffect(() => {
    if (ready && user) {
      nav("/projects", { replace: true });
    }
  }, [ready, user, nav]);

  const toggleMode = () => {
    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
    setError("");
    setInfo("");
    setPassword("");
    setConfirm("");
  };

  const login = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      // Always set persistence before any sign-in attempt
      await setPersistence(auth, browserLocalPersistence);

      // On mobile, skip popup entirely — it's almost always blocked.
      // Go straight to redirect for a reliable sign-in experience.
      if (isMobileBrowser()) {
        if (import.meta.env.DEV) {
          console.log("[LoginPage] Mobile detected, using signInWithRedirect directly");
        }
        await signInWithRedirect(auth, provider);
        return; // Page will navigate away
      }

      await signInWithPopup(auth, provider);
      // useEffect above will redirect after sign-in.
    } catch (e) {
      const code = e && e.code ? String(e.code) : "unknown";
      const shouldRedirect = [
        "auth/popup-blocked",
        "auth/operation-not-supported-in-this-environment",
        "auth/cancelled-popup-request",
        "auth/web-storage-unsupported",
        "auth/network-request-failed",
        "auth/internal-error",
      ].includes(code);
      if (shouldRedirect) {
        try {
          await signInWithRedirect(auth, provider);
          return;
        } catch (e2) {
          setError(`Sign-in failed (redirect): ${e2.message || e2}`);
        }
      } else if (code === "auth/unauthorized-domain") {
        setError(
          "This domain is not authorized for OAuth. Ask an admin to add your domain in Firebase Auth > Authorized domains."
        );
      } else if (code === "auth/operation-not-allowed") {
        setError("Google sign-in is disabled for this project. Enable the provider in Firebase Auth.");
      } else {
        setError(`Sign-in failed: ${e.message || e}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const loginRedirect = async () => {
    setError("");
    setInfo("");
    setBusy(true);
    try {
      // Always set persistence before redirect sign-in
      await setPersistence(auth, browserLocalPersistence);
      await signInWithRedirect(auth, provider);
    } catch (e) {
      setError(`Sign-in (redirect) failed: ${e.message || e}`);
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setInfo("");
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    if (mode === "signup" && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          try {
            await updateProfile(cred.user, { displayName: name.trim() });
          } catch (profileErr) {
            console.warn("Failed to update display name", profileErr);
          }
        }
        try {
          await sendEmailVerification(cred.user);
          setInfo("Verification email sent. You can continue once it's received.");
        } catch (verifyErr) {
          console.warn("Failed to send verification email", verifyErr);
        }
      }
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setError("");
    setInfo("");
    if (!email) {
      setError("Enter your email first, then request a reset link.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo("Password reset email sent. Check your inbox.");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  // --- Task D: While redirect is in flight, show a holding state ---
  if (checkingRedirect) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm text-center">
          <div className="animate-spin mx-auto h-6 w-6 border-2 border-slate-300 border-t-slate-700 dark:border-slate-600 dark:border-t-slate-300 rounded-full" />
          <p className="text-sm text-slate-600 dark:text-slate-400">Finishing sign-in&hellip;</p>
          {import.meta.env.DEV && <AuthDebugPanel ready={ready} initializing={initializing} loadingClaims={loadingClaims} checkingRedirect={checkingRedirect} user={user} />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Welcome back</h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sign in with Google or email to access Shot Builder.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={login}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 dark:bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 dark:hover:bg-indigo-700 disabled:opacity-60"
          >
            Continue with Google
          </button>
          <button
            onClick={loginRedirect}
            disabled={busy}
            className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-60"
          >
            Use redirect sign-in (fallback)
          </button>
        </div>

        <div className="border-t border-slate-200 dark:border-slate-700 pt-6">
          <div className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
            <span>{mode === "signin" ? "Sign in with email" : "Create an email account"}</span>
            <button
              type="button"
              onClick={toggleMode}
              className="text-primary dark:text-indigo-400 transition hover:underline"
            >
              {mode === "signin" ? "Need an account?" : "Have an account?"}
            </button>
          </div>
          <form className="mt-4 space-y-3" onSubmit={handleEmailSubmit}>
            {mode === "signup" && (
              <input
                type="text"
                placeholder="Name (optional)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500"
                autoComplete="name"
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500"
              autoComplete="email"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
            />
            {mode === "signup" && (
              <input
                type="password"
                placeholder="Confirm password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-md border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-500 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-indigo-500"
                autoComplete="new-password"
                required
              />
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-md bg-primary dark:bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-primary/90 dark:hover:bg-indigo-700 disabled:opacity-60"
            >
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          {mode === "signin" && (
            <button
              onClick={handleReset}
              disabled={busy}
              className="mt-3 text-sm text-primary dark:text-indigo-400 transition hover:underline disabled:opacity-60"
              type="button"
            >
              Forgot your password?
            </button>
          )}
        </div>

        {(error || info) && (
          <div
            className={`rounded-md px-3 py-2 text-sm ${
              error ? "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400" : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
            }`}
          >
            {error || info}
          </div>
        )}

        {import.meta.env.DEV && <AuthDebugPanel ready={ready} initializing={initializing} loadingClaims={loadingClaims} checkingRedirect={checkingRedirect} user={user} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DEV-only Auth Debug Panel — renders current auth state for diagnosis
// ---------------------------------------------------------------------------
function AuthDebugPanel({ ready, initializing, loadingClaims, checkingRedirect, user }) {
  const [tick, setTick] = useState(0);

  // Re-render every 2s to pick up module-level debug state changes
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 2000);
    return () => clearInterval(id);
  }, []);

  const { lastAuthEvent, lastRedirectResultStatus } = getAuthDebugState();

  return (
    <div className="mt-4 rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-3 text-left text-xs font-mono text-amber-800 dark:text-amber-300">
      <div className="font-bold mb-1">Auth Debug (DEV only)</div>
      <div>ready: {String(ready)}</div>
      <div>initializing: {String(initializing)}</div>
      <div>checkingRedirect: {String(checkingRedirect)}</div>
      <div>loadingClaims: {String(loadingClaims)}</div>
      <div>user: {user?.uid || "null"}</div>
      <div>lastRedirectResult: {lastRedirectResultStatus}</div>
      <div>lastAuthEvent: {lastAuthEvent}</div>
      <div>isMobile: {String(isMobileBrowser())}</div>
      <div>pathname: {window.location.pathname}</div>
    </div>
  );
}
