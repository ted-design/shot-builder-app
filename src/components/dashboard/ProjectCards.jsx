import { ProjectCard, CreateProjectCard } from "./ProjectCard";

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CreateProjectCard onClick={onCreateProject} />
      </div>
    );
  }

  return (
    <div
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="project-cards-grid"
    >
      {hasProjects &&
        projects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            isActive={project.id === activeProjectId}
            canManage={canManage}
            onSelect={onSelectProject}
            onEdit={onEditProject}
          />
        ))}
      {canManage && <CreateProjectCard onClick={onCreateProject} />}
    </div>
  );
}
