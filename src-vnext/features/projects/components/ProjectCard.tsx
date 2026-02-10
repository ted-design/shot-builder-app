import { useMemo, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { StatusBadge } from "@/shared/components/StatusBadge"
import type { Project } from "@/shared/types"
import { formatShootDateRange } from "@/features/projects/lib/shootDates"
import { ProjectActionsMenu } from "@/features/projects/components/ProjectActionsMenu"
import { textPreview } from "@/shared/lib/textPreview"
import { ExternalLink } from "lucide-react"

interface ProjectCardProps {
  readonly project: Project
  readonly showActions?: boolean
  readonly onEdit?: (project: Project) => void
}

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

export function ProjectCard({ project, showActions = false, onEdit }: ProjectCardProps) {
  const navigate = useNavigate()
  const suppressNavigateUntilRef = useRef(0)

  const briefUrl = project.briefUrl?.trim() ?? ""
  const notes = project.notes?.trim() ?? ""
  const briefHost = useMemo(() => {
    if (!briefUrl) return ""
    try {
      return new URL(briefUrl).hostname.replace(/^www\./, "")
    } catch {
      return ""
    }
  }, [briefUrl])

  const markActionInteraction = () => {
    suppressNavigateUntilRef.current = Date.now() + 800
  }

  const navigateToProject = () => {
    if (Date.now() < suppressNavigateUntilRef.current) return
    navigate(`/projects/${project.id}/shots`)
  }

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={navigateToProject}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-base font-medium leading-tight">
            {project.name}
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={STATUS_LABELS[project.status] ?? project.status}
              color={STATUS_COLORS[project.status] ?? "gray"}
            />
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatShootDateRange(project.shootDates)}
            </span>
          </div>
        </div>
        {showActions && onEdit && (
          <ProjectActionsMenu
            project={project}
            onEdit={() => onEdit(project)}
            onActionInteraction={markActionInteraction}
          />
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {briefUrl && (
          <a
            href={briefUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 text-xs text-[var(--color-text-subtle)] underline decoration-[var(--color-border)] underline-offset-2 hover:text-[var(--color-text)]"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">
              Brief{briefHost ? ` \u00b7 ${briefHost}` : ""}
            </span>
          </a>
        )}
        {notes && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {textPreview(notes, 120)}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
