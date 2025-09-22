import { useEffect, useState, useMemo } from "react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  orderBy,
  setDoc,
  serverTimestamp,
  deleteField,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { useFirestoreCollection } from "../hooks/useFirestoreCollection";
import { CLIENT_ID } from "../lib/paths";
import { useAuth } from "../context/AuthContext";
import { canManageProjects, ROLE } from "../lib/rbac";

// Import the shared UI primitives.  These provide consistent styling
// out of the box using your Tailwind palette and spacing tokens.
import { Card, CardHeader, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Modal } from "../components/ui/modal";
import ProjectForm from "../components/ProjectForm";

export default function ProjectsPage() {
  const { clientId, user: authUser, role: globalRole } = useAuth();
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
    const list = [...itemsRaw];
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

  // Show an alert if the subscription reports an error.  This effect runs
  // whenever `projectsError` changes.
  useEffect(() => {
    if (projectsError) {
      alert("Error loading projects: " + projectsError.message);
      console.error(projectsError);
    }
  }, [projectsError]);

  const handleCreate = async (payload) => {
    if (!canManage) {
      alert("You do not have permission to create projects.");
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
      alert("Failed to create project: " + e.message);
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (project, payload) => {
    if (!canManage) {
      alert("You do not have permission to edit projects.");
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
      alert("Failed to update project: " + err.message);
      console.error(err);
    } finally {
      setUpdating(false);
    }
  };
  const setActive = (id) => {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem("ACTIVE_PROJECT_ID", id);
      }
      alert(`Active project set to ${id}. Planner/Shots will use this.`);
    } catch (error) {
      console.error("Failed to persist active project", error);
      alert("We couldn't save the active project selection. Try again.");
    }
  };
  const remove = async (p) => {
    if (!canDelete) {
      alert("Only admins can delete projects.");
      return;
    }
    if (!confirm("Delete project?")) return;
    await deleteDoc(doc(db, ...projectsPath, p.id));
    const currentUser = authUser || auth.currentUser;
    const memberId = currentUser?.uid || null;
    if (memberId) {
      try {
        await setDoc(
          doc(db, "clients", resolvedClientId, "users", memberId),
          {
            [`projects.${p.id}`]: deleteField(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } catch (profileErr) {
        console.error("Failed to update membership after deletion", profileErr);
      }
    }
  };

  const formatDate = (value) => {
    if (!value) return null;
    let date = null;
    try {
      if (typeof value === "number") date = new Date(value);
      else if (value instanceof Date) date = value;
      else if (typeof value.toDate === "function") date = value.toDate();
      else if (value.seconds) date = new Date(value.seconds * 1000);
    } catch (err) {
      console.warn("Unable to format date", err);
    }
    if (!date || Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  };

  return (
    <div className="mx-auto max-w-screen-lg space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600">
            Manage campaigns, set active projects, and keep upcoming shoots organised.
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setShowCreateModal(true)} className="self-start">
            New Project
          </Button>
        )}
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
      {/* Project list */}
      <div className="grid gap-4">
        {items.map((p) => {
          const activeId = typeof window !== "undefined" ? localStorage.getItem("ACTIVE_PROJECT_ID") : null;
          const active = activeId === p.id;
          const created = formatDate(p.createdAt);
          const updated = formatDate(p.updatedAt);
          return (
            <Card key={p.id}>
              <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-xs text-gray-600">
                    {Array.isArray(p.shootDates) && p.shootDates.length
                      ? `Shoot dates: ${p.shootDates.join(", ")}`
                      : "No dates"}
                  </div>
                  {p.briefUrl && (
                    <div className="text-xs">
                      <a
                        href={p.briefUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                      >
                        Brief
                      </a>
                    </div>
                  )}
                  {p.notes && (
                    <div className="text-xs text-gray-700">{p.notes}</div>
                  )}
                  {(created || updated) && (
                    <div className="text-[11px] uppercase tracking-wide text-gray-400">
                      {created && `Created ${created}`}
                      {created && updated && " • "}
                      {updated && `Updated ${updated}`}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 self-end sm:self-start">
                  {canManage && (
                    <Button variant="ghost" size="sm" onClick={() => setEditingProject(p)}>
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActive(p.id)}
                  >
                    {active ? "Active ✓" : "Set Active"}
                  </Button>
                  {canDelete && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => remove(p)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {canManage && showCreateModal && (
        <Modal
          open
          onClose={() => {
            if (!creating) setShowCreateModal(false);
          }}
          labelledBy="create-project-title"
          contentClassName="max-w-xl"
          closeOnOverlay={!creating}
        >
          <Card className="border-0 shadow-none">
            <CardHeader>
              <h2 id="create-project-title" className="text-lg font-semibold">
                New Project
              </h2>
            </CardHeader>
            <CardContent>
              <ProjectForm
                onSubmit={handleCreate}
                onCancel={() => {
                  if (!creating) setShowCreateModal(false);
                }}
                submitLabel="Create Project"
                busy={creating}
              />
            </CardContent>
          </Card>
        </Modal>
      )}
      {canManage && editingProject && (
        <Modal
          open
          onClose={() => {
            if (!updating) setEditingProject(null);
          }}
          labelledBy="edit-project-title"
          contentClassName="max-w-xl"
          closeOnOverlay={!updating}
        >
          <Card className="border-0 shadow-none">
            <CardHeader>
              <h2 id="edit-project-title" className="text-lg font-semibold">
                Edit Project
              </h2>
            </CardHeader>
            <CardContent>
              <ProjectForm
                initialValues={editingProject}
                onSubmit={(values) => handleUpdate(editingProject, values)}
                onCancel={() => {
                  if (!updating) setEditingProject(null);
                }}
                submitLabel="Save Changes"
                busy={updating}
              />
            </CardContent>
          </Card>
        </Modal>
      )}
    </div>
  );
}
