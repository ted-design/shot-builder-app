import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDepartments } from "../hooks/useDepartments";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";
import { PageHeader } from "../components/ui/PageHeader";

export default function DepartmentsPage() {
  const { clientId } = useAuth();
  const {
    departments,
    loading,
    error,
    createDepartment,
    deleteDepartment,
    createPosition,
    deletePosition,
    seedDefaultDepartments,
  } = useDepartments(clientId);

  const [newDepartmentName, setNewDepartmentName] = useState("");
  const [positionDrafts, setPositionDrafts] = useState({});

  const hasDepartments = departments.length > 0;

  const departmentNameById = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);

  return (
    <div className="space-y-6">
      <PageHeader sticky={false}>
        <PageHeader.Content>
          <div>
            <PageHeader.Title>Default Departments</PageHeader.Title>
            <PageHeader.Description>
              Organization-wide default departments and positions. Projects can copy these as a starting point.
            </PageHeader.Description>
          </div>
          <PageHeader.Actions>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => seedDefaultDepartments.mutate()}
                disabled={seedDefaultDepartments.isPending}
              >
                {seedDefaultDepartments.isPending ? "Seeding..." : "Seed defaults"}
              </Button>
            </div>
          </PageHeader.Actions>
        </PageHeader.Content>
      </PageHeader>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Add department</h2>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            onSubmit={(e) => {
              e.preventDefault();
              const name = newDepartmentName.trim();
              if (!name) return;
              createDepartment.mutate(
                { name },
                {
                  onSuccess: () => setNewDepartmentName(""),
                }
              );
            }}
          >
            <input
              value={newDepartmentName}
              onChange={(e) => setNewDepartmentName(e.target.value)}
              placeholder="Department name"
              className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={createDepartment.isPending}>
              {createDepartment.isPending ? "Adding..." : "Add department"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-sm text-slate-500">Loading…</div>
      ) : error ? (
        <div className="text-sm text-red-600">Failed to load departments: {error.message}</div>
      ) : !hasDepartments ? (
        <div className="rounded-card border border-slate-200 dark:border-slate-700 p-4 text-sm text-slate-600 dark:text-slate-400">
          No departments yet. Click <span className="font-medium">Seed defaults</span> or add your own.
        </div>
      ) : (
        <div className="grid gap-4">
          {departments.map((dept) => (
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
                      if (!confirm(`Delete department "${dept.name}" and all its positions?`)) return;
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
                      {
                        onSuccess: () =>
                          setPositionDrafts((prev) => ({ ...prev, [dept.id]: "" })),
                      }
                    );
                  }}
                >
                  <input
                    value={positionDrafts[dept.id] || ""}
                    onChange={(e) =>
                      setPositionDrafts((prev) => ({ ...prev, [dept.id]: e.target.value }))
                    }
                    placeholder="Add position title"
                    className="flex-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
                  />
                  <Button type="submit" disabled={createPosition.isPending}>
                    Add position
                  </Button>
                </form>

                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
                  {dept.positions.map((pos) => (
                    <li key={pos.id} className="flex items-center justify-between py-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm">{pos.title}</div>
                        <div className="text-[11px] text-slate-500">
                          {departmentNameById.get(pos.departmentId)}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (!confirm(`Delete position "${pos.title}"?`)) return;
                          deletePosition.mutate({ departmentId: dept.id, positionId: pos.id });
                        }}
                        disabled={deletePosition.isPending}
                      >
                        Delete
                      </Button>
                    </li>
                  ))}
                  {dept.positions.length === 0 ? (
                    <li className="py-3 text-sm text-slate-500">No positions yet.</li>
                  ) : null}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
