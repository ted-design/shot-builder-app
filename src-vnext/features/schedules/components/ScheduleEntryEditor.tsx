import { useState, useCallback } from "react"
import { Camera, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import {
  addScheduleEntryShot,
  addScheduleEntryCustom,
  updateScheduleEntryFields,
  removeScheduleEntry,
} from "@/features/schedules/lib/scheduleWrites"
import { ScheduleEntryCard } from "@/features/schedules/components/ScheduleEntryCard"
import { AddShotToScheduleDialog } from "@/features/schedules/components/AddShotToScheduleDialog"
import { AddCustomEntryDialog } from "@/features/schedules/components/AddCustomEntryDialog"
import type { ScheduleEntry, Shot, ScheduleEntryType } from "@/shared/types"

interface ScheduleEntryEditorProps {
  readonly scheduleId: string
  readonly entries: readonly ScheduleEntry[]
  readonly shots: readonly Shot[]
}

export function ScheduleEntryEditor({
  scheduleId,
  entries,
  shots,
}: ScheduleEntryEditorProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const [shotDialogOpen, setShotDialogOpen] = useState(false)
  const [customDialogOpen, setCustomDialogOpen] = useState(false)

  const nextOrder = entries.reduce((max, e) => Math.max(max, e.order ?? 0), -1) + 1

  // --- Add shot entry ---
  const handleAddShot = useCallback(
    async (shot: Shot) => {
      if (!clientId) return
      try {
        await addScheduleEntryShot(clientId, projectId, scheduleId, {
          shotId: shot.id,
          title: shot.title,
          order: nextOrder,
        })
      } catch (err) {
        toast.error("Failed to add shot to schedule.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, nextOrder],
  )

  // --- Add custom entry ---
  const handleAddCustom = useCallback(
    async (type: Exclude<ScheduleEntryType, "shot" | "banner">, title: string) => {
      if (!clientId) return
      try {
        await addScheduleEntryCustom(clientId, projectId, scheduleId, {
          type,
          title,
          order: nextOrder,
        })
      } catch (err) {
        toast.error("Failed to add entry.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, nextOrder],
  )

  // --- Reorder (swap order values) ---
  const handleSwap = useCallback(
    async (indexA: number, indexB: number) => {
      if (!clientId) return
      const entryA = entries[indexA]
      const entryB = entries[indexB]
      if (!entryA || !entryB) return
      try {
        await Promise.all([
          updateScheduleEntryFields(clientId, projectId, scheduleId, entryA.id, {
            order: entryB.order,
          }),
          updateScheduleEntryFields(clientId, projectId, scheduleId, entryB.id, {
            order: entryA.order,
          }),
        ])
      } catch (err) {
        toast.error("Failed to reorder entries.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, entries],
  )

  // --- Remove entry ---
  const handleRemove = useCallback(
    async (entryId: string) => {
      if (!clientId) return
      try {
        await removeScheduleEntry(clientId, projectId, scheduleId, entryId)
      } catch (err) {
        toast.error("Failed to remove entry.")
        throw err
      }
    },
    [clientId, projectId, scheduleId],
  )

  // --- Update field ---
  const handleUpdateField = useCallback(
    async (entryId: string, patch: Record<string, unknown>) => {
      if (!clientId) return
      try {
        await updateScheduleEntryFields(
          clientId,
          projectId,
          scheduleId,
          entryId,
          patch,
        )
      } catch (err) {
        toast.error("Failed to update entry.")
        throw err
      }
    },
    [clientId, projectId, scheduleId],
  )

  return (
    <div className="flex flex-col gap-3">
      {/* Section header with add buttons */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Schedule
        </h2>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShotDialogOpen(true)}
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Add Shot
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCustomDialogOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Entry
          </Button>
        </div>
      </div>

      {/* Entry list */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-[var(--color-border)] py-8">
          <p className="text-sm text-[var(--color-text-muted)]">
            No entries yet.
          </p>
          <p className="text-xs text-[var(--color-text-subtle)]">
            Add shots or custom entries to build the schedule.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry, idx) => (
            <ScheduleEntryCard
              key={entry.id}
              entry={entry}
              isFirst={idx === 0}
              isLast={idx === entries.length - 1}
              onMoveUp={() => handleSwap(idx, idx - 1)}
              onMoveDown={() => handleSwap(idx, idx + 1)}
              onRemove={() => handleRemove(entry.id)}
              onUpdateTime={(time) =>
                handleUpdateField(entry.id, { time: time || null })
              }
              onUpdateDuration={(duration) =>
                handleUpdateField(entry.id, { duration: duration ?? null })
              }
              onUpdateNotes={(notes) =>
                handleUpdateField(entry.id, { notes: notes || null })
              }
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AddShotToScheduleDialog
        open={shotDialogOpen}
        onOpenChange={setShotDialogOpen}
        shots={shots}
        existingEntries={entries}
        onAdd={handleAddShot}
      />
      <AddCustomEntryDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        onAdd={handleAddCustom}
      />
    </div>
  )
}
