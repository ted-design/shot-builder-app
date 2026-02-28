import { useState, type CSSProperties } from "react"
import {
  ArrowUp,
  ArrowDown,
  Trash2,
  Clock,
  Timer,
  StickyNote,
  Camera,
  Wrench,
  Coffee,
  Truck,
  Sparkles,
  Pencil,
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { toast } from "sonner"
import {
  minutesToHHMM,
  parseTimeToMinutes,
} from "@/features/schedules/lib/time"
import { TypedTimeInput } from "@/features/schedules/components/TypedTimeInput"
import type { ScheduleEntry, ScheduleEntryType } from "@/shared/types"

// --- Type visual config ---

const ENTRY_TYPE_CONFIG: Record<
  ScheduleEntryType,
  {
    readonly label: string
    readonly icon: typeof Camera
    readonly accent: string
    readonly bg: string
    readonly border: string
    readonly isRhythm: boolean
  }
> = {
  shot: {
    label: "Shot",
    icon: Camera,
    accent: "border-l-[var(--color-primary)]",
    bg: "bg-[var(--color-surface)]",
    border: "border-[var(--color-border)]",
    isRhythm: false,
  },
  setup: {
    label: "Setup",
    icon: Wrench,
    accent: "border-l-[var(--color-text-muted)]",
    bg: "bg-[var(--color-surface)]",
    border: "border-[var(--color-border)]",
    isRhythm: false,
  },
  break: {
    label: "Break",
    icon: Coffee,
    accent: "border-l-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    border: "border-amber-200 dark:border-amber-800",
    isRhythm: true,
  },
  move: {
    label: "Move",
    icon: Truck,
    accent: "border-l-[var(--color-text-subtle)]",
    bg: "bg-[var(--color-surface-subtle)]",
    border: "border-[var(--color-border)]",
    isRhythm: true,
  },
  banner: {
    label: "Banner",
    icon: StickyNote,
    accent: "border-l-[var(--color-text-subtle)]",
    bg: "bg-[var(--color-surface)]",
    border: "border-[var(--color-border)]",
    isRhythm: false,
  },
}

// --- Props ---

interface ScheduleEntryCardProps {
  readonly entry: ScheduleEntry
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly density?: "regular" | "compact"
  readonly reorderMode?: "buttons" | "none"
  readonly showTimelineNode?: boolean
  readonly trackSelect?: {
    readonly value: string
    readonly options: readonly { readonly value: string; readonly label: string }[]
  }
  readonly onMoveUp?: () => void
  readonly onMoveDown?: () => void
  readonly onRemove: () => void
  readonly onEdit?: () => void
  readonly onUpdateTitle: (title: string) => void
  readonly onUpdateStartTime: (startTime: string | null) => void
  readonly onUpdateDuration: (duration: number | undefined) => void
  readonly onUpdateNotes: (notes: string) => void
}

// --- Inline field editor ---

function InlineTimeField({
  value,
  onSave,
  placeholder,
  icon: Icon,
  compact = false,
}: {
  readonly value: string | null
  readonly onSave: (v: string | null) => void
  readonly placeholder: string
  readonly icon: typeof Clock
  readonly compact?: boolean
}) {
  return (
    <TypedTimeInput
      value={value ?? ""}
      placeholder={placeholder}
      icon={<Icon className="h-3 w-3" />}
      triggerClassName={`${compact ? "h-6 w-24" : "h-7 w-28"} ${
        value
          ? "font-mono text-xs font-semibold tabular-nums text-[var(--color-text)]"
          : "text-xs text-[var(--color-text-muted)]"
      }`}
      onSave={(nextValue) => {
        const trimmed = nextValue.trim()
        if (!trimmed) {
          if (value) onSave(null)
          return
        }
        const minutes = parseTimeToMinutes(trimmed)
        if (minutes == null) {
          toast.error("Invalid time. Use “6:00 AM” or “18:00”.")
          return
        }
        const next = minutesToHHMM(minutes)
        if (next !== value) onSave(next)
      }}
    />
  )
}

function InlineNotesField({
  value,
  onSave,
  emptyLabel = "Add notes",
  compact = false,
}: {
  readonly value: string
  readonly onSave: (v: string) => void
  readonly emptyLabel?: string
  readonly compact?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function handleSave() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) {
      onSave(trimmed)
    }
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave()
          if (e.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
        placeholder="Add notes..."
        className={`${compact ? "h-6" : "h-7"} text-xs`}
      />
    )
  }

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft("")
          setEditing(true)
        }}
        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-muted)] ${
          compact ? "leading-none" : ""
        }`}
      >
        <StickyNote className="h-3 w-3" />
        {emptyLabel}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={`max-w-full truncate rounded px-1.5 py-0.5 text-left text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)] ${
        compact ? "leading-none" : ""
      }`}
      title={value}
    >
      {value}
    </button>
  )
}

function InlineTitleField({
  value,
  onSave,
  compact = false,
}: {
  readonly value: string
  readonly onSave: (v: string) => void
  readonly compact?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function handleSave() {
    setEditing(false)
    const trimmed = draft.trim()
    if (!trimmed) {
      setDraft(value)
      return
    }
    if (trimmed !== value) onSave(trimmed)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={handleSave}
        onKeyDown={(event) => {
          if (event.key === "Enter") handleSave()
          if (event.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
        className={`${compact ? "h-6 text-sm" : "h-7 text-sm"}`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={`truncate rounded px-1 py-0.5 text-left font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-subtle)] ${
        compact ? "text-sm" : "text-sm"
      }`}
      title="Click to edit title"
    >
      {value}
    </button>
  )
}

function InlineNumberField({
  value,
  onSave,
  placeholder,
  icon: Icon,
  compact = false,
}: {
  readonly value: string
  readonly onSave: (v: string) => void
  readonly placeholder: string
  readonly icon: typeof Timer
  readonly compact?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function handleSave() {
    setEditing(false)
    const trimmed = draft.trim()
    if (trimmed !== value) onSave(trimmed)
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave()
          if (e.key === "Escape") {
            setDraft(value)
            setEditing(false)
          }
        }}
        placeholder={placeholder}
        className={`${compact ? "h-6 w-16" : "h-7 w-20"} text-xs`}
      />
    )
  }

  const hasValue = !!value

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value)
        setEditing(true)
      }}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--color-surface-subtle)] ${
        hasValue
          ? "font-mono text-xs font-semibold tabular-nums text-[var(--color-text)] hover:text-[var(--color-text)]"
          : "text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      }`}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {value || placeholder}
    </button>
  )
}

// --- Node class helper ---

function nodeClasses(entry: ScheduleEntry, isRhythm: boolean): string {
  const base = "schedule-entry-node"
  const active = (entry.startTime ?? entry.time) ? "schedule-entry-node--active" : ""
  const rhythm = isRhythm ? "schedule-entry-node--rhythm" : ""
  return [base, active, rhythm].filter(Boolean).join(" ")
}

function highlightCardStyle(
  highlight: NonNullable<ScheduleEntry["highlight"]>,
): CSSProperties {
  const color = highlight.color
  if (highlight.variant === "outline") {
    return {
      borderColor: color,
      borderLeftColor: color,
      backgroundColor: "var(--color-surface)",
    }
  }
  return {
    borderColor: color,
    borderLeftColor: color,
    backgroundColor: `${color}1a`,
  }
}

function resolveTrackLabel(trackSelect: ScheduleEntryCardProps["trackSelect"]): string | null {
  if (!trackSelect) return null
  if (trackSelect.options.length <= 1) return null
  const match = trackSelect.options.find((opt) => opt.value === trackSelect.value) ?? null
  return match?.label ?? null
}

// --- Main component ---

export function ScheduleEntryCard({
  entry,
  isFirst,
  isLast,
  density = "regular",
  reorderMode = "buttons",
  showTimelineNode = true,
  trackSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
  onEdit,
  onUpdateTitle,
  onUpdateStartTime,
  onUpdateDuration,
  onUpdateNotes,
}: ScheduleEntryCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const typeConfig = ENTRY_TYPE_CONFIG[entry.type]
  const isCustomHighlight = entry.type !== "shot" && !!entry.highlight
  const TypeIcon = isCustomHighlight ? Sparkles : typeConfig.icon
  const entryLabel = isCustomHighlight ? "Highlight" : typeConfig.label
  const trackLabel = resolveTrackLabel(trackSelect)
  const isCompact = density === "compact"
  const hasNotes = (entry.notes ?? "").trim().length > 0

  const timelineNodeClass = showTimelineNode ? nodeClasses(entry, typeConfig.isRhythm) : ""

  // Rhythm entries (break/move) get a compact, divider-like treatment
  if (typeConfig.isRhythm) {
    return (
      <>
        <div className={timelineNodeClass}>
          <div className={`group flex items-center gap-2 rounded-md border-l-[3px] ${typeConfig.accent} ${typeConfig.bg} border ${typeConfig.border} ${isCompact ? "px-2 py-1" : "px-2.5 py-1.5"}`}>
            {reorderMode === "buttons" && onMoveUp && onMoveDown && (
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isFirst} onClick={onMoveUp} aria-label="Move up">
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isLast} onClick={onMoveDown} aria-label="Move down">
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Time — dominant when set */}
            <InlineTimeField
              value={(entry.startTime ?? entry.time ?? null) as string | null}
              onSave={onUpdateStartTime}
              placeholder="Time"
              icon={Clock}
              compact={isCompact}
            />

            <TypeIcon className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />

            <span className="text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {entry.title}
            </span>

            {/* Duration inline */}
            <div className="flex flex-1 items-center justify-end gap-2">
              <InlineNumberField
                value={entry.duration != null ? String(entry.duration) : ""}
                onSave={(v) => {
                  const parsed = parseInt(v, 10)
                  onUpdateDuration(Number.isNaN(parsed) ? undefined : parsed)
                }}
                placeholder="Dur."
                icon={Timer}
                compact={isCompact}
              />
              {trackLabel ? (
                <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-text-muted)]">
                  {trackLabel}
                </span>
              ) : null}
            </div>

            {onEdit ? (
              <Button
                variant="ghost"
                size="icon"
                className={`${isCompact ? "h-4 w-4" : "h-5 w-5"} text-[var(--color-text-muted)]`}
                onClick={onEdit}
                aria-label="Edit entry"
                title="Edit entry"
              >
                <Pencil className="h-3 w-3" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className={`${isCompact ? "h-4 w-4" : "h-5 w-5"} text-[var(--color-text-muted)]`}
              onClick={() => setConfirmOpen(true)}
              aria-label="Remove entry"
              title="Remove entry"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Remove entry"
          description={`Remove "${entry.title}" from the schedule?`}
          confirmLabel="Remove"
          destructive
          onConfirm={onRemove}
        />
      </>
    )
  }

  // Shot / setup / banner — full card treatment with time-dominant layout
  return (
    <>
      <div className={timelineNodeClass}>
        <div
          className={`group flex items-start rounded-md border-l-[3px] border ${isCompact ? "gap-2 px-2.5 py-1.5" : "gap-2.5 px-3 py-2"} transition-colors ${
            isCustomHighlight
              ? "border-[var(--color-border)] bg-[var(--color-surface)]"
              : `${typeConfig.accent} ${typeConfig.border} ${typeConfig.bg} hover:border-[var(--color-border-strong)]`
          }`}
          style={isCustomHighlight && entry.highlight ? highlightCardStyle(entry.highlight) : undefined}
        >
          {reorderMode === "buttons" && onMoveUp && onMoveDown && (
            <div className="flex flex-col gap-0.5 pt-0.5">
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isFirst} onClick={onMoveUp} aria-label="Move up">
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isLast} onClick={onMoveDown} aria-label="Move down">
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Entry content — time dominant */}
          <div className={`flex min-w-0 flex-1 flex-col ${isCompact ? "gap-1" : "gap-1.5"}`}>
            {/* Row 1: Time (dominant) + Type icon + Title */}
            <div className="flex items-center gap-2">
              <InlineTimeField
                value={(entry.startTime ?? entry.time ?? null) as string | null}
                onSave={onUpdateStartTime}
                placeholder="Set time (e.g. 6:00 AM)"
                icon={Clock}
                compact={isCompact}
              />
              <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${isCustomHighlight ? "text-[var(--color-text)]" : "text-[var(--color-primary)]"}`} />
              <InlineTitleField
                value={`${entry.highlight?.emoji ? `${entry.highlight.emoji} ` : ""}${entry.title}`}
                compact={isCompact}
                onSave={(nextValue) => {
                  const withoutEmojiPrefix = entry.highlight?.emoji
                    ? nextValue.replace(`${entry.highlight.emoji} `, "").trim()
                    : nextValue.trim()
                  onUpdateTitle(withoutEmojiPrefix || entry.title)
                }}
              />
              {entry.type !== "shot" && (
                <span className="text-2xs font-medium uppercase tracking-wider text-[var(--color-text-subtle)]">
                  {entryLabel}
                </span>
              )}
            </div>

            {/* Row 2: Metadata */}
            <div className="flex items-center gap-2">
              <InlineNumberField
                value={entry.duration != null ? String(entry.duration) : ""}
                onSave={(v) => {
                  const parsed = parseInt(v, 10)
                  onUpdateDuration(Number.isNaN(parsed) ? undefined : parsed)
                }}
                placeholder={isCompact ? "Dur." : "Duration (min)"}
                icon={Timer}
                compact={isCompact}
              />
              {trackLabel ? (
                <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-text-muted)]">
                  {trackLabel}
                </span>
              ) : null}
              {!hasNotes ? (
                <InlineNotesField
                  value={entry.notes ?? ""}
                  onSave={onUpdateNotes}
                  emptyLabel={isCustomHighlight ? "Add description" : "Add notes"}
                  compact={isCompact}
                />
              ) : null}
            </div>

            {/* Row 3: Notes */}
            {hasNotes ? (
              <div className="flex items-center gap-2">
                <InlineNotesField
                  value={entry.notes ?? ""}
                  onSave={onUpdateNotes}
                  emptyLabel={isCustomHighlight ? "Add description" : "Add notes"}
                  compact={isCompact}
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-center gap-1">
            {onEdit ? (
              <Button
                variant="ghost"
                size="icon"
                className={`${isCompact ? "h-5 w-5" : "h-6 w-6"} text-[var(--color-text-muted)]`}
                onClick={onEdit}
                aria-label="Edit entry"
                title="Edit entry"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className={`${isCompact ? "h-5 w-5" : "h-6 w-6"} text-[var(--color-text-muted)]`}
              onClick={() => setConfirmOpen(true)}
              aria-label="Remove entry"
              title="Remove entry"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove entry"
        description={`Remove "${entry.title}" from the schedule?`}
        confirmLabel="Remove"
        destructive
        onConfirm={onRemove}
      />
    </>
  )
}
