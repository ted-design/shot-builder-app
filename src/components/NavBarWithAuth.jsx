import React from "react";
import NavBar from "./NavBar";
import { useAuth } from "../context/AuthContext";
import { FLAGS } from "../lib/flags";
import { adaptUser } from "../auth/adapter";

/**
 * Encapsulates NavBar auth sourcing behind FLAGS.newAuthContext.
 * - Flag OFF: render legacy NavBar with user=null.
 * - Flag ON: wait for auth ready, pass adapted user (or null).
 */
export default function NavBarWithAuth() {
  const ctx = (typeof useAuth === "function" ? useAuth() : { user: null, ready: false, initializing: true }) || {};
  const { user, ready, initializing } = ctx;
  const flagOn = !!(FLAGS && FLAGS.newAuthContext);

  if (!flagOn) return <NavBar user={null} />;

  const authReady = typeof ready === "boolean" ? ready : !initializing;
  if (!authReady) return null;

  const userForNav = user ? adaptUser(user) : null;
  return <NavBar user={userForNav} />;
}
