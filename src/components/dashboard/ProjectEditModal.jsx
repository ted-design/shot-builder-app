import { useEffect, useMemo, useState } from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import ProjectForm from "../ProjectForm";

export default function ProjectEditModal({
  open,
  project,
  busy = false,
  deleting = false,
  onClose,
  onSubmit,
  onDelete,
}) {
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    if (!open) {
      setConfirmation("");
    }
  }, [open, project?.id]);

  const projectName = project?.name || "";
  const requiresConfirmation = Boolean(projectName);
  const confirmationMatches = useMemo(() => {
    if (!requiresConfirmation) return false;
    return confirmation.trim() === projectName;
  }, [confirmation, projectName]);

  const handleDelete = () => {
    if (!confirmationMatches || deleting) return;
    onDelete?.(project);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnOverlay={!busy && !deleting}
      labelledBy="edit-project-title"
      contentClassName="max-w-xl"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="edit-project-title" className="text-lg font-semibold">
            Edit Project
          </h2>
        </CardHeader>
        <CardContent className="space-y-8">
          <ProjectForm
            initialValues={project}
            onSubmit={onSubmit}
            onCancel={onClose}
            submitLabel="Save Changes"
            busy={busy}
          />
          <div className="rounded-lg border border-red-200 bg-red-50/70 p-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
                <p className="mt-1 text-sm text-red-600">
                  Deleting a project hides its shots, pulls, and planner lanes. Type the project name to
                  confirm and mark it for removal.
                </p>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-red-700">
                  {requiresConfirmation ? `Type "${projectName}" to confirm` : "Enter project name to confirm"}
                </label>
                <Input
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  placeholder={projectName}
                  disabled={deleting || !requiresConfirmation}
                />
              </div>
              <Button
                type="button"
                variant="destructive"
                disabled={!confirmationMatches || deleting}
                onClick={handleDelete}
              >
                {deleting ? "Deleting…" : "Delete project"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Modal>
  );
}
