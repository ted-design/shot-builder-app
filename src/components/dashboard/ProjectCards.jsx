import { FolderOpen } from "lucide-react";
import { ProjectCard, CreateProjectCard } from "./ProjectCard";
import { EmptyState } from "../ui/EmptyState";
import { getStaggerDelay } from "../../lib/animations";

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

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="project-cards-grid"
    >
      {hasProjects &&
        projects.map((project, index) => (
          <div
            key={project.id}
            className="animate-fade-in opacity-0"
            style={getStaggerDelay(index)}
          >
            <ProjectCard
              project={project}
              isActive={project.id === activeProjectId}
              canManage={canManage}
              onSelect={onSelectProject}
              onEdit={onEditProject}
            />
          </div>
        ))}
      {canManage && <CreateProjectCard onClick={onCreateProject} />}
    </div>
  );
}
