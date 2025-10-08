import { useEffect, useRef, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import { useProjectScope } from "../../context/ProjectScopeContext";
import { useFirestoreCollection } from "../../hooks/useFirestoreCollection";
import { ChevronDown, FolderOpen, Layout } from "lucide-react";

export default function ProjectIndicator() {
  const { clientId } = useAuth();
  const { currentProjectId, setCurrentProjectId } = useProjectScope();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const projectsPath = useMemo(
    () => (clientId ? ["clients", clientId, "projects"] : null),
    [clientId]
  );

  const projectsRef = useMemo(
    () => (projectsPath ? collection(db, ...projectsPath) : null),
    [projectsPath]
  );

  const { data: projectsRaw, loading } = useFirestoreCollection(
    projectsRef,
    projectsRef ? [orderBy("createdAt", "desc")] : []
  );

  const projects = useMemo(() => {
    if (!projectsRaw) return [];
    return projectsRaw.filter((project) => {
      if (project?.deletedAt) return false;
      // Show archived projects if the current project is archived
      if (project?.status === "archived") {
        return project.id === currentProjectId;
      }
      return true;
    });
  }, [projectsRaw, currentProjectId]);

  const currentProject = useMemo(
    () => projects.find((p) => p.id === currentProjectId),
    [projects, currentProjectId]
  );

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClick = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    const handleKey = (event) => {
      if (event.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [dropdownOpen]);

  const handleSelectProject = (projectId) => {
    setCurrentProjectId(projectId);
    setDropdownOpen(false);
  };

  const handleGoToDashboard = () => {
    setDropdownOpen(false);
    navigate("/projects");
  };

  if (!clientId || loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <FolderOpen className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <button
        onClick={handleGoToDashboard}
        className="flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100"
      >
        <Layout className="h-4 w-4" />
        <span>Select Project</span>
      </button>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        aria-expanded={dropdownOpen}
        aria-haspopup="menu"
      >
        <FolderOpen className="h-4 w-4 text-primary" />
        <span className="max-w-[200px] truncate font-medium">{currentProject.name}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border border-slate-200 bg-white shadow-lg">
          <div className="border-b border-slate-100 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Switch Project
            </p>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {projects.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-500">
                No projects available
              </div>
            ) : (
              projects.map((project) => {
                const isActive = project.id === currentProjectId;
                return (
                  <button
                    key={project.id}
                    onClick={() => handleSelectProject(project.id)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="truncate">{project.name}</span>
                    {isActive && (
                      <span className="ml-2 flex-none text-xs uppercase tracking-wide">Active</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
          <div className="border-t border-slate-100 p-2">
            <button
              onClick={handleGoToDashboard}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              <Layout className="h-4 w-4" />
              <span>Manage Projects</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
