import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { addDoc, collection, doc, updateDoc, setDoc, serverTimestamp, deleteField } from "../lib/demoSafeFirestore";
import { auth, db } from "../lib/firebase";
import { useProjects } from "../hooks/useFirestoreQuery";
import { CLIENT_ID, projectsPath } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { canManageProjects, ROLE } from "../lib/rbac";
import { useProjectScope } from "../context/ProjectScopeContext";
import ProjectCards from "../components/dashboard/ProjectCards";
import ProjectCreateModal from "../components/dashboard/ProjectCreateModal";
import ProjectEditModal from "../components/dashboard/ProjectEditModal";
import { showError, toast } from "../lib/toast";
import { createProjectSchema, updateProjectSchema } from "../schemas/index.js";
import { SkeletonCard } from "../components/ui/Skeleton";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { ChevronDown, ChevronRight, Plus, Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";

export default function ProjectsPage() {
  const { clientId, user: authUser, role: globalRole } = useAuth();
  const navigate = useNavigate();
  const { currentProjectId, setCurrentProjectId } = useProjectScope();
  const resolvedClientId = clientId || CLIENT_ID;

  // TanStack Query hook - cached data with realtime updates
  const { data: itemsRaw = [], isLoading: loadingProjects, error: projectsError } = useProjects(resolvedClientId);

  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageProjects(role);
  const canDelete = role === ROLE.ADMIN;

  // State declarations
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [archivingProject, setArchivingProject] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all"); // all | archived
  const [sortMode, setSortMode] = useState("recent"); // recent | shootDate | name
  const [query, setQuery] = useState("");
  const searchRef = useRef(null);

  // Derive a sorted list based on earliest shoot date so that upcoming shoots
  // appear first.  This computation is memoised to avoid re‑sorting on
  // every render when the list hasn't changed.
  const items = useMemo(() => {
    if (!itemsRaw) return [];
    const q = query.trim().toLowerCase();
    const list = [...itemsRaw].filter((project) => {
      if (project?.deletedAt) return false;

      const status = (project?.status || "active").toLowerCase();
      if (projectFilter === "archived") {
        if (status !== "archived") return false;
      } else {
        if (status === "archived") return false;
      }

      if (!q) return true;
      const haystack = `${project?.name || ""} ${project?.notes || ""}`.toLowerCase();
      return haystack.includes(q);
    });

    if (sortMode === "name") {
      list.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || "")));
    } else if (sortMode === "shootDate") {
      list.sort((a, b) => {
        const A = (a.shootDates && a.shootDates[0]) || "9999-12-31";
        const B = (b.shootDates && b.shootDates[0]) || "9999-12-31";
        return A.localeCompare(B);
      });
    } else {
      list.sort((a, b) => {
        const aDate = a?.updatedAt?.toDate?.() || a?.createdAt?.toDate?.() || a?.updatedAt || a?.createdAt || new Date(0);
        const bDate = b?.updatedAt?.toDate?.() || b?.createdAt?.toDate?.() || b?.updatedAt || b?.createdAt || new Date(0);
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
    }
    return list;
  }, [itemsRaw, projectFilter, query, sortMode]);

  // Show a toast notification if TanStack Query reports an error
  useEffect(() => {
    if (projectsError) {
      showError("Error loading projects: " + projectsError.message);
      console.error(projectsError);
    }
  }, [projectsError]);

  const handleCreate = async (payload) => {
    if (!canManage) {
      showError("You do not have permission to create projects.");
      return;
    }

    // Validate payload
    try {
      createProjectSchema.parse(payload);
    } catch (error) {
      showError(`Invalid project data: ${error.errors.map(e => e.message).join(", ")}`);
      return;
    }

    const currentUser = authUser || auth.currentUser;
    const memberId = currentUser?.uid || null;
    const defaultRole = "producer";
    try {
      setCreating(true);
      const projectDoc = await addDoc(collection(db, ...projectsPath(resolvedClientId)), {
        name: payload.name,
        shootDates: payload.shootDates,
        briefUrl: payload.briefUrl,
        notes: payload.notes,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        members:
          memberId
            ? {
                [memberId]: {
                  role: defaultRole,
                  joinedAt: Date.now(),
                },
              }
            : {},
      });
      if (memberId) {
        try {
          await setDoc(
            doc(db, "clients", resolvedClientId, "users", memberId),
            {
              [`projects.${projectDoc.id}`]: defaultRole,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (profileErr) {
          console.error("Failed to update membership profile", profileErr);
        }
      }
      setShowCreateModal(false);
    } catch (e) {
      showError("Failed to create project: " + e.message);
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (project, payload) => {
    if (!canManage) {
      showError("You do not have permission to edit projects.");
      return;
    }

    // Validate payload
    try {
      updateProjectSchema.parse(payload);
    } catch (error) {
      showError(`Invalid project data: ${error.errors.map(e => e.message).join(", ")}`);
      return;
    }

    try {
      setUpdating(true);
      await updateDoc(doc(db, ...projectsPath(resolvedClientId), project.id), {
        name: payload.name,
        shootDates: payload.shootDates,
        briefUrl: payload.briefUrl,
        notes: payload.notes,
        updatedAt: serverTimestamp(),
      });
      setEditingProject(null);
    } catch (err) {
      showError("Failed to update project: " + err.message);
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };
  const handleSelectProject = (project) => {
    if (!project) return;
    setCurrentProjectId(project.id);
    navigate(`/projects/${project.id}/dashboard`);
  };

  const handleDeleteProject = async (project) => {
    if (!project) return;
    if (!canDelete) {
      toast.error({ title: "Only admins can delete projects." });
      return;
    }
    try {
      setDeletingProject(true);
      await updateDoc(doc(db, ...projectsPath(resolvedClientId), project.id), {
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const currentUser = authUser || auth.currentUser;
      const memberId = currentUser?.uid || null;
      if (memberId) {
        try {
          await setDoc(
            doc(db, "clients", resolvedClientId, "users", memberId),
            {
              [`projects.${project.id}`]: deleteField(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (profileErr) {
          console.error("Failed to update membership after deletion", profileErr);
        }
      }
      if (currentProjectId === project.id) {
        setCurrentProjectId(null);
      }
      toast.success({
        title: "Project deleted",
        description: `${project.name} is no longer visible on the dashboard.`,
      });
      setEditingProject(null);
    } catch (error) {
      console.error("Failed to delete project", error);
      toast.error({ title: "Failed to delete project", description: error?.message });
    } finally {
      setDeletingProject(false);
    }
  };

  const handleArchiveProject = async (project) => {
    if (!project) return;
    if (!canManage) {
      showError("You do not have permission to archive projects.");
      return;
    }
    try {
      setArchivingProject(true);
      const currentUser = authUser || auth.currentUser;
      await updateDoc(doc(db, ...projectsPath(resolvedClientId), project.id), {
        status: "archived",
        archivedAt: serverTimestamp(),
        archivedBy: currentUser?.uid || null,
        updatedAt: serverTimestamp(),
      });
      if (currentProjectId === project.id) {
        setCurrentProjectId(null);
      }
      toast.success({
        title: "Project archived",
        description: `${project.name} has been archived and hidden from the dashboard.`,
      });
      setEditingProject(null);
    } catch (error) {
      console.error("Failed to archive project", error);
      showError("Failed to archive project: " + error.message);
    } finally {
      setArchivingProject(false);
    }
  };

  const handleUnarchiveProject = async (project) => {
    if (!project) return;
    if (!canManage) {
      showError("You do not have permission to unarchive projects.");
      return;
    }
    try {
      setArchivingProject(true);
      await updateDoc(doc(db, ...projectsPath(resolvedClientId), project.id), {
        status: "active",
        archivedAt: deleteField(),
        archivedBy: deleteField(),
        updatedAt: serverTimestamp(),
      });
      toast.success({
        title: "Project restored",
        description: `${project.name} has been restored and is now active.`,
      });
      setEditingProject(null);
    } catch (error) {
      console.error("Failed to unarchive project", error);
      showError("Failed to unarchive project: " + error.message);
    } finally {
      setArchivingProject(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="space-y-4">
        <nav aria-label="Breadcrumb" className="text-sm text-slate-500 dark:text-slate-400">
          <ol className="flex items-center gap-2">
            <li>
              <Link to="/projects" className="hover:text-slate-900 dark:hover:text-slate-200 transition">
                Dashboard
              </Link>
            </li>
            <li aria-hidden="true">
              <ChevronRight className="h-4 w-4" />
            </li>
            <li className="text-slate-700 dark:text-slate-200 font-medium" aria-current="page">
              Projects
            </li>
          </ol>
        </nav>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="heading-page">Projects</h1>
            <p className="body-text-muted mt-1">Manage and track all your projects in one place</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="relative w-full sm:w-[420px]" ref={searchRef}>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects..."
                className="pl-9 bg-slate-100 border-slate-200 dark:bg-slate-800/70 dark:border-slate-700"
                aria-label="Search projects"
              />
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <SlidersHorizontal className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>{projectFilter === "archived" ? "Archived" : "All Projects"}</span>
                  <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setProjectFilter("all")}>All Projects</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setProjectFilter("archived")}>Archived</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ArrowUpDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                  <span>
                    {sortMode === "name" ? "Name" : sortMode === "shootDate" ? "Shoot Date" : "Most Recent"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setSortMode("recent")}>Most Recent</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortMode("shootDate")}>Shoot Date</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortMode("name")}>Name</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {canManage ? (
              <Button variant="dark" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                New Project
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Skeleton loading state */}
      {loadingProjects && items.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array(3).fill(0).map((_, i) => (
            <SkeletonCard key={i} className="h-48" />
          ))}
        </div>
      )}
      {!canManage && (
        <div className="rounded-card border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-600 dark:text-neutral-400">
          You have read-only access to projects. Contact an admin or producer if you need to
          create or edit campaigns.
        </div>
      )}
      <ProjectCards
        loading={loadingProjects}
        projects={items}
        canManage={canManage}
        activeProjectId={currentProjectId}
        onSelectProject={handleSelectProject}
        onEditProject={(project) => setEditingProject(project)}
        onCreateProject={() => setShowCreateModal(true)}
      />
      {canManage && (
        <ProjectCreateModal
          open={showCreateModal}
          busy={creating}
          onClose={() => {
            if (!creating) setShowCreateModal(false);
          }}
          onSubmit={handleCreate}
        />
      )}
      {canManage && (
        <ProjectEditModal
          open={Boolean(editingProject)}
          project={editingProject}
          busy={updating}
          deleting={deletingProject}
          archiving={archivingProject}
          onClose={() => {
            if (!updating && !deletingProject && !archivingProject) setEditingProject(null);
          }}
          onSubmit={(values) => handleUpdate(editingProject, values)}
          onDelete={handleDeleteProject}
          onArchive={handleArchiveProject}
          onUnarchive={handleUnarchiveProject}
        />
      )}
    </div>
  );
}
