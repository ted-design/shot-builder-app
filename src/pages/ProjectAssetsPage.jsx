import React from "react";
import { useParams } from "react-router-dom";
import ProjectAssetsManager from "../components/projects/ProjectAssetsManager";
import { PageHeader } from "../components/ui/PageHeader";

export default function ProjectAssetsPage() {
  const { projectId } = useParams();

  if (!projectId) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Select a project to manage its assets.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title="Project Assets"
        description="Choose which global talent and locations are available in this project."
      />
      <ProjectAssetsManager projectId={projectId} />
    </div>
  );
}
