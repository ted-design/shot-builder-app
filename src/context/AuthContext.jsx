import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  onIdTokenChanged,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  getIdTokenResult,
  getRedirectResult,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, provider, db } from "../lib/firebase";
import { CLIENT_ID } from "../lib/paths";
import { normalizeRole } from "../lib/rbac";
import { readStorage, removeStorage, writeStorage } from "../lib/safeStorage";
import { isMobileBrowser } from "../lib/isMobileBrowser";

const LAST_ROLE_STORAGE_KEY = "auth:last-known-role";

const readStoredRole = () => normalizeRole(readStorage(LAST_ROLE_STORAGE_KEY)) || null;

// ---------------------------------------------------------------------------
// DEV-only structured auth debug logger
// ---------------------------------------------------------------------------
function authDebug(event, data) {
  if (!import.meta.env.DEV) return;

  const hasOAuthParams = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return !!(params.get("code") || params.get("state"));
    } catch { return false; }
  })();

  const hasFirebaseRedirectKeys = (() => {
    try {
      const keys = Object.keys(sessionStorage);
      return keys.some(k => k.startsWith("firebase:pendingRedirect"));
    } catch { return false; }
  })();

  console.log(`[AuthDebug] ${event}`, {
    ...data,
    pathname: window.location.pathname,
    isMobile: isMobileBrowser(),
    hasOAuthParams,
    hasFirebaseRedirectKeys,
    timestamp: new Date().toISOString(),
  });
}

// Expose last auth event + last redirect result status for the LoginPage debug panel
let _lastAuthEvent = "none";
let _lastRedirectResultStatus = "none";

export function getAuthDebugState() {
  return { lastAuthEvent: _lastAuthEvent, lastRedirectResultStatus: _lastRedirectResultStatus };
}

export const AuthContext = createContext({
  user: null,
  initializing: true,
  loadingClaims: false,
  ready: false,
  checkingRedirect: true,
  claims: null,
  role: null,
  clientId: null,
  projectRoles: {},
  claimsError: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshToken: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [claims, setClaims] = useState(null);
  const [loadingClaims, setLoadingClaims] = useState(false);
  const [clientId, setClientId] = useState(null);
  const [projectRoles, setProjectRoles] = useState({});
  const [role, setRole] = useState(() => readStoredRole());
  const [claimsError, setClaimsError] = useState(null);
  // Track whether we're still checking for a pending redirect result.
  // This prevents the route guard from seeing "no user" and redirecting
  // to /login before a redirect sign-in has been fully processed.
  const [checkingRedirect, setCheckingRedirect] = useState(true);

  // Ref guard: ensure the redirect check runs exactly once, even if React
  // StrictMode double-mounts the component in development.
  const redirectChecked = useRef(false);

  // DEV: log mount
  useEffect(() => {
    authDebug("AUTH_MOUNT", { initializing: true, checkingRedirect: true });
  }, []);

  // Process any pending redirect result on mount (critical for mobile).
  // signInWithRedirect stores the OAuth result; getRedirectResult resolves it.
  // Without this, mobile Safari with ITP may never surface the auth state
  // through onIdTokenChanged alone.
  useEffect(() => {
    if (redirectChecked.current) {
      // Already ran (StrictMode remount) — just clear the flag.
      setCheckingRedirect(false);
      return;
    }
    redirectChecked.current = true;

    let cancelled = false;

    async function handleRedirectResult() {
      authDebug("REDIRECT_CHECK_START", {});
      try {
        // Ensure persistence is set before processing redirect
        await setPersistence(auth, browserLocalPersistence);
        const result = await getRedirectResult(auth);
        const status = result
          ? (result.user ? "user" : "null")
          : "none";
        _lastRedirectResultStatus = status;
        authDebug("REDIRECT_CHECK_DONE", {
          hasResult: !!result,
          hasUser: !!result?.user,
          errorCode: null,
        });
      } catch (err) {
        // auth/credential-already-in-use or network errors are non-fatal here.
        // The onIdTokenChanged listener will still pick up a valid session.
        _lastRedirectResultStatus = `error:${err?.code || "unknown"}`;
        authDebug("REDIRECT_CHECK_DONE", {
          hasResult: false,
          hasUser: false,
          errorCode: err?.code || "unknown",
        });
        if (import.meta.env.DEV) {
          console.warn("[AuthContext] getRedirectResult error (non-fatal):", err?.code || err);
        }
      } finally {
        if (!cancelled) {
          setCheckingRedirect(false);
        }
      }
    }

    handleRedirectResult();
    return () => { cancelled = true; };
  }, []);

  // onIdTokenChanged listener
  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => {
      _lastAuthEvent = "ID_TOKEN_CHANGED";
      authDebug("ID_TOKEN_CHANGED", {
        uid: u?.uid || null,
        email: u?.email || null,
        isAnon: u?.isAnonymous || false,
        providerIds: u?.providerData?.map(p => p.providerId) || [],
      });
      setUser(u || null);
      setClaims(null);
      setClaimsError(null);
      if (!u) {
        setRole(null);
        setProjectRoles({});
        setClientId(null);
        setLoadingClaims(false);
      } else {
        setLoadingClaims(true);
      }
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  // onAuthStateChanged listener (DEV instrumentation — supplements onIdTokenChanged)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      _lastAuthEvent = "AUTH_STATE_CHANGED";
      authDebug("AUTH_STATE_CHANGED", {
        uid: u?.uid || null,
        email: u?.email || null,
        isAnon: u?.isAnonymous || false,
        providerIds: u?.providerData?.map(p => p.providerId) || [],
      });
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (role) {
      writeStorage(LAST_ROLE_STORAGE_KEY, role);
    } else {
      removeStorage(LAST_ROLE_STORAGE_KEY);
    }
  }, [role]);

  // Derive ready and log whenever it changes
  const ready = !initializing && !loadingClaims && !checkingRedirect;

  useEffect(() => {
    authDebug("AUTH_READY", {
      ready,
      initializing,
      checkingRedirect,
      loadingClaims,
      hasUser: !!user,
    });
  }, [ready, initializing, checkingRedirect, loadingClaims, user]);

  useEffect(() => {
    if (!user) {
      setClaims(null);
      setRole(null);
      setClientId(null);
      setProjectRoles({});
      setLoadingClaims(false);
      return;
    }

    let cancelled = false;
    let unsub = null;
    let attemptedSeed = false;

    async function hydrate() {
      setLoadingClaims(true);
      try {
        // Force refresh the user state and token to get latest custom claims
        await user.reload();
        await user.getIdToken(true);

        const tokenResult = await getIdTokenResult(user, false);
        if (cancelled) return;
        const tokenClaims = tokenResult.claims || {};
        const claimRole = normalizeRole(tokenClaims.role);
        const claimClient = tokenClaims.clientId || CLIENT_ID;

        // Debug: Log actual token claims for permission debugging
        console.log("[AuthContext] Token claims:", {
          role: tokenClaims.role,
          clientId: tokenClaims.clientId,
          orgId: tokenClaims.orgId,
          normalizedRole: claimRole,
          resolvedClientId: claimClient,
        });

        // Validate required claims
        if (!tokenClaims.role || !tokenClaims.clientId) {
          setClaimsError(new Error("Missing required custom claims. Please contact administrator."));
          setLoadingClaims(false);
          return;
        }

        setClaims(tokenClaims);
        if (claimRole) {
          setRole(claimRole);
        }
        setClientId(claimClient);

        const userDocRef = doc(db, "clients", claimClient, "users", user.uid);
        unsub = onSnapshot(
          userDocRef,
          async (snap) => {
            if (cancelled) return;
            if (!snap.exists()) {
              if (attemptedSeed) {
                setLoadingClaims(false);
                return;
              }
              attemptedSeed = true;
              try {
                await setDoc(
                  userDocRef,
                  {
                    role: claimRole || "viewer",
                    projects: {},
                    email: user.email || null,
                    displayName: user.displayName || null,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  },
                  { merge: true }
                );
              } catch (seedErr) {
                console.error("Failed to seed user profile", seedErr);
                setClaimsError(seedErr);
                setLoadingClaims(false);
              }
              return;
            }
            const data = snap.data() || {};
            const profileRole = normalizeRole(data.role);
            setProjectRoles(data.projects || {});
            if (!claimRole) {
              setRole(profileRole);
            }
            setLoadingClaims(false);
          },
          (error) => {
            console.error("Failed to load user profile", error);
            setClaimsError(error);
            setLoadingClaims(false);
          }
        );
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load auth claims", err);
          setClaimsError(err);
          setLoadingClaims(false);
        }
      }
    }

    hydrate();

    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
  }, [user]);

  const value = useMemo(
    () => ({
      user,
      initializing,
      loadingClaims,
      checkingRedirect,
      ready,
      claims,
      role,
      clientId,
      projectRoles,
      claimsError,
      signIn: async () => {
        // Always set persistence before any sign-in attempt
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch (e) {
          authDebug("PERSISTENCE_ERROR", { error: e?.code || e?.message || "unknown" });
        }

        // On mobile, go directly to redirect (popup is unreliable).
        if (isMobileBrowser()) {
          authDebug("SIGN_IN_REDIRECT", { reason: "mobile" });
          await signInWithRedirect(auth, provider);
          return;
        }
        try {
          await signInWithPopup(auth, provider);
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
            authDebug("SIGN_IN_REDIRECT", { reason: `popup-fallback:${code}` });
            await signInWithRedirect(auth, provider);
          } else {
            throw e;
          }
        }
      },
      signOut: async () => {
        await fbSignOut(auth);
      },
      refreshToken: async () => {
        if (!auth.currentUser) return;
        try {
          await auth.currentUser.getIdToken(true);
        } catch (err) {
          console.error("Failed to refresh auth token", err);
        }
      },
    }),
    [
      user,
      initializing,
      loadingClaims,
      checkingRedirect,
      ready,
      claims,
      role,
      clientId,
      projectRoles,
      claimsError,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
