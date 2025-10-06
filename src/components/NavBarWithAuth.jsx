// ⚠️ DEPRECATED - This component is no longer used in the application.
// Navigation has been replaced by SidebarLayout (src/routes/SidebarLayout.jsx).
// This file is kept for reference only and can be safely deleted.

import React from "react";
import NavBar from "./NavBar";
import { useAuth } from "../context/AuthContext";
import { FLAGS } from "../lib/flags";
import { adaptUser } from "../auth/adapter";

/**
 * @deprecated Use SidebarLayout instead (src/routes/SidebarLayout.jsx)
 *
 * Encapsulates NavBar auth sourcing behind FLAGS.newAuthContext.
 * - Flag OFF: render legacy NavBar with user=null.
 * - Flag ON: wait for auth ready, pass adapted user (or null).
 */
export default function NavBarWithAuth() {
  // Always call hooks at the top-level to satisfy the hooks rules.
  const { user, ready, initializing, loadingClaims } = useAuth();
  const flagOn = !!(FLAGS && FLAGS.newAuthContext);

  if (!flagOn) return <NavBar user={null} />;

  const authReady = typeof ready === "boolean" ? ready : !(initializing || loadingClaims);
  if (!authReady) return null;

  const userForNav = user ? adaptUser(user) : null;
  return <NavBar user={userForNav} />;
}
