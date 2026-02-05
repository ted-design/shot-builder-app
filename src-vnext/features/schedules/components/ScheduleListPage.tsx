import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useSchedules } from "@/features/schedules/hooks/useSchedules"
import { deleteSchedule } from "@/features/schedules/lib/scheduleWrites"
import { ScheduleCard } from "@/features/schedules/components/ScheduleCard"
import { CreateScheduleDialog } from "@/features/schedules/components/CreateScheduleDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canManageSchedules } from "@/shared/lib/rbac"
import { Button } from "@/ui/button"
import { CalendarDays, Plus } from "lucide-react"
import type { Schedule } from "@/shared/types"

export default function ScheduleListPage() {
  const { clientId, role } = useAuth()
  const { projectId } = useProjectScope()
  const { data: schedules, loading, error } = useSchedules(clientId, projectId)
  const navigate = useNavigate()

  const canManage = canManageSchedules(role)

  const [createOpen, setCreateOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null)

  const handleCreated = (scheduleId: string) => {
    navigate(`/projects/${projectId}/callsheet?scheduleId=${scheduleId}`)
  }

  const handleDelete = async () => {
    if (!deleteTarget || !clientId || !canManage) return
    try {
      await deleteSchedule(clientId, projectId, deleteTarget.id)
      toast.success(`"${deleteTarget.name}" deleted`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete schedule",
      )
    }
  }

  if (loading) return <LoadingState loading />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Call Sheet"
        actions={
          canManage ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Call Sheet
            </Button>
          ) : undefined
        }
      />

      {schedules.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-12 w-12" />}
          title="No call sheets yet"
          description="Create a call sheet for a shoot day."
          actionLabel={canManage ? "Create Call Sheet" : undefined}
          onAction={canManage ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {schedules.map((schedule) => (
            <ScheduleCard
              key={schedule.id}
              schedule={schedule}
              canManage={canManage}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {canManage && (
        <CreateScheduleDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={handleCreated}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete Schedule"
        description={`Are you sure you want to delete "${deleteTarget?.name ?? ""}"? This will remove all entries, day details, and call assignments. This action cannot be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
      />
    </ErrorBoundary>
  )
}
