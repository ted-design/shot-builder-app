import { useSearchParams } from "react-router-dom"
import { useNowMinute } from "@/shared/hooks/useNowMinute"
import { OnSetNowBanner } from "@/features/schedules/components/OnSetNowBanner"
import { OnSetScheduleTab } from "@/features/schedules/components/OnSetScheduleTab"
import { OnSetCrewTab } from "@/features/schedules/components/OnSetCrewTab"
import { OnSetLocationTab } from "@/features/schedules/components/OnSetLocationTab"
import { OnSetNotesTab } from "@/features/schedules/components/OnSetNotesTab"
import { OnSetFloatingBar } from "@/features/schedules/components/OnSetFloatingBar"
import type { ScheduleEntry, DayDetails, CrewRecord, Schedule } from "@/shared/types"

type TabId = "schedule" | "crew" | "location" | "notes"

const VALID_TABS: TabId[] = ["schedule", "crew", "location", "notes"]

const TABS: { id: TabId; label: string }[] = [
  { id: "schedule", label: "Schedule" },
  { id: "crew", label: "Crew" },
  { id: "location", label: "Location" },
  { id: "notes", label: "Notes" },
]

function isValidTab(value: string | null): value is TabId {
  return VALID_TABS.includes(value as TabId)
}

interface OnSetViewerProps {
  schedule: Schedule
  dayDetails: DayDetails | null
  entries: ScheduleEntry[]
  crewLibrary: CrewRecord[]
}

export function OnSetViewer({
  schedule,
  dayDetails,
  entries,
  crewLibrary,
}: OnSetViewerProps) {
  const nowMinute = useNowMinute()
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get("tab")
  const activeTab: TabId = isValidTab(tabParam) ? tabParam : "schedule"

  function handleTabChange(tab: TabId) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set("tab", tab)
        return next
      },
      { replace: true },
    )
  }

  // Day number is not in existing Firestore data model — omitted per scope decision.
  return (
    <div className="relative flex flex-col bg-[var(--color-bg)]" style={{ height: "100dvh" }}>
      {/* Fixed header: LIVE banner + tab bar stacked — no nested sticky elements */}
      <div className="shrink-0 z-20">
        <OnSetNowBanner />

        {/* Project info line */}
        {schedule.name && (
          <div className="px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
            <p className="text-2xs text-[var(--color-text-muted)] truncate">{schedule.name}</p>
          </div>
        )}

        {/* Tab bar */}
        <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
          <div
            className="flex gap-6 px-5 overflow-x-auto"
            style={{ scrollbarWidth: "none" }}
          >
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className="relative py-2.5 text-sm font-medium whitespace-nowrap transition-colors select-none"
                  style={{ color: isActive ? "var(--color-text)" : "var(--color-text-muted)" }}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-sm bg-[var(--color-text)]"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Scrollable content — single scroll context, no nested sticky */}
      <div className="flex-1 overflow-y-auto pb-28">
        {activeTab === "schedule" && (
          <OnSetScheduleTab entries={entries} nowMinute={nowMinute} />
        )}
        {activeTab === "crew" && (
          <OnSetCrewTab crewLibrary={crewLibrary} />
        )}
        {activeTab === "location" && (
          <OnSetLocationTab dayDetails={dayDetails} />
        )}
        {activeTab === "notes" && (
          <OnSetNotesTab dayDetails={dayDetails} />
        )}
      </div>

      {/* Floating action bar — z-index 20 (above tab bar, below any future sheets at 30+) */}
      <OnSetFloatingBar />
    </div>
  )
}
