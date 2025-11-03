import { useEffect } from "react";
import { Outlet, useParams } from "react-router-dom";
import { useProjectScope } from "../context/ProjectScopeContext";

/**
 * ProjectParamScope
 * Syncs :projectId from the current route into ProjectScopeContext so
 * pages like Shots/Planner can rely on the context for data fetching.
 */
export default function ProjectParamScope() {
  const { projectId } = useParams();
  const { currentProjectId, setCurrentProjectId } = useProjectScope();

  useEffect(() => {
    if (projectId && projectId !== currentProjectId) {
      setCurrentProjectId(projectId);
    }
  }, [projectId, currentProjectId, setCurrentProjectId]);

  return <Outlet />;
}

