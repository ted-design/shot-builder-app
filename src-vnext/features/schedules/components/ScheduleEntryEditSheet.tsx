import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Clock, Timer, Type, StickyNote, Rows, Sparkles, Trash2 } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/ui/sheet"
import { Label } from "@/ui/label"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { TypedTimeInput } from "@/features/schedules/components/TypedTimeInput"
import {
  DEFAULT_HIGHLIGHT_COLOR,
  HIGHLIGHT_COLOR_PRESETS,
  HIGHLIGHT_EMOJI_PRESETS,
} from "@/features/schedules/lib/highlightPresets"
import { minutesToHHMM, parseTimeToMinutes } from "@/features/schedules/lib/time"
import type { ScheduleEntry, ScheduleEntryHighlight } from "@/shared/types"

interface ScheduleEntryEditSheetProps {
  readonly open: boolean
  readonly entry: ScheduleEntry | null
  readonly trackOptions: readonly { readonly value: string; readonly label: string }[]
  readonly onOpenChange: (open: boolean) => void
  readonly onUpdateTitle: (title: string) => Promise<void>
  readonly onUpdateStartTime: (startTime: string | null) => Promise<void>
  readonly onUpdateDuration: (duration: number | undefined) => Promise<void>
  readonly onUpdateNotes: (notes: string) => Promise<void>
  readonly onUpdateHighlight: (highlight: ScheduleEntryHighlight) => Promise<void>
  readonly onMoveToTrack: (trackId: string) => Promise<void>
  readonly onRemove?: () => Promise<void>
}

function isSharedEntry(entry: ScheduleEntry | null): boolean {
  if (!entry) return false
  return entry.trackId === "shared" || entry.trackId === "all" || entry.type === "banner"
}

export function ScheduleEntryEditSheet({
  open,
  entry,
  trackOptions,
  onOpenChange,
  onUpdateTitle,
  onUpdateStartTime,
  onUpdateDuration,
  onUpdateNotes,
  onUpdateHighlight,
  onMoveToTrack,
  onRemove,
}: ScheduleEntryEditSheetProps) {
  const [titleDraft, setTitleDraft] = useState("")
  const [durationDraft, setDurationDraft] = useState("")
  const [notesDraft, setNotesDraft] = useState("")
  const [trackDraft, setTrackDraft] = useState("primary")
  const [emojiDraft, setEmojiDraft] = useState("")
  const [highlightVariantDraft, setHighlightVariantDraft] = useState<ScheduleEntryHighlight["variant"]>("solid")
  const [highlightColorDraft, setHighlightColorDraft] = useState(DEFAULT_HIGHLIGHT_COLOR)

  useEffect(() => {
    if (!entry) return
    const currentHighlight = entry.highlight ?? {
      variant: "solid",
      color: DEFAULT_HIGHLIGHT_COLOR,
      emoji: null,
    }
    setTitleDraft(entry.title ?? "")
    setDurationDraft(entry.duration != null ? String(entry.duration) : "")
    setNotesDraft(entry.notes ?? "")
    setTrackDraft(entry.trackId ?? "primary")
    setEmojiDraft(currentHighlight.emoji ?? "")
    setHighlightVariantDraft(currentHighlight.variant)
    setHighlightColorDraft(currentHighlight.color)
  }, [entry])

  const canMoveTracks = useMemo(() => {
    if (!entry) return false
    if (isSharedEntry(entry)) return false
    return trackOptions.length > 1
  }, [entry, trackOptions.length])

  const canEditHighlight = useMemo(() => {
    if (!entry) return false
    return entry.type === "setup" || entry.type === "banner"
  }, [entry])

  const heading = useMemo(() => {
    if (!entry) return "Edit Entry"
    if (entry.type === "shot") return "Edit Shot Entry"
    if (entry.type === "setup" || entry.type === "banner") return "Edit Highlight Entry"
    return "Edit Schedule Entry"
  }, [entry])

  async function commitTitle() {
    if (!entry) return
    const trimmed = titleDraft.trim()
    if (!trimmed) {
      setTitleDraft(entry.title)
      return
    }
    if (trimmed === entry.title) return
    try {
      await onUpdateTitle(trimmed)
    } catch {
      toast.error("Failed to update title.")
      setTitleDraft(entry.title)
    }
  }

  async function commitDuration() {
    if (!entry) return
    const trimmed = durationDraft.trim()
    const current = entry.duration != null ? String(entry.duration) : ""
    if (trimmed === current) return
    if (!trimmed) {
      try {
        await onUpdateDuration(undefined)
      } catch {
        toast.error("Failed to update duration.")
        setDurationDraft(current)
      }
      return
    }
    const parsed = parseInt(trimmed, 10)
    if (Number.isNaN(parsed) || parsed <= 0) {
      toast.error("Duration must be a positive number.")
      setDurationDraft(current)
      return
    }
    try {
      await onUpdateDuration(parsed)
    } catch {
      toast.error("Failed to update duration.")
      setDurationDraft(current)
    }
  }

  async function commitNotes() {
    if (!entry) return
    const trimmed = notesDraft.trim()
    const current = (entry.notes ?? "").trim()
    if (trimmed === current) return
    try {
      await onUpdateNotes(trimmed)
    } catch {
      toast.error("Failed to update notes.")
      setNotesDraft(entry.notes ?? "")
    }
  }

  async function handleTimeSave(next: string) {
    if (!entry) return
    const trimmed = next.trim()
    if (!trimmed) {
      try {
        await onUpdateStartTime(null)
      } catch {
        toast.error("Failed to update time.")
      }
      return
    }
    const minutes = parseTimeToMinutes(trimmed)
    if (minutes == null) {
      toast.error("Invalid time. Use “6:00 AM” or “18:00”.")
      return
    }
    const canonical = minutesToHHMM(minutes)
    try {
      await onUpdateStartTime(canonical)
    } catch {
      toast.error("Failed to update time.")
    }
  }

  async function handleTrackChange(nextTrack: string) {
    if (!entry) return
    if (!canMoveTracks) return
    if (nextTrack === (entry.trackId ?? "primary")) {
      setTrackDraft(nextTrack)
      return
    }
    setTrackDraft(nextTrack)
    try {
      await onMoveToTrack(nextTrack)
    } catch {
      toast.error("Failed to move entry.")
      setTrackDraft(entry.trackId ?? "primary")
    }
  }

  async function commitHighlight(nextPatch?: {
    readonly variant?: ScheduleEntryHighlight["variant"]
    readonly color?: string
    readonly emoji?: string
  }) {
    if (!entry || !canEditHighlight) return
    const current = entry.highlight ?? {
      variant: "solid",
      color: DEFAULT_HIGHLIGHT_COLOR,
      emoji: null,
    }
    const nextVariant = nextPatch?.variant ?? highlightVariantDraft
    const nextColor = (nextPatch?.color ?? highlightColorDraft) || DEFAULT_HIGHLIGHT_COLOR
    const nextEmoji = (nextPatch?.emoji ?? emojiDraft).trim()
    const nextHighlight: ScheduleEntryHighlight = {
      variant: nextVariant,
      color: nextColor,
      emoji: nextEmoji || null,
    }
    if (
      current.variant === nextHighlight.variant &&
      current.color === nextHighlight.color &&
      (current.emoji ?? "") === (nextHighlight.emoji ?? "")
    ) {
      return
    }
    try {
      await onUpdateHighlight(nextHighlight)
    } catch {
      toast.error("Failed to update highlight style.")
      setHighlightVariantDraft(current.variant)
      setHighlightColorDraft(current.color)
      setEmojiDraft(current.emoji ?? "")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(520px,95vw)] overflow-y-auto p-0 sm:max-w-[520px]">
        <div className="flex h-full flex-col">
          <SheetHeader className="border-b border-[var(--color-border)] px-5 py-4">
            <SheetTitle className="text-base text-[var(--color-text)]">{heading}</SheetTitle>
            <SheetDescription className="text-xs text-[var(--color-text-muted)]">
              Changes here update the selected schedule entry immediately.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 px-5 py-4">
            <section className="flex flex-col gap-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Type className="h-3 w-3" />
                  Title
                </span>
              </Label>
              <Input
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => {
                  void commitTitle()
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    void commitTitle()
                  }
                }}
                className="h-9 text-sm"
              />
            </section>

            <section className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Time
                  </span>
                </Label>
                <TypedTimeInput
                  value={entry?.startTime ?? entry?.time ?? ""}
                  placeholder="Set time"
                  triggerClassName="h-9 w-full font-mono text-xs font-semibold"
                  onSave={(next) => {
                    void handleTimeSave(next)
                  }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    Duration (min)
                  </span>
                </Label>
                <Input
                  value={durationDraft}
                  onChange={(event) => setDurationDraft(event.target.value)}
                  onBlur={() => {
                    void commitDuration()
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      void commitDuration()
                    }
                  }}
                  inputMode="numeric"
                  className="h-9 text-sm"
                />
              </div>
            </section>

            {canMoveTracks ? (
              <section className="flex flex-col gap-2">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Rows className="h-3 w-3" />
                    Track
                  </span>
                </Label>
                <Select value={trackDraft} onValueChange={(next) => void handleTrackChange(next)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {trackOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </section>
            ) : null}

            {canEditHighlight ? (
              <section className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-3">
                <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Highlight Style
                  </span>
                </Label>

                <div className="grid grid-cols-[72px_1fr] gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="entry-highlight-emoji" className="text-[11px] text-[var(--color-text-muted)]">
                      Emoji
                    </Label>
                    <Input
                      id="entry-highlight-emoji"
                      value={emojiDraft}
                      onChange={(event) => setEmojiDraft(event.target.value)}
                      onBlur={() => {
                        void commitHighlight()
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault()
                          void commitHighlight()
                        }
                      }}
                      placeholder="✨"
                      className="h-9 text-center"
                      maxLength={4}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-[11px] text-[var(--color-text-muted)]">Style</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHighlightVariantDraft("solid")
                          void commitHighlight({ variant: "solid" })
                        }}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          highlightVariantDraft === "solid"
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                            : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                        }`}
                      >
                        Solid
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHighlightVariantDraft("outline")
                          void commitHighlight({ variant: "outline" })
                        }}
                        className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                          highlightVariantDraft === "outline"
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                            : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                        }`}
                      >
                        Outline
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-[11px] text-[var(--color-text-muted)]">Emoji Presets</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {HIGHLIGHT_EMOJI_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setEmojiDraft(preset)
                          void commitHighlight({ emoji: preset })
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-md border text-base transition-colors ${
                          emojiDraft === preset
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                            : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]"
                        }`}
                        aria-label={`Use emoji ${preset}`}
                        title={preset}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="entry-highlight-color" className="text-[11px] text-[var(--color-text-muted)]">
                    Color
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="entry-highlight-color"
                      type="color"
                      value={highlightColorDraft}
                      onChange={(event) => setHighlightColorDraft(event.target.value)}
                      onBlur={() => {
                        void commitHighlight()
                      }}
                      className="h-9 w-12 p-1"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {HIGHLIGHT_COLOR_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setHighlightColorDraft(preset)
                            void commitHighlight({ color: preset })
                          }}
                          className={`h-6 w-6 rounded border ${
                            highlightColorDraft === preset
                              ? "border-[var(--color-text)]"
                              : "border-[var(--color-border)]"
                          }`}
                          style={{ backgroundColor: preset }}
                          aria-label={`Set highlight color ${preset}`}
                          title={preset}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            <section className="flex flex-col gap-2">
              <Label className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                <span className="inline-flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  Notes
                </span>
              </Label>
              <Textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                onBlur={() => {
                  void commitNotes()
                }}
                className="min-h-[96px] text-sm"
                placeholder="Add notes..."
              />
            </section>

            {onRemove ? (
              <section className="border-t border-[var(--color-border)] pt-4">
                <button
                  type="button"
                  onClick={() => {
                    void onRemove()
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove from schedule
                </button>
              </section>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
