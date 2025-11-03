import React, { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { FLAGS } from "../lib/flags";
import { useProjectScope } from "../context/ProjectScopeContext";
import { toast } from "../lib/toast";

/**
 * RequireProject
 * - When project scoping is enabled and no active project is selected,
 *   redirects to the Projects dashboard and nudges the user with a toast.
 */
export default function RequireProject({ to = "/projects" }) {
  const { currentProjectId, ready } = useProjectScope();
  const location = useLocation();

  const enforceProjectScope = Boolean(FLAGS?.projectScoping);
  const shouldRedirect = enforceProjectScope && ready && !currentProjectId;

  useEffect(() => {
    if (shouldRedirect) {
      toast.info({ title: "Please select a project" });
    }
  }, [shouldRedirect]);

  if (!enforceProjectScope) {
    return <Outlet />;
  }

  // Avoid flicker while project scope initializes
  if (!ready) {
    return null;
  }

  if (shouldRedirect) {
    return (
      <Navigate
        to={to}
        state={{ from: location, reason: "project-required" }}
        replace
      />
    );
  }

  return <Outlet />;
}
