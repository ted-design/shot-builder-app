import React, { useEffect, useMemo, useState } from "react";
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
  archiving = false,
  onClose,
  onSubmit,
  onDelete,
  onArchive,
  onUnarchive,
  onComplete,
  onReopen,
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
          <h2 id="edit-project-title" className="text-lg font-semibold dark:text-slate-200">
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
          {((onComplete || onReopen) && project?.status !== "archived") || onArchive || onUnarchive ? (
            <div className="rounded-card border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/40">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Project lifecycle</h3>
                {(onComplete || onReopen) && project?.status !== "archived" && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {project?.status === "completed"
                        ? "This project is complete. Reopen it to resume work."
                        : "Mark this project as complete when all work is finished."}
                    </p>
                    {project?.status === "completed" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={archiving}
                        onClick={() => onReopen?.(project)}
                      >
                        {archiving ? "Reopening…" : "Reopen"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={archiving}
                        onClick={() => onComplete?.(project)}
                      >
                        {archiving ? "Completing…" : "Complete"}
                      </Button>
                    )}
                  </div>
                )}
                {(onArchive || onUnarchive) && (
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {project?.status === "archived"
                        ? "Restore this project to make it visible on the dashboard."
                        : "Archive to hide from the dashboard. Restore anytime."}
                    </p>
                    {project?.status === "archived" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={archiving}
                        onClick={() => onUnarchive?.(project)}
                      >
                        {archiving ? "Restoring…" : "Unarchive"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={archiving}
                        onClick={() => onArchive?.(project)}
                      >
                        {archiving ? "Archiving…" : "Archive"}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : null}
          <div className="rounded-card border border-red-200 bg-red-50/70 p-4 dark:border-red-900/50 dark:bg-red-950/30">
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">Danger zone</h3>
                <p className="mt-1 text-sm text-red-600 dark:text-red-500">
                  Deleting a project hides its shots, pulls, and planner lanes. Type the project name to
                  confirm and mark it for removal.
                </p>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-400">
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
