import React, { useMemo } from "react";
import { useMatch } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProjects } from "../../hooks/useFirestoreQuery";
import { CLIENT_ID } from "../../lib/paths";

export default function SidebarProjectHeader({ isExpanded }) {
  const projectMatch = useMatch("/projects/:projectId/*");
  const projectId = projectMatch?.params?.projectId || null;
  const { clientId } = useAuth();
  const resolvedClientId = clientId || CLIENT_ID;

  const { data: projects = [], isLoading } = useProjects(resolvedClientId, {
    enabled: Boolean(projectId),
  });

  const project = useMemo(() => {
    if (!projectId) return null;
    return projects.find((item) => item.id === projectId) || null;
  }, [projectId, projects]);

  const projectName = project?.name || "Untitled Project";

  return (
    <div
      className={`min-h-16 flex items-center border-b border-sidebar-border overflow-hidden ${
        isExpanded ? "px-4 py-3" : "justify-center"
      }`}
      title={projectId ? projectName : undefined}
    >
      {projectId ? (
        <div
          className={`flex items-center min-w-0 ${isExpanded ? "gap-3 flex-1" : ""}`}
        >
          <span className="sidebar-icon shrink-0">
            <FolderOpen className="h-5 w-5 text-neutral-300" />
          </span>
          {isExpanded ? (
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase tracking-wider text-neutral-500">
                Current Project
              </div>
              <div
                className="sidebar-project-title pr-2 text-sm font-semibold leading-snug text-white animate-fade-in"
                title={isLoading ? "Loading..." : projectName}
              >
                {isLoading ? "Loading..." : projectName}
              </div>
            </div>
          ) : (
            <span className="sr-only">{projectName}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
