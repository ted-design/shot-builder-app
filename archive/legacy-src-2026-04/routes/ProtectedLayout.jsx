import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Minimal, centralized auth gate for protected routes.
// Usage:
// <Route element={<ProtectedLayout />}> ...protected routes...</Route>
// Public routes (/, /login, etc.) should live outside this layout.
export default function ProtectedLayout({ allowlist = ["/", "/login"] }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  // Allow explicit public paths to pass through without checks.
  if (allowlist.includes(location.pathname)) {
    return <Outlet />;
  }

  // Avoid flicker while auth state initializes.
  if (initializing) return null;

  // Redirect unauthenticated users to login, preserving intended path.
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

