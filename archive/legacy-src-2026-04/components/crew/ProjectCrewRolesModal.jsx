import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import RoleSelector from "./RoleSelector";

const emptyRole = {
  assignmentId: null,
  departmentId: "",
  positionId: "",
};

export default function ProjectCrewRolesModal({
  open,
  crewMember,
  assignments = [],
  departments = [],
  busy = false,
  onClose,
  onSaveRoles,
  onEditDetails,
  onRemoveFromProject,
  onCreatePosition,
}) {
  const [roles, setRoles] = useState([{ ...emptyRole }]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const seeded = (assignments || [])
      .filter((assignment) => assignment?.departmentId && assignment?.positionId)
      .map((assignment) => ({
        assignmentId: assignment.id,
        departmentId: assignment.departmentId,
        positionId: assignment.positionId,
      }));
    setRoles(seeded.length ? seeded : [{ ...emptyRole }]);
    setError("");
    setSaving(false);
  }, [assignments, open]);

  const displayName = useMemo(() => {
    const first = (crewMember?.firstName || "").trim();
    const last = (crewMember?.lastName || "").trim();
    return `${first} ${last}`.trim() || "Crew member";
  }, [crewMember?.firstName, crewMember?.lastName]);

  const handleRoleSelect = (index) => ({ departmentId, positionId }) => {
    setRoles((prev) => {
      const next = prev.slice();
      next[index] = {
        ...next[index],
        departmentId,
        positionId,
      };
      return next;
    });
  };

  const addRoleRow = () => setRoles((prev) => [...prev, { ...emptyRole }]);

  const removeRoleRow = (index) => {
    setRoles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validRoles = roles
      .map((role) => ({
        assignmentId: role.assignmentId,
        departmentId: (role.departmentId || "").trim(),
        positionId: (role.positionId || "").trim(),
      }))
      .filter((role) => role.departmentId && role.positionId);

    if (!validRoles.length) {
      setError("Assign at least one role.");
      return;
    }

    setSaving(true);
    try {
      await onSaveRoles?.({
        crewMemberId: crewMember?.id,
        roles: validRoles,
      });
      onClose?.();
    } catch (err) {
      setError(err?.message || "Unable to update roles.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Roles for {displayName}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Roles are project-specific.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="text-xl text-slate-500 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-300"
            >
              ×
            </button>
          </div>
        </CardHeader>
        <CardContent className="pb-6">
          {error && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-3">
              {roles.map((role, index) => (
                <div key={role.assignmentId || `new-${index}`} className="flex items-start gap-2">
                  <div className="flex-1">
                    <RoleSelector
                      departments={departments}
                      selectedDepartmentId={role.departmentId}
                      selectedPositionId={role.positionId}
                      onSelect={handleRoleSelect(index)}
                      onCreatePosition={onCreatePosition}
                      disabled={busy || saving}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => removeRoleRow(index)}
                    disabled={busy || saving || roles.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={addRoleRow} disabled={busy || saving}>
                  Add role
                </Button>
                {onRemoveFromProject && (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => onRemoveFromProject?.(crewMember)}
                    disabled={busy || saving}
                  >
                    Remove from project
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onEditDetails && (
                  <Button type="button" variant="secondary" onClick={onEditDetails} disabled={busy || saving}>
                    Edit details
                  </Button>
                )}
                <Button type="button" variant="secondary" onClick={onClose} disabled={busy || saving}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy || saving}>
                  {saving ? "Saving…" : "Save roles"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </Modal>
  );
}

