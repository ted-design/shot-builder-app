import { useNavigate } from "react-router-dom"
import { Calendar, MoreVertical, Pencil, Trash2 } from "lucide-react"
import { Card, CardHeader, CardTitle } from "@/ui/card"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import type { Schedule } from "@/shared/types"

function formatDate(date: Schedule["date"]): string {
  if (!date) return "No date"
  try {
    return date.toDate().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return "Invalid date"
  }
}

interface ScheduleCardProps {
  readonly schedule: Schedule
  readonly canManage: boolean
  readonly onDelete: (schedule: Schedule) => void
  readonly onEdit: (schedule: Schedule) => void
}

export function ScheduleCard({
  schedule,
  canManage,
  onDelete,
  onEdit,
}: ScheduleCardProps) {
  const { projectId } = useProjectScope()
  const navigate = useNavigate()

  const handleSelect = () => {
    const previewSuffix = canManage ? "" : "&preview=1"
    navigate(`/projects/${projectId}/callsheet?scheduleId=${schedule.id}${previewSuffix}`)
  }

  return (
    <Card
      className="cursor-pointer transition-colors hover:bg-[var(--color-surface-subtle)]"
      onClick={handleSelect}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="truncate text-sm font-medium">
            {schedule.name}
          </CardTitle>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            {formatDate(schedule.date)}
          </p>
        </div>
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(schedule)
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-[var(--color-error)]"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(schedule)
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
    </Card>
  )
}
