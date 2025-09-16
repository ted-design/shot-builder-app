import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FLAGS } from "../lib/flags";

/**
 * Gate child routes behind role checks when the new auth context flag is ON.
 * - Flag OFF: always renders children (no role enforcement yet)
 * - Flag ON: waits for auth to finish loading before checking role
 */
export default function RequireRole({ roles, children, fallbackPath = "/projects" }) {
  const { role, initializing, loadingClaims, ready } = useAuth();

  if (!FLAGS.newAuthContext) return <>{children}</>;

  const waiting = initializing || loadingClaims || (typeof ready === "boolean" && !ready);
  if (waiting && !role) return null;

  if (!role || !roles?.includes(role)) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
}

