import { useMemo, useState } from "react"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { roleLabel } from "@/shared/lib/rbac"
import { Checkbox } from "@/ui/checkbox"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { Role } from "@/shared/types"

const PROJECT_ROLE_OPTIONS: readonly Role[] = [
  "producer",
  "crew",
  "warehouse",
  "viewer",
]

export interface ProjectAssignment {
  readonly projectId: string
  readonly projectName: string
  readonly role: Role
}

interface ProjectAssignmentPickerProps {
  readonly assignments: readonly ProjectAssignment[]
  readonly onChange: (assignments: readonly ProjectAssignment[]) => void
  readonly existingProjectIds?: ReadonlySet<string>
  readonly defaultRole?: Role
}

export function ProjectAssignmentPicker({
  assignments,
  onChange,
  existingProjectIds,
  defaultRole = "crew",
}: ProjectAssignmentPickerProps) {
  const { data: projects } = useProjects()
  const [filter, setFilter] = useState("")

  const activeProjects = useMemo(() => {
    return projects.filter((p) => !p.deletedAt)
  }, [projects])

  const filteredProjects = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return activeProjects
    return activeProjects.filter((p) =>
      (p.name ?? "").toLowerCase().includes(q),
    )
  }, [activeProjects, filter])

  const assignmentMap = useMemo(() => {
    const map = new Map<string, ProjectAssignment>()
    for (const a of assignments) {
      map.set(a.projectId, a)
    }
    return map
  }, [assignments])

  const handleToggle = (projectId: string, projectName: string) => {
    if (assignmentMap.has(projectId)) {
      onChange(assignments.filter((a) => a.projectId !== projectId))
    } else {
      onChange([...assignments, { projectId, projectName, role: defaultRole }])
    }
  }

  const handleRoleChange = (projectId: string, role: Role) => {
    onChange(
      assignments.map((a) =>
        a.projectId === projectId ? { ...a, role } : a,
      ),
    )
  }

  if (activeProjects.length === 0) {
    return (
      <p className="text-xs text-[var(--color-text-muted)]">
        No projects available.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs text-[var(--color-text-muted)]">
        Assign to Projects ({assignments.length} selected)
      </Label>
      {activeProjects.length > 5 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter projects..."
          className="h-8 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:ring-1 focus:ring-[var(--color-ring)]"
        />
      )}
      <div className="max-h-[200px] overflow-y-auto rounded-md border border-[var(--color-border)]">
        {filteredProjects.map((project) => {
          const isExisting = existingProjectIds?.has(project.id) ?? false
          const isChecked = isExisting || assignmentMap.has(project.id)
          const assignment = assignmentMap.get(project.id)

          return (
            <div
              key={project.id}
              className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2 last:border-b-0"
            >
              <Checkbox
                id={`proj-${project.id}`}
                checked={isChecked}
                disabled={isExisting}
                onCheckedChange={() => handleToggle(project.id, project.name)}
              />
              <label
                htmlFor={`proj-${project.id}`}
                className={`flex-1 cursor-pointer text-sm ${
                  isExisting
                    ? "text-[var(--color-text-muted)]"
                    : "text-[var(--color-text)]"
                }`}
              >
                {project.name}
                {isExisting && (
                  <span className="ml-1 text-2xs text-[var(--color-text-subtle)]">
                    (already assigned)
                  </span>
                )}
              </label>
              {assignment && (
                <Select
                  value={assignment.role}
                  onValueChange={(v) =>
                    handleRoleChange(project.id, v as Role)
                  }
                >
                  <SelectTrigger className="h-7 w-[110px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_ROLE_OPTIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )
        })}
        {filteredProjects.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-[var(--color-text-muted)]">
            No matching projects
          </p>
        )}
      </div>
    </div>
  )
}
