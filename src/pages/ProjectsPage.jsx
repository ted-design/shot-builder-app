import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, doc, updateDoc, orderBy, setDoc, serverTimestamp, deleteField } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { CLIENT_ID } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { canManageProjects, ROLE } from "../lib/rbac";
import { useProjectScope } from "../context/ProjectScopeContext";
import ProjectCards from "../components/dashboard/ProjectCards";
import ProjectCreateModal from "../components/dashboard/ProjectCreateModal";
import ProjectEditModal from "../components/dashboard/ProjectEditModal";
import { showError, toast } from "../lib/toast";
import { createProjectSchema, updateProjectSchema } from "../schemas/index.js";
import { SkeletonCard } from "../components/ui/Skeleton";
import { Filter, X } from "lucide-react";

export default function ProjectsPage() {
  const { clientId, user: authUser, role: globalRole } = useAuth();
  const navigate = useNavigate();
  const { currentProjectId, setCurrentProjectId, lastVisitedPath } = useProjectScope();
  const resolvedClientId = clientId || CLIENT_ID;
  const projectsPath = useMemo(
    () => ["clients", resolvedClientId, "projects"],
    [resolvedClientId]
  );
  // Firestore subscription: listen for projects ordered by createdAt desc.
  const projectsRef = useMemo(() => collection(db, ...projectsPath), [projectsPath]);
  const { data: itemsRaw, loading: loadingProjects, error: projectsError } =
    useFirestoreCollection(projectsRef, [orderBy("createdAt", "desc")]);
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
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtersRef = useRef(null);

  // Derive a sorted list based on earliest shoot date so that upcoming shoots
  // appear first.  This computation is memoised to avoid re‑sorting on
  // every render when the list hasn't changed.
  const items = useMemo(() => {
    if (!itemsRaw) return [];
    const list = [...itemsRaw].filter((project) => {
      if (project?.deletedAt) return false;
      if (showArchivedProjects) return true;
      return project?.status !== "archived";
    });
    list.sort((a, b) => {
      const A = (a.shootDates && a.shootDates[0]) || "9999-12-31";
      const B = (b.shootDates && b.shootDates[0]) || "9999-12-31";
      return A.localeCompare(B);
    });
    return list;
  }, [itemsRaw, showArchivedProjects]);

  // Calculate active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (showArchivedProjects) count++;
    return count;
  }, [showArchivedProjects]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setShowArchivedProjects(false);
  }, []);

  // Click-outside handler for filter panel
  useEffect(() => {
    if (!filtersOpen) return undefined;
    function onFiltersClick(event) {
      if (!filtersRef.current) return;
      if (!filtersRef.current.contains(event.target)) {
        setFiltersOpen(false);
      }
    }
    window.addEventListener("mousedown", onFiltersClick);
    return () => window.removeEventListener("mousedown", onFiltersClick);
  }, [filtersOpen]);

  // Show a toast notification if the subscription reports an error.  This effect runs
  // whenever `projectsError` changes.
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
      const projectDoc = await addDoc(collection(db, ...projectsPath), {
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
      await updateDoc(doc(db, ...projectsPath, project.id), {
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
    navigate(lastVisitedPath || "/shots");
  };

  const handleDeleteProject = async (project) => {
    if (!project) return;
    if (!canDelete) {
      toast.error({ title: "Only admins can delete projects." });
      return;
    }
    try {
      setDeletingProject(true);
      await updateDoc(doc(db, ...projectsPath, project.id), {
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
      await updateDoc(doc(db, ...projectsPath, project.id), {
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
      await updateDoc(doc(db, ...projectsPath, project.id), {
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
    <div className="mx-auto max-w-screen-lg space-y-6">
      {/* Sticky header with consistent styling */}
      <div className="sticky inset-x-0 top-14 z-40 -mx-6 border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate">
              Welcome back{authUser?.displayName ? `, ${authUser.displayName}` : ""}
            </h1>
            <p className="text-sm text-slate-600">
              Pick a project to scope shots, planner lanes, and pull sheets.
            </p>
          </div>
          {/* Filter button with badge */}
          <div className="relative flex-none" ref={filtersRef}>
            <button
              type="button"
              onClick={() => setFiltersOpen((prev) => !prev)}
              className={`relative flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition ${
                activeFilterCount > 0
                  ? "border-primary/60 bg-primary/5 text-primary"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              aria-haspopup="menu"
              aria-expanded={filtersOpen}
            >
              <Filter className="h-4 w-4" aria-hidden="true" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Filter panel */}
            {filtersOpen && (
              <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-slate-200 bg-white p-4 shadow-lg">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-900">Filter projects</p>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          clearAllFilters();
                          setFiltersOpen(false);
                        }}
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary/80"
                      >
                        <X className="h-3 w-3" />
                        Clear all
                      </button>
                    )}
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={showArchivedProjects}
                      onChange={(e) => setShowArchivedProjects(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    Show archived
                  </label>
                </div>
              </div>
            )}
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
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
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
