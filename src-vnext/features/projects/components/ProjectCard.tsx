import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { StatusBadge } from "@/shared/components/StatusBadge"
import type { Project } from "@/shared/types"

interface ProjectCardProps {
  readonly project: Project
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

function formatShootDates(dates: Project["shootDates"]): string {
  if (!dates || dates.length === 0) return "No dates set"

  const formatted = dates
    .map((ts) => {
      if (!ts?.toDate) return null
      return ts.toDate().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    })
    .filter(Boolean)

  if (formatted.length === 0) return "No dates set"
  if (formatted.length === 1) return formatted[0]!
  return `${formatted[0]} - ${formatted[formatted.length - 1]}`
}

export function ProjectCard({ project }: ProjectCardProps) {
  const navigate = useNavigate()

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/projects/${project.id}/shots`)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-base font-medium leading-tight">
          {project.name}
        </CardTitle>
        <StatusBadge
          label={STATUS_LABELS[project.status] ?? project.status}
          color={STATUS_COLORS[project.status] ?? "gray"}
        />
      </CardHeader>
      <CardContent>
        <p className="text-sm text-[var(--color-text-muted)]">
          {formatShootDates(project.shootDates)}
        </p>
      </CardContent>
    </Card>
  )
}
