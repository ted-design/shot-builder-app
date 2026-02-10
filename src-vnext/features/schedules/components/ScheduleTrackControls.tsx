import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Plus, Trash2, Layers, ArrowDownUp } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Switch } from "@/ui/switch"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { InlineEdit } from "@/shared/components/InlineEdit"
import { updateScheduleFields, batchUpdateScheduleAndEntries } from "@/features/schedules/lib/scheduleWrites"
import { buildCollapseToSingleTrack } from "@/features/schedules/lib/transforms"
import { classifyTimeInput } from "@/features/schedules/lib/time"
import { TypedTimeInput } from "@/features/schedules/components/TypedTimeInput"
import type { Schedule, ScheduleEntry, ScheduleSettings, ScheduleTrack } from "@/shared/types"

function normalizeSettings(settings: Schedule["settings"] | undefined): ScheduleSettings {
  return {
    cascadeChanges: settings?.cascadeChanges !== false,
    dayStartTime: typeof settings?.dayStartTime === "string" ? settings.dayStartTime : "06:00",
    defaultEntryDurationMinutes:
      typeof settings?.defaultEntryDurationMinutes === "number"
        ? settings.defaultEntryDurationMinutes
        : 15,
  }
}

function normalizeTracks(tracks: Schedule["tracks"] | undefined): readonly ScheduleTrack[] {
  if (tracks && tracks.length > 0) {
    return [...tracks].slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return [{ id: "primary", name: "Primary", order: 0 }]
}

function createTrackId(): string {
  const id = globalThis.crypto?.randomUUID?.()
  if (id) return `track-${id.slice(0, 8)}`
  return `track-${Date.now()}`
}

export function ScheduleTrackControls({
  scheduleId,
  schedule,
  entries,
}: {
  readonly scheduleId: string
  readonly schedule: Schedule
  readonly entries: readonly ScheduleEntry[]
}) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const tracks = useMemo(() => normalizeTracks(schedule.tracks), [schedule.tracks])
  const settings = useMemo(() => normalizeSettings(schedule.settings), [schedule.settings])

  const [collapseOpen, setCollapseOpen] = useState(false)

  const entryCountsByTrack = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tracks) counts.set(t.id, 0)
    for (const e of entries) {
      if (e.type === "banner" || e.trackId === "shared" || e.trackId === "all") continue
      const tid = e.trackId ?? "primary"
      counts.set(tid, (counts.get(tid) ?? 0) + 1)
    }
    return counts
  }, [entries, tracks])

  async function patchScheduleSettings(patch: Partial<ScheduleSettings>) {
    if (!clientId) return
    try {
      await updateScheduleFields(clientId, projectId, scheduleId, {
        settings: { ...settings, ...patch },
      })
    } catch (err) {
      toast.error("Failed to update schedule settings.")
      throw err
    }
  }

  async function patchTracks(next: readonly ScheduleTrack[]) {
    if (!clientId) return
    try {
      await updateScheduleFields(clientId, projectId, scheduleId, { tracks: next })
    } catch (err) {
      toast.error("Failed to update tracks.")
      throw err
    }
  }

  const multiEnabled = tracks.length > 1

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--color-text-subtle)]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
            Tracks
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-subtle)]">Cascade</span>
            <Switch
              checked={settings.cascadeChanges}
              onCheckedChange={(checked) => {
                void patchScheduleSettings({ cascadeChanges: checked })
              }}
            />
          </div>
          {!multiEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next: ScheduleTrack[] = [
                  { id: "primary", name: "Primary", order: 0 },
                  { id: createTrackId(), name: "Track 2", order: 1 },
                ]
                void patchTracks(next)
              }}
            >
              <ArrowDownUp className="mr-1.5 h-3.5 w-3.5" />
              Enable Multi
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const next = [
                    ...tracks,
                    { id: createTrackId(), name: `Track ${tracks.length + 1}`, order: tracks.length },
                  ]
                  void patchTracks(next)
                }}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Track
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setCollapseOpen(true)}
              >
                Collapse
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-2">
        {tracks.map((t) => {
          const count = entryCountsByTrack.get(t.id) ?? 0
          const canRemove = t.id !== "primary" && count === 0
          return (
            <div
              key={t.id}
              className="flex items-center justify-between gap-2 rounded border border-[var(--color-border)] bg-white px-2.5 py-2"
            >
              <div className="min-w-0 flex-1">
                <InlineEdit
                  value={t.name}
                  placeholder="Track name"
                  onSave={(nextName) => {
                    const next = tracks.map((track) =>
                      track.id === t.id
                        ? { ...track, name: nextName.trim() || track.name }
                        : track,
                    )
                    void patchTracks(next)
                  }}
                  className="text-sm font-medium text-[var(--color-text)]"
                />
                <div className="mt-0.5 text-[10px] text-[var(--color-text-subtle)]">
                  {count} {count === 1 ? "entry" : "entries"}
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                disabled={!canRemove}
                onClick={() => {
                  const next = tracks.filter((track) => track.id !== t.id)
                  void patchTracks(next)
                }}
                aria-label="Remove track"
                title={canRemove ? "Remove track" : "Track must be empty to remove"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
            Day Start
          </span>
          <TypedTimeInput
            value={settings.dayStartTime}
            placeholder="06:00"
            triggerClassName="h-8 text-xs"
            onSave={(raw) => {
              const parsed = classifyTimeInput(raw)
              if (parsed.kind !== "time") {
                toast.error("Day start requires a valid time.")
                return
              }
              void patchScheduleSettings({ dayStartTime: parsed.canonical })
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
            Default Dur.
          </span>
          <Input
            defaultValue={String(settings.defaultEntryDurationMinutes)}
            inputMode="numeric"
            className="h-8 text-xs"
            onBlur={(e) => {
              const parsed = Number.parseInt(e.target.value, 10)
              if (!Number.isFinite(parsed) || parsed <= 0) {
                toast.error("Default duration must be a positive number of minutes.")
                e.target.value = String(settings.defaultEntryDurationMinutes)
                return
              }
              void patchScheduleSettings({ defaultEntryDurationMinutes: parsed })
            }}
          />
        </div>
      </div>

      <ConfirmDialog
        open={collapseOpen}
        onOpenChange={setCollapseOpen}
        title="Collapse to single track"
        description="This will merge all tracks into Primary, clear shared applicability, and normalize ordering/times. This cannot be undone."
        confirmLabel="Collapse"
        destructive
        onConfirm={async () => {
          if (!clientId) return
          try {
            const collapse = buildCollapseToSingleTrack({ entries, settings })
            await batchUpdateScheduleAndEntries(clientId, projectId, scheduleId, {
              schedulePatch: { tracks: collapse.tracks },
              entryUpdates: collapse.entryUpdates,
            })
            toast.success("Collapsed to a single track.")
          } catch (err) {
            toast.error("Failed to collapse schedule.")
            throw err
          }
        }}
      />
    </div>
  )
}
