import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useProjectScope } from "../context/ProjectScopeContext";
import { useDepartments } from "../hooks/useDepartments";
import { useProjectDepartments } from "../hooks/useProjectDepartments";
import { useOrganizationCrew } from "../hooks/useOrganizationCrew";
import { useProjectCrew } from "../hooks/useProjectCrew";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { PageHeader } from "../components/ui/PageHeader";
import AddPersonModal from "../components/crew/AddPersonModal";
import { toast } from "../lib/toast";

export default function ProjectDepartmentsPage() {
  const { clientId } = useAuth();
  const { currentProjectId } = useProjectScope();
  const { departments: orgDepartments } = useDepartments(clientId);
  const {
    departments: projectDepartments,
    loading,
    error,
    createDepartment,
    deleteDepartment,
    createPosition,
    deletePosition,
  } = useProjectDepartments(clientId, currentProjectId);

  // Org-level crew for autocomplete
  const { crew: orgCrew, createCrewMember } = useOrganizationCrew(clientId);

  // Project-level crew assignments
  const {
    assignments: crewAssignments,
    loading: loadingAssignments,
    createAssignment,
    deleteAssignment,
  } = useProjectCrew(clientId, currentProjectId);

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [positionDrafts, setPositionDrafts] = useState({});
  const [showAddPersonModal, setShowAddPersonModal] = useState(false);
  const [addPersonBusy, setAddPersonBusy] = useState(false);

  const hasProjectDepartments = projectDepartments.length > 0;

  const orgTemplates = useMemo(() => {
    return orgDepartments.map((dept) => ({
      name: dept.name,
      positions: dept.positions.map((p) => p.title),
    }));
  }, [orgDepartments]);

  // Set of crew member IDs already assigned to this project
  const existingCrewIds = useMemo(() => {
    return new Set(crewAssignments.map((a) => a.crewMemberId));
  }, [crewAssignments]);

  // Map crew member ID to crew member data
  const crewById = useMemo(() => {
    const map = new Map();
    orgCrew.forEach((c) => map.set(c.id, c));
    return map;
  }, [orgCrew]);

  // Group assignments by position
  const assignmentsByPosition = useMemo(() => {
    const map = new Map();
    crewAssignments.forEach((a) => {
      const key = `${a.departmentId}:${a.positionId}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(a);
    });
    return map;
  }, [crewAssignments]);

  const getCrewForPosition = (departmentId, positionId) => {
    const key = `${departmentId}:${positionId}`;
    const assignments = assignmentsByPosition.get(key) || [];
    return assignments
      .map((a) => {
        const crew = crewById.get(a.crewMemberId);
        return crew ? { ...crew, assignmentId: a.id } : null;
      })
      .filter(Boolean);
  };

  const seedFromOrg = async () => {
    if (!clientId || !currentProjectId) return;
    if (orgTemplates.length === 0) return;
    if (hasProjectDepartments) {
      const ok = confirm(
        "This project already has departments. Copying will add another set (duplicates). Continue?"
      );
      if (!ok) return;
    }

    // Seed by creating new project departments + positions
    // We do this client-side to keep it simple and permission-rule friendly.
    for (const dept of orgTemplates) {
      const created = await createDepartment.mutateAsync({ name: dept.name });
      const deptId = created?.id;
      if (!deptId) continue;
      for (const [index, title] of dept.positions.entries()) {
        await createPosition.mutateAsync({ departmentId: deptId, title, order: index });
      }
    }
  };

  const handleAddPerson = async ({ crewMember, roles, isNew }) => {
    setAddPersonBusy(true);
    try {
      let crewMemberId = crewMember.id;

      // If this is a new crew member, create them in the org database first
      if (isNew) {
        const result = await createCrewMember.mutateAsync({
          firstName: crewMember.firstName,
          lastName: crewMember.lastName,
          email: crewMember.email,
          phone: crewMember.phone,
          notes: crewMember.notes,
          departmentId: null, // Org crew don't have default department
          positionId: null, // Org crew don't have default position
        });
        crewMemberId = result?.id;
        if (!crewMemberId) {
          throw new Error("Failed to create crew member");
        }
      }

      // Create crew assignment(s) for each role
      for (const role of roles) {
        await createAssignment.mutateAsync({
          crewMemberId,
          departmentId: role.departmentId,
          departmentScope: role.departmentScope || "project",
          positionId: role.positionId,
          positionScope: role.positionScope || "project",
        });
      }

      const name = `${crewMember.firstName || ""} ${crewMember.lastName || ""}`.trim() || "Crew member";
      toast.success({
        title: `${name} added to project`,
        description: `Assigned ${roles.length} role${roles.length === 1 ? "" : "s"}`,
      });
    } finally {
      setAddPersonBusy(false);
    }
  };

  const handleCreatePosition = async ({ departmentId, title }) => {
    const result = await createPosition.mutateAsync({ departmentId, title });
    return result;
  };

  const handleRemoveAssignment = async (assignmentId, personName) => {
    if (!confirm(`Remove ${personName} from this position?`)) return;
    try {
      await deleteAssignment.mutateAsync(assignmentId);
      toast.success({ title: "Crew member removed" });
    } catch (err) {
      toast.error({ title: "Failed to remove crew member", description: err.message });
    }
  };

  if (!currentProjectId) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Select a project to manage its departments.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader sticky={false}>
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Departments</PageHeader.Title>
            <PageHeader.Description>
              Manage project departments, positions, and crew assignments.
            </PageHeader.Description>
          </div>
          <PageHeader.Actions>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={seedFromOrg} disabled={createDepartment.isPending}>
                Copy from org defaults
              </Button>
              <Button onClick={() => setShowAddPersonModal(true)}>
                Add person
              </Button>
            </div>
          </PageHeader.Actions>
        </PageHeader.Content>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Add project department</h2>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newDepartmentName.trim();
              if (!name) return;
              createDepartment.mutate({ name }, { onSuccess: () => setNewDepartmentName("") });
            }}
          >
            <input
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder="Department name"
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={createDepartment.isPending}>
              {createDepartment.isPending ? "Adding..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading || loadingAssignments ? (
        <div className="text-sm text-slate-500">Loading...</div>
      ) : error ? (
        <div className="text-sm text-red-600">Failed to load project departments: {error.message}</div>
      ) : projectDepartments.length === 0 ? (
        <div className="rounded-card border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-400">
          No project departments yet. Add your own or copy the org defaults.
        </div>
      ) : (
        <div className="grid gap-4">
          {projectDepartments.map((dept) => (
            <Card key={dept.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-base font-semibold">{dept.name}</div>
                    <div className="text-xs text-slate-500">
                      {dept.positions.length} position{dept.positions.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      if (!confirm(`Delete project department "${dept.name}" and all its positions?`)) return;
                      deleteDepartment.mutate(dept.id);
                    }}
                    disabled={deleteDepartment.isPending}
                  >
                    Delete
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <form
                  className="flex flex-col gap-2 sm:flex-row sm:items-center"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const title = (positionDrafts[dept.id] || "").trim();
                    if (!title) return;
                    createPosition.mutate(
                      { departmentId: dept.id, title },
                      { onSuccess: () => setPositionDrafts((prev) => ({ ...prev, [dept.id]: "" })) }
                    );
                  }}
                >
                  <input
                    value={positionDrafts[dept.id] || ""}
                    onChange={(e) => setPositionDrafts((prev) => ({ ...prev, [dept.id]: e.target.value }))}
                    placeholder="Add position title"
                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                  <Button type="submit" disabled={createPosition.isPending}>
                    Add position
                  </Button>
                </form>

                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {dept.positions.map((pos) => {
                    const assignedCrew = getCrewForPosition(dept.id, pos.id);
                    return (
                      <li key={pos.id} className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{pos.title}</div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (!confirm(`Delete position "${pos.title}"?`)) return;
                              deletePosition.mutate({ departmentId: dept.id, positionId: pos.id });
                            }}
                            disabled={deletePosition.isPending}
                          >
                            Delete
                          </Button>
                        </div>

                        {/* Assigned Crew Members */}
                        {assignedCrew.length > 0 && (
                          <div className="mt-2 ml-4 space-y-1">
                            {assignedCrew.map((crew) => {
                              const name = `${crew.firstName || ""} ${crew.lastName || ""}`.trim() || "Unknown";
                              return (
                                <div
                                  key={crew.assignmentId}
                                  className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 rounded px-2 py-1"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="h-6 w-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-300">
                                      {(crew.firstName?.[0] || "").toUpperCase()}
                                      {(crew.lastName?.[0] || "").toUpperCase()}
                                    </div>
                                    <span>{name}</span>
                                    {crew.email && (
                                      <span className="text-xs text-slate-400 dark:text-slate-500">
                                        {crew.email}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssignment(crew.assignmentId, name)}
                                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                                    disabled={deleteAssignment.isPending}
                                  >
                                    Remove
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </li>
                    );
                  })}
                  {dept.positions.length === 0 ? (
                    <li className="py-3 text-sm text-slate-500">No positions yet.</li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Person Modal */}
      <AddPersonModal
        open={showAddPersonModal}
        busy={addPersonBusy}
        onClose={() => setShowAddPersonModal(false)}
        onAddPerson={handleAddPerson}
        onCreatePosition={handleCreatePosition}
        orgCrew={orgCrew}
        projectDepartments={projectDepartments}
        existingCrewIds={existingCrewIds}
      />
    </div>
  );
}
