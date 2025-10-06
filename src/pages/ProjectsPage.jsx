import { useEffect, useState, useMemo } from "react";
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
import { showError } from "../lib/toast";

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

  // Derive a sorted list based on earliest shoot date so that upcoming shoots
  // appear first.  This computation is memoised to avoid re‑sorting on
  // every render when the list hasn't changed.
  const items = useMemo(() => {
    if (!itemsRaw) return [];
    const list = [...itemsRaw].filter((project) => !project?.deletedAt);
    list.sort((a, b) => {
      const A = (a.shootDates && a.shootDates[0]) || "9999-12-31";
      const B = (b.shootDates && b.shootDates[0]) || "9999-12-31";
      return A.localeCompare(B);
    });
    return list;
  }, [itemsRaw]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

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

  return (
    <div className="mx-auto max-w-screen-lg space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-600">
          Pick a project to scope shots, planner lanes, and pull sheets.
        </p>
      </div>
      {/* Show a simple loading state while the projects subscription is
          initialising. A more sophisticated implementation could use a
          skeleton loader component. */}
      {loadingProjects && items.length === 0 && (
        <div className="text-center text-sm text-gray-600">Loading projects…</div>
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
          onClose={() => {
            if (!updating && !deletingProject) setEditingProject(null);
          }}
          onSubmit={(values) => handleUpdate(editingProject, values)}
          onDelete={handleDeleteProject}
        />
      )}
    </div>
  );
}
