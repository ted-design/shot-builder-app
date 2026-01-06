import React, { useMemo } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import { ChevronDown, FolderOpen, MoreVertical } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useProjectScope } from "../../context/ProjectScopeContext";
import { useProjects } from "../../hooks/useFirestoreQuery";
import { CLIENT_ID } from "../../lib/paths";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export default function SidebarProjectHeader({ isExpanded }) {
  const navigate = useNavigate();
  const projectMatch = useMatch("/projects/:projectId/*");
  const projectId = projectMatch?.params?.projectId || null;
  const { clientId } = useAuth();
  const { setCurrentProjectId } = useProjectScope();
  const resolvedClientId = clientId || CLIENT_ID;

  const { data: projects = [], isLoading } = useProjects(resolvedClientId, {
    enabled: Boolean(resolvedClientId),
  });

  const project = useMemo(() => {
    if (!projectId) return null;
    return projects.find((item) => item.id === projectId) || null;
  }, [projectId, projects]);

  const projectName = project?.name || "Untitled Project";

  const menuProjects = useMemo(() => {
    if (!projects.length) return [];
    return [...projects]
      .filter((p) => p && p.id && !p.deletedAt && p.status !== "archived")
      .slice(0, 12);
  }, [projects]);

  const switchProject = (nextProjectId) => {
    if (!nextProjectId) return;
    setCurrentProjectId(nextProjectId);
    navigate(`/projects/${nextProjectId}/dashboard`);
  };

  return (
    <div
      className={`min-h-16 flex items-center border-b border-sidebar-border overflow-hidden ${
        isExpanded ? "px-4 py-3" : "justify-center"
      }`}
      title={projectId ? projectName : undefined}
    >
      {projectId ? (
        <div className={`flex min-w-0 flex-1 items-center ${isExpanded ? "gap-3" : ""}`}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`flex min-w-0 items-center text-left ${
                  isExpanded ? "flex-1 gap-3 rounded-md px-2 py-2 hover:bg-sidebar-hover/30" : "justify-center"
                }`}
                aria-label="Project menu"
              >
                <span className="sidebar-icon shrink-0">
                  <FolderOpen className="h-5 w-5 text-neutral-300" />
                </span>
                {isExpanded ? (
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] uppercase tracking-wider text-neutral-500">Current Project</div>
                    <div
                      className="sidebar-project-title pr-2 text-sm font-semibold leading-snug text-white animate-fade-in flex items-center gap-2"
                      title={isLoading ? "Loading..." : projectName}
                    >
                      <span className="truncate">{isLoading ? "Loading..." : projectName}</span>
                      <ChevronDown className="h-4 w-4 text-neutral-400" aria-hidden="true" />
                    </div>
                  </div>
                ) : (
                  <span className="sr-only">{projectName}</span>
                )}

                {isExpanded ? (
                  <span className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-neutral-400 hover:text-white">
                    <MoreVertical className="h-4 w-4" aria-hidden="true" />
                  </span>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[280px]">
              <DropdownMenuLabel>Project</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => navigate(`/projects/${projectId}/dashboard`)}>
                Project Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => navigate(`/projects/${projectId}/settings`)}>
                Project Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => navigate("/projects")}>All Projects</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Switch Project</DropdownMenuLabel>
              {menuProjects.length ? (
                menuProjects.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() => switchProject(p.id)}
                    className={p.id === projectId ? "opacity-70" : undefined}
                  >
                    {p.name || "Untitled Project"}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled={true}>{isLoading ? "Loading..." : "No projects found"}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
