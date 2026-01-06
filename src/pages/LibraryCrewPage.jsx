import React, { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useDepartments } from "../hooks/useDepartments";
import { useOrganizationCrew } from "../hooks/useOrganizationCrew";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader } from "../components/ui/card";

export default function LibraryCrewPage() {
  const { clientId } = useAuth();
  const { departments } = useDepartments(clientId);
  const { crew, loading, error, createCrewMember, deleteCrewMember } = useOrganizationCrew(clientId);

  const [filter, setFilter] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    company: "",
    departmentId: "",
    positionId: "",
    notes: "",
  });

  const positionsForSelectedDept = useMemo(() => {
    const dept = departments.find((d) => d.id === form.departmentId);
    return dept?.positions ?? [];
  }, [departments, form.departmentId]);

  const filteredCrew = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return crew;
    return crew.filter((m) => {
      const haystack = `${m.firstName || ""} ${m.lastName || ""} ${m.email || ""} ${m.phone || ""} ${
        m.company || ""
      }`
        .trim()
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [crew, filter]);

  const deptNameById = useMemo(() => {
    const map = new Map(departments.map((d) => [d.id, d.name]));
    return map;
  }, [departments]);

  const positionNameById = useMemo(() => {
    const map = new Map();
    departments.forEach((d) => d.positions.forEach((p) => map.set(p.id, p.title)));
    return map;
  }, [departments]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Crew</h2>
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search crew"
              className="w-72 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3 rounded-card border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              const payload = {
                firstName: form.firstName,
                lastName: form.lastName,
                email: form.email || null,
                phone: form.phone || null,
                company: form.company || null,
                departmentId: form.departmentId || null,
                positionId: form.positionId || null,
                notes: form.notes || null,
                createdBy: null,
              };
              createCrewMember.mutate(payload, {
                onSuccess: () => {
                  setForm({
                    firstName: "",
                    lastName: "",
                    email: "",
                    phone: "",
                    company: "",
                    departmentId: "",
                    positionId: "",
                    notes: "",
                  });
                },
              });
            }}
          >
            <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Add crew member
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                placeholder="First name"
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                placeholder="Last name"
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="Email"
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="Phone"
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <input
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                placeholder="Company (optional)"
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              />
              <select
                value={form.departmentId}
                onChange={(e) =>
                  setForm((p) => ({ ...p, departmentId: e.target.value, positionId: "" }))
                }
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
              >
                <option value="">Department (optional)</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
              <select
                value={form.positionId}
                onChange={(e) => setForm((p) => ({ ...p, positionId: e.target.value }))}
                disabled={!form.departmentId}
                className="rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="">Position (optional)</option>
                {positionsForSelectedDept.map((pos) => (
                  <option key={pos.id} value={pos.id}>
                    {pos.title}
                  </option>
                ))}
              </select>
              <div className="flex justify-end">
                <Button type="submit" disabled={createCrewMember.isPending}>
                  {createCrewMember.isPending ? "Adding..." : "Add"}
                </Button>
              </div>
            </div>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Notes (optional)"
              className="min-h-20 w-full rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            />
          </form>

          <div className="mt-4 overflow-x-auto">
            {loading ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : error ? (
              <div className="text-sm text-red-600">Failed to load crew: {error.message}</div>
            ) : filteredCrew.length === 0 ? (
              <div className="text-sm text-slate-500">No crew yet.</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Department</th>
                    <th className="px-3 py-2 text-left">Position</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Phone</th>
                    <th className="px-3 py-2 text-left"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCrew.map((m) => (
                    <tr key={m.id}>
                      <td className="px-3 py-2">
                        {`${m.firstName || ""} ${m.lastName || ""}`.trim() || "Unnamed"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {m.departmentId ? deptNameById.get(m.departmentId) ?? "—" : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {m.positionId ? positionNameById.get(m.positionId) ?? "—" : "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {m.email || "—"}
                      </td>
                      <td className="px-3 py-2 text-slate-600 dark:text-slate-400">
                        {m.phone || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            if (!confirm("Delete this crew member?")) return;
                            deleteCrewMember.mutate(m.id);
                          }}
                          disabled={deleteCrewMember.isPending}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

