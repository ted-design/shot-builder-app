import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  onIdTokenChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  getIdTokenResult,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, provider, db } from "../lib/firebase";
import { CLIENT_ID } from "../lib/paths";

export const AuthContext = createContext({
  user: null,
  initializing: true,
  loadingClaims: false,
  ready: false,
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
  const [role, setRole] = useState(null);
  const [claimsError, setClaimsError] = useState(null);

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (u) => {
      setUser(u || null);
      setClaims(null);
      setRole(null);
      setProjectRoles({});
      setClientId(null);
      setClaimsError(null);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

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
        const tokenResult = await getIdTokenResult(user, true);
        if (cancelled) return;
        const tokenClaims = tokenResult.claims || {};
        const claimRole = tokenClaims.role || null;
        const claimClient = tokenClaims.clientId || CLIENT_ID;
        setClaims(tokenClaims);
        setRole(claimRole);
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
            setProjectRoles(data.projects || {});
            if (!claimRole && data.role) {
              setRole(data.role);
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
      ready: !initializing && !loadingClaims,
      claims,
      role,
      clientId,
      projectRoles,
      claimsError,
      signIn: async () => {
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
