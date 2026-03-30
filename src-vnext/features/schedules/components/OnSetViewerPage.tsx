import { useParams } from "react-router-dom"
import { CalendarDays } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { DetailPageSkeleton } from "@/shared/components/Skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { useAuth } from "@/app/providers/AuthProvider"
import { useSchedule } from "@/features/schedules/hooks/useSchedule"
import { useScheduleDayDetails } from "@/features/schedules/hooks/useScheduleDayDetails"
import { useScheduleEntries } from "@/features/schedules/hooks/useScheduleEntries"
import { useCrew } from "@/features/schedules/hooks/useCrew"
import { OnSetViewer } from "@/features/schedules/components/OnSetViewer"

export default function OnSetViewerPage() {
  const { id: projectId, scheduleId } = useParams<{
    id: string
    scheduleId: string
  }>()

  const { clientId } = useAuth()

  const {
    data: schedule,
    loading: scheduleLoading,
    error: scheduleError,
  } = useSchedule(clientId, projectId ?? "", scheduleId ?? null)

  const {
    data: dayDetails,
    loading: dayDetailsLoading,
  } = useScheduleDayDetails(clientId, projectId ?? "", scheduleId ?? null)

  const {
    data: entries,
    loading: entriesLoading,
  } = useScheduleEntries(clientId, projectId ?? "", scheduleId ?? null)

  const { data: crewLibrary } = useCrew(clientId)

  if (scheduleLoading || dayDetailsLoading || entriesLoading) {
    return <LoadingState loading skeleton={<DetailPageSkeleton />} />
  }

  if (scheduleError) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{scheduleError}</p>
      </div>
    )
  }

  if (!schedule) {
    return (
      <ErrorBoundary>
        <EmptyState
          icon={<CalendarDays className="h-12 w-12" />}
          title="Schedule not found"
          description="This schedule may have been deleted or you may not have access."
        />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <OnSetViewer
        schedule={schedule}
        dayDetails={dayDetails}
        entries={entries}
        crewLibrary={crewLibrary}
      />
    </ErrorBoundary>
  )
}
