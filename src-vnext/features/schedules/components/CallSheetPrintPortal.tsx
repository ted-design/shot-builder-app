import { createPortal } from "react-dom"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { CallSheetRenderer } from "@/features/schedules/components/CallSheetRenderer"
import type {
  CallSheetConfig,
} from "@/features/schedules/components/CallSheetRenderer"
import type {
  Schedule,
  DayDetails,
  ScheduleEntry,
  TalentCallSheet,
  CrewCallSheet,
  Shot,
  TalentRecord,
  CrewRecord,
} from "@/shared/types"

type ReadinessKey =
  | "schedule"
  | "dayDetails"
  | "entries"
  | "talentCalls"
  | "crewCalls"
  | "shots"
  | "talentLibrary"
  | "crewLibrary"
  | "config"

interface PrintReadinessState {
  readonly registered: ReadonlySet<ReadinessKey>
  readonly ready: ReadonlySet<ReadinessKey>
}

function PrintReady({
  id,
  ready,
  onRegister,
  onReady,
}: {
  readonly id: ReadinessKey
  readonly ready: boolean
  readonly onRegister: (id: ReadinessKey) => () => void
  readonly onReady: (id: ReadinessKey) => void
}) {
  useEffect(() => onRegister(id), [id, onRegister])
  useEffect(() => {
    if (ready) onReady(id)
  }, [id, ready, onReady])
  return null
}

function PrintApp({
  data,
  readiness,
  onAllReady,
}: {
  readonly data: CallSheetPrintData
  readonly readiness: Record<ReadinessKey, boolean>
  readonly onAllReady: () => void
}) {
  const [state, setState] = useState<PrintReadinessState>({
    registered: new Set(),
    ready: new Set(),
  })

  const allReady = useMemo(() => {
    if (state.registered.size === 0) return false
    for (const id of state.registered) {
      if (!state.ready.has(id)) return false
    }
    return true
  }, [state])

  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    if (!allReady) return
    fired.current = true
    onAllReady()
  }, [allReady, onAllReady])

  const onRegister = useCallback((id: ReadinessKey) => {
    setState((prev) => {
      if (prev.registered.has(id)) return prev
      const registered = new Set(prev.registered)
      registered.add(id)
      return { ...prev, registered }
    })
    return () => {
      setState((prev) => {
        const registered = new Set(prev.registered)
        const readySet = new Set(prev.ready)
        registered.delete(id)
        readySet.delete(id)
        return { registered, ready: readySet }
      })
    }
  }, [])

  const onReady = useCallback((id: ReadinessKey) => {
    setState((prev) => {
      if (prev.ready.has(id)) return prev
      const readySet = new Set(prev.ready)
      readySet.add(id)
      return { ...prev, ready: readySet }
    })
  }, [])

  return (
    <div data-callsheet-print-root className="min-h-screen bg-white">
      {/* Readiness registry: each section registers and reports ready once its subscription has emitted. */}
      <PrintReady id="schedule" ready={readiness.schedule} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="dayDetails" ready={readiness.dayDetails} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="entries" ready={readiness.entries} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="talentCalls" ready={readiness.talentCalls} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="crewCalls" ready={readiness.crewCalls} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="shots" ready={readiness.shots} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="talentLibrary" ready={readiness.talentLibrary} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="crewLibrary" ready={readiness.crewLibrary} onRegister={onRegister} onReady={onReady} />
      <PrintReady id="config" ready={readiness.config} onRegister={onRegister} onReady={onReady} />

      <div className="doc-page">
        <div className="doc-page-content">
          <CallSheetRenderer
            projectName={data.projectName}
            schedule={data.schedule}
            dayDetails={data.dayDetails}
            entries={data.entries}
            shots={data.shots}
            talentCalls={data.talentCalls}
            crewCalls={data.crewCalls}
            talentLookup={data.talentLibrary}
            crewLookup={data.crewLibrary}
            config={data.config}
          />
        </div>
      </div>
    </div>
  )
}

export interface CallSheetPrintData {
  readonly projectName?: string
  readonly schedule: Schedule | null
  readonly dayDetails: DayDetails | null
  readonly entries: readonly ScheduleEntry[]
  readonly shots: readonly Shot[]
  readonly talentCalls: readonly TalentCallSheet[]
  readonly crewCalls: readonly CrewCallSheet[]
  readonly talentLibrary: readonly TalentRecord[]
  readonly crewLibrary: readonly CrewRecord[]
  readonly config: CallSheetConfig
}

export interface CallSheetPrintReadiness {
  readonly scheduleReady: boolean
  readonly dayDetailsReady: boolean
  readonly entriesReady: boolean
  readonly shotsReady: boolean
  readonly talentCallsReady: boolean
  readonly crewCallsReady: boolean
  readonly talentLibraryReady: boolean
  readonly crewLibraryReady: boolean
  readonly configReady: boolean
}

export function CallSheetPrintPortal({
  open,
  onOpenChange,
  data,
  readiness,
  timeoutMs = 10_000,
}: {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly data: CallSheetPrintData
  readonly readiness: CallSheetPrintReadiness
  readonly timeoutMs?: number
}) {
  const [container] = useState(() => {
    const el = document.createElement("div")
    el.setAttribute("data-callsheet-print-portal", "1")
    el.style.position = "fixed"
    el.style.inset = "0"
    el.style.background = "white"
    el.style.zIndex = "9999"
    return el
  })

  const fired = useRef(false)

  const readyMap: Record<ReadinessKey, boolean> = useMemo(() => {
    return {
      schedule: readiness.scheduleReady,
      dayDetails: readiness.dayDetailsReady,
      entries: readiness.entriesReady,
      talentCalls: readiness.talentCallsReady,
      crewCalls: readiness.crewCallsReady,
      shots: readiness.shotsReady,
      talentLibrary: readiness.talentLibraryReady,
      crewLibrary: readiness.crewLibraryReady,
      config: readiness.configReady,
    }
  }, [readiness])

  useEffect(() => {
    if (!open) return
    if (!data.schedule) {
      toast.error("Export failed: schedule not loaded.")
      onOpenChange(false)
      return
    }

    document.body.appendChild(container)
    document.body.setAttribute("data-callsheet-printing", "1")

    const handleAfterPrint = () => onOpenChange(false)
    window.addEventListener("afterprint", handleAfterPrint)

    const timeout = window.setTimeout(() => {
      toast.error("Export failed: some data did not load in time.")
      onOpenChange(false)
    }, timeoutMs)

    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener("afterprint", handleAfterPrint)
      document.body.removeAttribute("data-callsheet-printing")
      try {
        container.remove()
      } catch {
        // ignore
      }
      fired.current = false
    }
  }, [open, container, data.schedule, onOpenChange, timeoutMs])

  const onAllReady = () => {
    if (fired.current) return
    fired.current = true
    try {
      window.print()
    } catch {
      toast.error("Export failed to start printing.")
      onOpenChange(false)
    }
  }

  if (!open) return null

  return createPortal(
    <PrintApp data={data} readiness={readyMap} onAllReady={onAllReady} />,
    container,
  )
}
