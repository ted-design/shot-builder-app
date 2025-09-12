import React from "react";
import NavBar from "./NavBar";
import { FLAGS } from "../lib/flags";
import { useAuth } from "../context/AuthContext";

/**
 * Wraps the existing NavBar. When the feature flag is ON, it supplies `user`
 * from AuthContext; when OFF, it renders NavBar exactly as before.
 * No route/guard changes; no writes; read-only migration.
 */
export default function NavBarWithAuth(props) {
  if (!FLAGS.newAuthContext) {
    // Default path: zero behavior change
    return <NavBar {...props} />;
  }
  // Flagged path: read `user` from the new context
  const { user } = useAuth();
  // Ensure our `user` prop wins if parent passed one
  return <NavBar {...props} user={user} />;
}

