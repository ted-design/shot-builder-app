import React from "react";
import { FolderOpen } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { EmptyState } from "../ui/EmptyState";
import { getStaggerDelay } from "../../lib/animations";
import { VirtualizedGrid } from "../ui/VirtualizedList";

export default function ProjectCards({
  projects = [],
  activeProjectId,
  canManage = false,
  loading = false,
  onSelectProject,
  onEditProject,
  onCreateProject,
}) {
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  if (!loading && !hasProjects) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="No projects yet"
        description="Create your first project to start organizing your photo shoots and managing your shots."
        action={canManage ? "Create Project" : null}
        onAction={canManage ? onCreateProject : null}
      />
    );
  }

  // Render function for each project card
  const renderProjectCard = (project, index, isVirtualized) => {
    const cardContent = (
      <ProjectCard
        project={project}
        isActive={project.id === activeProjectId}
        canManage={canManage}
        onSelect={onSelectProject}
        onEdit={onEditProject}
      />
    );

    // Only apply stagger animation when not virtualized
    if (!isVirtualized) {
      return (
        <div className="animate-fade-in opacity-0" style={getStaggerDelay(index)}>
          {cardContent}
        </div>
      );
    }

    return cardContent;
  };

  return (
    <div data-testid="project-cards-grid">
      <VirtualizedGrid
        items={projects}
        renderItem={renderProjectCard}
        itemHeight={240}
        gap={16}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        threshold={100}
      />
    </div>
  );
}
