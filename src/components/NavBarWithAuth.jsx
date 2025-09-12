import React from "react";
import NavBar from "./NavBar";
import { FLAGS } from "../lib/flags";
import { useAuth } from "../context/AuthContext";
import { adaptUser } from "../auth/adapter";

/**
 * Wraps the existing NavBar. When the feature flag is ON, it supplies `user`
 * from AuthContext; when OFF, it renders NavBar exactly as before.
 * No route/guard changes; no writes; read-only migration.
 */
export default function NavBarWithAuth() {
  const flagOn = FLAGS.newAuthContext === true;

  if (!flagOn) {
    // Legacy path unchanged for callers: render NavBar with null user
    return <NavBar user={null} />;
  }

  // Flagged path: use new AuthContext; honor readiness; adapt to NavBar shape
  const { user, ready, initializing } = useAuth();
  const authReady = typeof ready === "boolean" ? ready : !initializing;
  if (!authReady) return null;
  const userForNav = user ? adaptUser(user) : null;
  return <NavBar user={userForNav} />;
}
