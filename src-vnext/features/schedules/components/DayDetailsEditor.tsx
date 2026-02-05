import { useCallback } from "react"
import { Clock, Utensils, Sun, Camera } from "lucide-react"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { updateDayDetails } from "@/features/schedules/lib/scheduleWrites"
import type { DayDetails } from "@/shared/types"

interface DayDetailsEditorProps {
  readonly scheduleId: string
  readonly scheduleName: string
  readonly dateStr: string
  readonly dayDetails: DayDetails | null
}

interface TimeAnchorProps {
  readonly icon: React.ReactNode
  readonly label: string
  readonly value: string
  readonly placeholder: string
  readonly onSave: (value: string) => void
  readonly required?: boolean
}

function TimeAnchor({ icon, label, value, placeholder, onSave, required }: TimeAnchorProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]">
        {icon}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
          {label}
          {required && !value && (
            <span className="ml-1 normal-case tracking-normal text-[var(--color-warning)]">
              required
            </span>
          )}
        </span>
        <InlineEdit
          value={value}
          onSave={onSave}
          placeholder={placeholder}
          className="text-sm font-semibold"
        />
      </div>
    </div>
  )
}

export function DayDetailsEditor({
  scheduleId,
  scheduleName,
  dateStr,
  dayDetails,
}: DayDetailsEditorProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const saveField = useCallback(
    (field: string) => (value: string) => {
      if (!clientId) return
      updateDayDetails(clientId, projectId, scheduleId, dayDetails?.id ?? null, {
        [field]: value || null,
      })
    },
    [clientId, projectId, scheduleId, dayDetails?.id],
  )

  return (
    <div className="flex flex-col gap-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      {/* Schedule identity */}
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text)]">
          {scheduleName}
        </h2>
        {dateStr && (
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{dateStr}</p>
        )}
      </div>

      {/* Day anchors */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <TimeAnchor
          icon={<Clock className="h-3.5 w-3.5" />}
          label="Crew Call"
          value={dayDetails?.crewCallTime ?? ""}
          placeholder="e.g. 6:00 AM"
          onSave={saveField("crewCallTime")}
          required
        />
        <TimeAnchor
          icon={<Camera className="h-3.5 w-3.5" />}
          label="Shooting Call"
          value={dayDetails?.shootingCallTime ?? ""}
          placeholder="e.g. 7:00 AM"
          onSave={saveField("shootingCallTime")}
          required
        />
        <TimeAnchor
          icon={<Utensils className="h-3.5 w-3.5" />}
          label="Breakfast"
          value={dayDetails?.breakfastTime ?? ""}
          placeholder="optional"
          onSave={saveField("breakfastTime")}
        />
        <TimeAnchor
          icon={<Sun className="h-3.5 w-3.5" />}
          label="Est. Wrap"
          value={dayDetails?.estimatedWrap ?? ""}
          placeholder="e.g. 7:00 PM"
          onSave={saveField("estimatedWrap")}
          required
        />
      </div>
    </div>
  )
}
