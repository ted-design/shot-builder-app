import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FLAGS } from "../lib/flags";

/**
 * RequireAuth
 * - Flag OFF: pass-through (renders children via <Outlet/>).
 * - Flag ON:
 *    - while auth not ready → render nothing (preserves current "loading" behavior)
 *    - signed-out → redirect to `to` (default "/login")
 *    - signed-in → render children via <Outlet/>
 */
export default function RequireAuth({ to = "/login" }) {
  const flagOn = !!(FLAGS && FLAGS.newAuthContext);
  if (!flagOn) return <Outlet />;

  const { user, ready, initializing } = (typeof useAuth === "function" ? useAuth() : { user: null, ready: false, initializing: true });
  const authReady = typeof ready === "boolean" ? ready : !initializing;
  if (!authReady) return null;
  if (!user) return <Navigate to={to} replace />;
  return <Outlet />;
}
