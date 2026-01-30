import React from "react";
import { FolderOpen, CheckCircle2, Archive, Inbox } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { EmptyState } from "../ui/EmptyState";
import { getStaggerDelay } from "../../lib/animations";
import { VirtualizedGrid } from "../ui/VirtualizedList";

/**
 * Returns filter-specific empty state props.
 * @param {"active"|"completed"|"archived"|"all"} filter
 * @param {boolean} canManage
 * @param {number} totalProjectCount - Total unfiltered project count (excludes deleted)
 */
function getEmptyStateProps(filter, canManage, totalProjectCount) {
  const hasProjectsElsewhere = totalProjectCount > 0;

  switch (filter) {
    case "active":
      return {
        icon: FolderOpen,
        title: "No active projects",
        description: hasProjectsElsewhere
          ? "All your projects are completed or archived. Create a new project or view all projects to find them."
          : "Create your first project to start organizing your photo shoots and managing your shots.",
        action: canManage ? "New Project" : null,
        secondaryAction: hasProjectsElsewhere ? "View All" : null,
        switchTo: hasProjectsElsewhere ? "all" : null,
      };
    case "completed":
      return {
        icon: CheckCircle2,
        title: "No completed projects",
        description: "Projects you mark as complete will appear here.",
        action: null,
        secondaryAction: "View Active",
        switchTo: "active",
      };
    case "archived":
      return {
        icon: Archive,
        title: "No archived projects",
        description: "Projects you archive will appear here.",
        action: null,
        secondaryAction: "View All",
        switchTo: "all",
      };
    case "all":
    default:
      return {
        icon: Inbox,
        title: "No projects yet",
        description: "Create your first project to start organizing your photo shoots and managing your shots.",
        action: canManage ? "New Project" : null,
        secondaryAction: null,
        switchTo: null,
      };
  }
}

export default function ProjectCards({
  projects = [],
  activeProjectId,
  canManage = false,
  loading = false,
  onSelectProject,
  onEditProject,
  onCreateProject,
  projectFilter = "active",
  onChangeFilter,
  totalProjectCount = 0,
}) {
  const hasProjects = Array.isArray(projects) && projects.length > 0;

  if (!loading && !hasProjects) {
    const emptyProps = getEmptyStateProps(projectFilter, canManage, totalProjectCount);

    return (
      <EmptyState
        icon={emptyProps.icon}
        title={emptyProps.title}
        description={emptyProps.description}
        action={emptyProps.action}
        onAction={emptyProps.action ? onCreateProject : undefined}
        secondaryAction={emptyProps.secondaryAction}
        onSecondaryAction={
          emptyProps.switchTo && onChangeFilter
            ? () => onChangeFilter(emptyProps.switchTo)
            : undefined
        }
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
