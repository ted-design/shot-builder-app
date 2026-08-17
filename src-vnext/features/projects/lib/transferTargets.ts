import type { Project } from "@/shared/types"

/**
 * Whether `project` is a valid destination for a cross-project shot
 * copy/move — everything except the source project itself, archived
 * projects, and soft-deleted projects.
 *
 * Extracted from ShotLifecycleActionsMenu's single-shot Transfer/Copy
 * picker so the bulk actions (BulkActionBar) and "Duplicate project…"'s
 * source-project exclusion reuse the same rule instead of drifting.
 */
export function isEligibleTransferTarget(
  project: Project,
  excludeProjectId: string,
): boolean {
  return (
    project.id !== excludeProjectId &&
    project.status !== "archived" &&
    !project.deletedAt
  )
}

export function filterEligibleTransferTargets(
  projects: ReadonlyArray<Project>,
  excludeProjectId: string,
): ReadonlyArray<Project> {
  return projects.filter((project) => isEligibleTransferTarget(project, excludeProjectId))
}
