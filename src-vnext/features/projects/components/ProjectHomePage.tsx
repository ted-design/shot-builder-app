import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useProject } from "@/features/projects/hooks/useProject"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { formatShootDateRange } from "@/features/projects/lib/shootDates"

// NOTE (Phase 2): these status maps duplicate ProjectCard's — extract to a
// shared `projectStatus.ts` when the hero section lands.
const STATUS_COLORS: Record<string, string> = {
  active: "green",
  completed: "blue",
  archived: "gray",
}

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  completed: "Completed",
  archived: "Archived",
}

/**
 * Ledger project-home at /projects/:id — the orientation view a producer lands
 * on when opening a project. Phase 1 is the route skeleton + hero stub; the
 * status ledger, next-action bar, schedule, crew and product sections are wired
 * in subsequent phases. Read-only: introduces no writes.
 */
export default function ProjectHomePage() {
  const { projectId } = useProjectScope()
  const { data: project } = useProject(projectId)

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        Project overview
      </p>

      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1
          className="text-4xl font-bold leading-none tracking-tight"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {project?.name ?? "…"}
          <span className="text-[var(--color-accent)]">.</span>
        </h1>
        {project && (
          <StatusBadge
            label={STATUS_LABELS[project.status] ?? project.status}
            color={STATUS_COLORS[project.status] ?? "gray"}
          />
        )}
      </div>

      {project && (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {formatShootDateRange(project.shootDates) || "No shoot date set"}
        </p>
      )}

      {/* Status ledger, next-action bar, schedule, crew & products: Phases 3-7. */}
    </div>
  )
}
