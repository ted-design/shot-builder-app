import { useEffect, useState } from "react"
import { X, Camera, StickyNote, Clock, Timer } from "lucide-react"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { TypedTimeInput } from "@/features/schedules/components/TypedTimeInput"
import { getBlockColors } from "@/features/schedules/lib/blockColors"
import { formatMinutesTo12h, minutesToHHMM } from "@/features/schedules/lib/time"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"
import type { Shot } from "@/shared/types"

// ─── Types ────────────────────────────────────────────────────────────

interface TimelinePropertiesDrawerProps {
  readonly row: ProjectedScheduleRow | null
  readonly shot?: Shot
  readonly onClose: () => void
  readonly onUpdateNotes: (entryId: string, notes: string) => Promise<void>
  readonly onUpdateStartTime: (entryId: string, startTime: string | null) => Promise<void>
  readonly onUpdateDuration: (entryId: string, duration: number | undefined) => Promise<void>
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * Persistent 320px right-side properties panel for the Timeline Grid view.
 * Opens when a block is clicked. Collapses (width:0) when no entry is selected.
 * NOT a Sheet/dialog — it's a persistent panel in the flex layout.
 */
export function TimelinePropertiesDrawer({
  row,
  shot,
  onClose,
  onUpdateNotes,
  onUpdateStartTime,
  onUpdateDuration,
}: TimelinePropertiesDrawerProps) {
  const entry = row?.entry ?? null

  const [notesDraft, setNotesDraft] = useState("")
  const [durationDraft, setDurationDraft] = useState("")
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Sync drafts when entry changes
  useEffect(() => {
    if (!entry) return
    setNotesDraft(entry.notes ?? "")
    setDurationDraft(
      entry.duration != null && entry.duration > 0
        ? String(entry.duration)
        : "",
    )
  }, [entry])

  const isOpen = !!entry

  const colorVars = entry ? getBlockColors(entry) : null
  const isBanner = entry?.type === "banner"
  const Icon = isBanner ? StickyNote : Camera

  const timeLabel =
    row?.startMin != null ? formatMinutesTo12h(row.startMin) : null
  const endTimeLabel =
    row?.endMin != null ? formatMinutesTo12h(row.endMin) : null

  async function handleSaveNotes(): Promise<void> {
    if (!entry) return
    setIsSavingNotes(true)
    try {
      await onUpdateNotes(entry.id, notesDraft)
    } finally {
      setIsSavingNotes(false)
    }
  }

  async function handleBlurStartTime(value: string | null): Promise<void> {
    if (!row) return
    await onUpdateStartTime(row.id, value ? minutesToHHMM(
      value.includes(":") ? parseInt(value.split(":")[0]!, 10) * 60 + parseInt(value.split(":")[1]!, 10) : 0
    ) : null)
  }

  async function handleBlurDuration(): Promise<void> {
    if (!row) return
    const parsed = parseInt(durationDraft, 10)
    await onUpdateDuration(row.id, Number.isFinite(parsed) && parsed > 0 ? parsed : undefined)
  }

  return (
    <div
      className="flex shrink-0 flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)] transition-[width,opacity] duration-200"
      style={{
        width: isOpen ? "320px" : "0px",
        opacity: isOpen ? 1 : 0,
      }}
    >
      {entry && (
        <>
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-muted)] px-4 pb-3 pt-4">
            <div className="flex items-center gap-2 min-w-0">
              {colorVars && (
                <span
                  className="flex items-center gap-1.5 rounded px-2 py-0.5 text-xxs font-semibold border-l-[3px]"
                  style={{
                    borderLeftColor: colorVars.borderColorVar,
                    backgroundColor: colorVars.bgColorVar,
                  }}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  <span className="truncate">{isBanner ? "Banner" : "Shot"}</span>
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0 text-[var(--color-text-muted)]"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Title */}
          <div className="px-4 py-3">
            <p className="text-sm font-semibold text-[var(--color-text)] leading-snug">
              {entry.title}
            </p>
            {shot?.description ? (
              <p className="mt-1 text-xxs text-[var(--color-text-secondary)] leading-relaxed">
                {shot.description}
              </p>
            ) : null}
          </div>

          {/* Time info */}
          <div className="border-t border-[var(--color-border-muted)] px-4 py-3">
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Schedule
            </p>
            <div className="flex gap-3">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                <span className="text-xxs text-[var(--color-text-muted)]">
                  {timeLabel ?? "—"}
                  {endTimeLabel ? ` – ${endTimeLabel}` : ""}
                </span>
              </div>
              {row?.durationMinutes ? (
                <div className="flex items-center gap-1.5">
                  <Timer className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                  <span className="text-xxs text-[var(--color-text-muted)]">
                    {row.durationMinutes}m
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {/* Notes field */}
          <div className="border-t border-[var(--color-border-muted)] px-4 py-3">
            <Label className="mb-1.5 block text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
              Notes
            </Label>
            <Textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Add a note…"
              className="min-h-[80px] resize-none text-sm"
              disabled={isSavingNotes}
            />
          </div>

          {/* Shot details (read-only) */}
          {shot && (
            <div className="border-t border-[var(--color-border-muted)] px-4 py-3">
              <p className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                Shot Details
              </p>
              {shot.talent?.length ? (
                <div className="mb-1.5">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                    Talent
                  </span>
                  <p className="text-xxs text-[var(--color-text-muted)]">
                    {shot.talent.join(", ")}
                  </p>
                </div>
              ) : null}
              {shot.locationName ? (
                <div className="mb-1.5">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                    Location
                  </span>
                  <p className="text-xxs text-[var(--color-text-muted)]">
                    {shot.locationName}
                  </p>
                </div>
              ) : null}
              {shot.products?.length ? (
                <div className="mb-1.5">
                  <span className="text-3xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                    Products
                  </span>
                  <p className="text-xxs text-[var(--color-text-muted)]">
                    {shot.products
                      .map((p) => p.familyName ?? p.skuName)
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </>
      )}
    </div>
  )
}
