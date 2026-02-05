import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { CalendarDays, ZoomIn, ZoomOut } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { EmptyState } from "@/shared/components/EmptyState"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { canManageSchedules } from "@/shared/lib/rbac"
import { useSchedule } from "@/features/schedules/hooks/useSchedule"
import { useScheduleDayDetails } from "@/features/schedules/hooks/useScheduleDayDetails"
import { useScheduleEntries } from "@/features/schedules/hooks/useScheduleEntries"
import { useScheduleTalentCalls } from "@/features/schedules/hooks/useScheduleTalentCalls"
import { useScheduleCrewCalls } from "@/features/schedules/hooks/useScheduleCrewCalls"
import { useCallSheetConfig } from "@/features/schedules/hooks/useCallSheetConfig"
import { useTalent } from "@/features/shots/hooks/usePickerData"
import { useShots } from "@/features/shots/hooks/useShots"
import { useCrew } from "@/features/schedules/hooks/useCrew"
import { CallSheetRenderer } from "@/features/schedules/components/CallSheetRenderer"
import { DayDetailsEditor } from "@/features/schedules/components/DayDetailsEditor"
import { ScheduleEntryEditor } from "@/features/schedules/components/ScheduleEntryEditor"
import { ScheduleTrackControls } from "@/features/schedules/components/ScheduleTrackControls"
import { CallOverridesEditor } from "@/features/schedules/components/CallOverridesEditor"
import { CallSheetOutputControls } from "@/features/schedules/components/CallSheetOutputControls"
import { CallSheetPrintPortal } from "@/features/schedules/components/CallSheetPrintPortal"
import { TrustChecks } from "@/features/schedules/components/TrustChecks"
import { PageHeader } from "@/shared/components/PageHeader"
import { Button } from "@/ui/button"
import ScheduleListPage from "@/features/schedules/components/ScheduleListPage"

function formatScheduleDate(date: import("@/shared/types").Schedule["date"]): string {
  if (!date) return ""
  try {
    return date.toDate().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

export default function CallSheetBuilderPage() {
  const { clientId, role } = useAuth()
  const { projectId, projectName } = useProjectScope()
  const isMobile = useIsMobile()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const scheduleId = searchParams.get("scheduleId")
  const isPreviewParam = searchParams.get("preview") === "1"
  const canManage = canManageSchedules(role)

  // Enforce preview mode for non-managers (read-only)
  useEffect(() => {
    if (canManage) return
    if (!scheduleId) return
    if (isPreviewParam) return
    const next = new URLSearchParams(searchParams)
    next.set("preview", "1")
    setSearchParams(next, { replace: true })
  }, [canManage, isPreviewParam, scheduleId, searchParams, setSearchParams])

  // Mobile redirect (builder is desktop-only; preview is allowed)
  useEffect(() => {
    if (isMobile && canManage && !isPreviewParam) {
      toast.info("Call sheet builder is available on desktop only.")
      navigate(`/projects/${projectId}/shots`, { replace: true })
    }
  }, [isMobile, canManage, isPreviewParam, navigate, projectId])

  const {
    data: schedule,
    loading: scheduleLoading,
    error: scheduleError,
  } = useSchedule(clientId, projectId, scheduleId)

  const {
    data: dayDetails,
    loading: dayDetailsLoading,
  } = useScheduleDayDetails(clientId, projectId, scheduleId)

  const {
    data: entries,
    loading: entriesLoading,
  } = useScheduleEntries(clientId, projectId, scheduleId)

  const { data: shots, loading: shotsLoading } = useShots()

  const {
    data: talentCalls,
    loading: talentCallsLoading,
  } = useScheduleTalentCalls(clientId, projectId, scheduleId)

  const {
    data: crewCalls,
    loading: crewCallsLoading,
  } = useScheduleCrewCalls(clientId, projectId, scheduleId)

  const { data: talentLibrary, loading: talentLibraryLoading } = useTalent()
  const { data: crewLibrary, loading: crewLibraryLoading } = useCrew(clientId)
  const [previewScale, setPreviewScale] = useState(100)
  const [printOpen, setPrintOpen] = useState(false)

  const callSheetConfig = useCallSheetConfig(clientId, projectId, scheduleId)

  const participatingTalentIds = useMemo(() => {
    if (!entries || entries.length === 0 || shots.length === 0) return [] as string[]
    const shotMap = new Map(shots.map((s) => [s.id, s]))
    const set = new Set<string>()
    for (const e of entries) {
      if (e.type !== "shot") continue
      if (!e.shotId) continue
      const shot = shotMap.get(e.shotId)
      const ids =
        shot?.talentIds && shot.talentIds.length > 0
          ? shot.talentIds
          : (shot?.talent ?? [])
      for (const id of ids) {
        const trimmed = (id ?? "").trim()
        if (trimmed) set.add(trimmed)
      }
    }
    return [...set].sort()
  }, [entries, shots])

  // Mobile: render nothing while redirect fires
  if (isMobile && canManage && !isPreviewParam) return null

  // No schedule selected: show call sheet list for managers (desktop). Others must use a deep link.
  if (!scheduleId) {
    if (!canManage) {
      return (
        <ErrorBoundary>
          <EmptyState
            icon={<CalendarDays className="h-12 w-12" />}
            title="No call sheet selected"
            description="Ask a producer to share a call sheet link, or open a specific schedule."
          />
        </ErrorBoundary>
      )
    }

    return (
      <ErrorBoundary>
        <ScheduleListPage />
      </ErrorBoundary>
    )
  }

  // Loading
  if (scheduleLoading || dayDetailsLoading) {
    return <LoadingState loading />
  }

  // Error or schedule not found
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
          actionLabel="Back to schedules"
          onAction={() => navigate(`/projects/${projectId}/schedules`)}
        />
      </ErrorBoundary>
    )
  }

  const dateStr = formatScheduleDate(schedule.date)
  const rendererConfig = callSheetConfig.config

  const handleExport = () => {
    toast.info("Tip: enable “Background graphics” in the print dialog to include colors.")
    setPrintOpen(true)
  }

  return (
    <ErrorBoundary>
      <CallSheetPrintPortal
        open={printOpen}
        onOpenChange={setPrintOpen}
        data={{
          projectName,
          schedule,
          dayDetails,
          entries,
          shots,
          talentCalls,
          crewCalls,
          talentLibrary,
          crewLibrary,
          config: rendererConfig,
        }}
        readiness={{
          scheduleReady: !scheduleLoading,
          dayDetailsReady: !dayDetailsLoading,
          entriesReady: !entriesLoading,
          shotsReady: !shotsLoading,
          talentCallsReady: !talentCallsLoading,
          crewCallsReady: !crewCallsLoading,
          talentLibraryReady: !talentLibraryLoading,
          crewLibraryReady: !crewLibraryLoading,
          configReady: !callSheetConfig.loading,
        }}
      />
      {isPreviewParam || !canManage ? (
        <div className="flex flex-col gap-3">
          {/* Preview-only header (minimal) */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-[var(--color-text)]">
                {projectName || schedule.name || "Call Sheet"}
              </h1>
              {projectName && schedule.name && projectName !== schedule.name && (
                <p className="truncate text-sm text-[var(--color-text-muted)]">
                  {schedule.name}
                </p>
              )}
              {dateStr && (
                <p className="text-sm text-[var(--color-text-muted)]">{dateStr}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projects/${projectId}/schedules`)}
              >
                Schedules
              </Button>
              {canManage && (
                <Button size="sm" onClick={handleExport}>
                  Export PDF
                </Button>
              )}
            </div>
          </div>

          {/* Full-width preview */}
          <div className="rounded-lg doc-canvas p-5">
            <div className="mx-auto w-full doc-page">
              <div className="doc-page-content">
                <CallSheetRenderer
                  projectName={projectName}
                  schedule={schedule}
                  dayDetails={dayDetails}
                  entries={entries}
                  shots={shots}
                  talentCalls={talentCalls}
                  crewCalls={crewCalls}
                  talentLookup={talentLibrary}
                  crewLookup={crewLibrary}
                  config={rendererConfig}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* E1: Header band */}
          <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] pb-3">
            <div>
              <PageHeader
                title={schedule.name || "Call Sheet"}
                breadcrumbs={[
                  { label: "Projects", to: "/projects" },
                  { label: projectName || "Project", to: `/projects/${projectId}/shots` },
                  { label: "Call Sheet" },
                ]}
              />
              {dateStr && (
                <p className="-mt-3 text-sm text-[var(--color-text-muted)]">{dateStr}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/projects/${projectId}/schedules`)}
              >
                Change Schedule
              </Button>
              <Button size="sm" onClick={handleExport}>
                Export PDF
              </Button>
            </div>
          </div>

          {/* E2: Split-pane layout — fixed left, flex right */}
          <div className="flex gap-6" style={{ minHeight: "calc(100vh - 10rem)" }}>
            {/* Left pane: Editor (fixed width) */}
            <div className="flex w-[420px] shrink-0 flex-col gap-4 overflow-y-auto">
              <DayDetailsEditor
                scheduleId={scheduleId}
                scheduleName={schedule.name}
                dateStr={dateStr}
                dayDetails={dayDetails}
              />

              {/* E4: Day-stream connector wrapper */}
              <div className="schedule-entry-stream">
                <ScheduleTrackControls
                  scheduleId={scheduleId}
                  schedule={schedule}
                  entries={entries}
                />
                <ScheduleEntryEditor
                  scheduleId={scheduleId}
                  schedule={schedule}
                  entries={entries}
                  shots={shots}
                />
              </div>

              <CallSheetOutputControls
                sections={{
                  header: rendererConfig.sections?.header ?? true,
                  dayDetails: rendererConfig.sections?.dayDetails ?? true,
                  schedule: rendererConfig.sections?.schedule ?? true,
                  talent: rendererConfig.sections?.talent ?? true,
                  crew: rendererConfig.sections?.crew ?? true,
                  notes: rendererConfig.sections?.notes ?? true,
                }}
                scheduleBlockFields={{
                  showShotNumber: rendererConfig.scheduleBlockFields?.showShotNumber ?? true,
                  showShotName: rendererConfig.scheduleBlockFields?.showShotName ?? true,
                  showDescription: rendererConfig.scheduleBlockFields?.showDescription ?? true,
                  showTalent: rendererConfig.scheduleBlockFields?.showTalent ?? true,
                  showLocation: rendererConfig.scheduleBlockFields?.showLocation ?? true,
                  showNotes: rendererConfig.scheduleBlockFields?.showNotes ?? true,
                }}
                colors={{
                  primary: rendererConfig.colors?.primary ?? "#111111",
                  accent: rendererConfig.colors?.accent ?? "#2563eb",
                  text: rendererConfig.colors?.text ?? "#111111",
                }}
                onPatchSections={(patch) => {
                  void callSheetConfig.setSectionVisibility(patch)
                }}
                onPatchScheduleFields={(patch) => {
                  void callSheetConfig.setScheduleBlockFields(patch)
                }}
                onPatchColors={(patch) => {
                  void callSheetConfig.setColors(patch)
                }}
              />

              <CallOverridesEditor
                scheduleId={scheduleId}
                dayDetails={dayDetails}
                talentCalls={talentCalls}
                crewCalls={crewCalls}
                talentLibrary={talentLibrary}
                crewLibrary={crewLibrary}
              />

              <TrustChecks
                schedule={schedule}
                participatingTalentIds={participatingTalentIds}
                entries={entries}
                dayDetails={dayDetails}
                talentCalls={talentCalls}
                crewCalls={crewCalls}
                crewLibrary={crewLibrary}
              />
            </div>

            {/* E3: Right pane — preview frame (page-on-desk) */}
            <div className="flex flex-1 min-w-0 flex-col overflow-y-auto rounded-lg doc-canvas p-5">
              {/* Scale control */}
              <div className="mb-3 flex items-center justify-end gap-1">
                <Button
                  variant={previewScale === 85 ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPreviewScale(85)}
                >
                  <ZoomOut className="mr-1 h-3 w-3" />
                  85%
                </Button>
                <Button
                  variant={previewScale === 100 ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPreviewScale(100)}
                >
                  <ZoomIn className="mr-1 h-3 w-3" />
                  100%
                </Button>
              </div>

              {/* Document page */}
              <div
                className="mx-auto w-full doc-page"
                style={{
                  transform: previewScale !== 100 ? `scale(${previewScale / 100})` : undefined,
                  transformOrigin: "top center",
                }}
              >
                <div className="doc-page-content">
                  <CallSheetRenderer
                    projectName={projectName}
                    schedule={schedule}
                    dayDetails={dayDetails}
                    entries={entries}
                    shots={shots}
                    talentCalls={talentCalls}
                    crewCalls={crewCalls}
                    talentLookup={talentLibrary}
                    crewLookup={crewLibrary}
                    config={rendererConfig}
                  />
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </ErrorBoundary>
  )
}
