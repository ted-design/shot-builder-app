import React from "react";
import ProjectAssetsManager from "../components/projects/ProjectAssetsManager";
import { useProjectScope } from "../context/ProjectScopeContext";

export default function ProjectAssetsPage() {
  const { currentProjectId } = useProjectScope();
  if (!currentProjectId) {
    return (
      <div className="text-sm text-slate-600 dark:text-slate-400">
        Select a project to manage its assets.
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Project Assets</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">Choose which global talent and locations are available in this project.</p>
      </div>
      <ProjectAssetsManager />
    </div>
  );
}

