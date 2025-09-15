import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut } from "firebase/auth";
import { auth, provider } from "../firebase";

export const AuthContext = createContext({
  user: null,
  initializing: true,
  signIn: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setInitializing(false);
    });
    return () => unsub();
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
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
    }),
    [user, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
