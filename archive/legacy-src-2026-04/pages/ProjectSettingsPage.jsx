import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "../components/ui/card";
import { PageHeader } from "../components/ui/PageHeader";
import ProjectForm from "../components/ProjectForm";
import { useAuth } from "../context/AuthContext";
import { useProjects } from "../hooks/useFirestoreQuery";
import { useUpdateProject } from "../hooks/useFirestoreMutations";
import { canManageProjects, ROLE } from "../lib/rbac";
import { toast } from "../lib/toast";

export default function ProjectSettingsPage() {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const { clientId, role: globalRole } = useAuth();
  const role = globalRole || ROLE.VIEWER;
  const canManage = canManageProjects(role);

  const { data: projects = [], isLoading: loadingProjects } = useProjects(clientId, {
    enabled: Boolean(clientId),
  });
  const project = useMemo(
    () => projects.find((item) => item.id === projectId) || null,
    [projects, projectId]
  );

  const updateProject = useUpdateProject(clientId);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (payload) => {
    if (!canManage || !clientId || !projectId) return;
    setSaving(true);
    try {
      await updateProject.mutateAsync({ projectId, updates: payload });
      toast.success({ title: "Saved project settings" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader sticky={true} className="top-16 z-30">
        <PageHeader.Content>
          <div className="min-w-0">
            <PageHeader.Title>Settings</PageHeader.Title>
            <PageHeader.Description>{project?.name || (loadingProjects ? "Loading…" : "Project settings")}</PageHeader.Description>
          </div>
        </PageHeader.Content>
      </PageHeader>

      <Card>
        <CardContent className="p-6">
          {canManage ? (
            <ProjectForm
              initialValues={project}
              onSubmit={handleSubmit}
              onCancel={() => navigate(`/projects/${projectId}/dashboard`)}
              submitLabel="Save Settings"
              busy={saving}
            />
          ) : (
            <div className="text-sm text-neutral-600 dark:text-neutral-400">
              You don’t have permission to edit project settings.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
