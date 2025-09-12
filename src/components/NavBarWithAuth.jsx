import React, { useEffect, useState } from "react";
import NavBar from "./NavBar";
import { FLAGS } from "../lib/flags";
import { useAuth } from "../context/AuthContext";
import { adaptUser } from "../auth/adapter";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

/**
 * Wraps the existing NavBar. When the feature flag is ON, it supplies `user`
 * from AuthContext; when OFF, it renders NavBar exactly as before.
 * No route/guard changes; no writes; read-only migration.
 */
export default function NavBarWithAuth() {
  const flagOn = FLAGS.newAuthContext === true;

  // Legacy path: mirror previous App.jsx behavior (render only when signed-in)
  const [legacyUser, setLegacyUser] = useState(null);
  useEffect(() => {
    if (flagOn) return; // no legacy wire-up when flag is ON
    const unsub = onAuthStateChanged(auth, setLegacyUser);
    return () => {
      if (unsub) unsub();
    };
  }, [flagOn]);

  if (!flagOn) {
    // Render only when we have a legacy Firebase user, matching previous gating
    if (!legacyUser) return null;
    return <NavBar user={legacyUser} />;
  }

  // Flagged path: use new AuthContext; honor readiness; adapt to NavBar shape
  const { user, ready, initializing } = useAuth();
  const authReady = (typeof ready === "boolean") ? ready : !initializing;
  if (!authReady || !user) return null;
  const userForNav = adaptUser(user);
  return <NavBar user={userForNav} />;
}
