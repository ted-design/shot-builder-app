import React from "react";
import { Outlet, useLocation, Navigate } from "react-router-dom";
import { useProjectScope } from "../context/ProjectScopeContext";

/**
 * CataloguePage
 *
 * Layout wrapper for the Catalogue section. Renders child routes via Outlet.
 * Redirects to /catalogue/people if accessing /catalogue directly.
 */
export default function CataloguePage() {
  const location = useLocation();
  const { currentProjectId } = useProjectScope();

  // If no project is selected, show a message
  if (!currentProjectId) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-sm text-slate-600 dark:text-slate-400">
        Select a project to view its catalogue.
      </div>
    );
  }

  // If we're at exactly /projects/:projectId/catalogue, redirect to /catalogue/people
  const catalogueBasePath = `/projects/${currentProjectId}/catalogue`;
  if (location.pathname === catalogueBasePath || location.pathname === `${catalogueBasePath}/`) {
    return <Navigate to={`${catalogueBasePath}/people`} replace />;
  }

  return <Outlet />;
}
