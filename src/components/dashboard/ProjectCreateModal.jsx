import React from "react";
import { Modal } from "../ui/modal";
import { Card, CardHeader, CardContent } from "../ui/card";
import ProjectForm from "../ProjectForm";

export default function ProjectCreateModal({ open, busy = false, onClose, onSubmit }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeOnOverlay={!busy}
      labelledBy="create-project-title"
      contentClassName="max-w-xl"
    >
      <Card className="border-0 shadow-none">
        <CardHeader>
          <h2 id="create-project-title" className="text-lg font-semibold dark:text-slate-200">
            Create Project
          </h2>
        </CardHeader>
        <CardContent>
          <ProjectForm
            onSubmit={onSubmit}
            onCancel={onClose}
            submitLabel="Create Project"
            busy={busy}
          />
        </CardContent>
      </Card>
    </Modal>
  );
}
