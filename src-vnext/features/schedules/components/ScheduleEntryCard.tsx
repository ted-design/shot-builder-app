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
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
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
    bg: "bg-amber-50",
    border: "border-amber-200",
    isRhythm: true,
  },
  move: {
    label: "Move",
    icon: Truck,
    accent: "border-l-slate-400",
    bg: "bg-slate-50",
    border: "border-slate-200",
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
  readonly reorderMode?: "buttons" | "none"
  readonly showTimelineNode?: boolean
  readonly trackSelect?: {
    readonly value: string
    readonly options: readonly { readonly value: string; readonly label: string }[]
    readonly onChange: (next: string) => void
  }
  readonly onMoveUp?: () => void
  readonly onMoveDown?: () => void
  readonly onRemove: () => void
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
}: {
  readonly value: string | null
  readonly onSave: (v: string | null) => void
  readonly placeholder: string
  readonly icon: typeof Clock
}) {
  return (
    <TypedTimeInput
      value={value ?? ""}
      placeholder={placeholder}
      icon={<Icon className="h-3 w-3" />}
      triggerClassName={`h-7 w-28 ${
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
}: {
  readonly value: string
  readonly onSave: (v: string) => void
  readonly emptyLabel?: string
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
        className="h-7 text-xs"
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
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-muted)]"
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
      className="rounded px-1.5 py-0.5 text-left text-xs text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-subtle)]"
    >
      {value}
    </button>
  )
}

function InlineTitleField({
  value,
  onSave,
}: {
  readonly value: string
  readonly onSave: (v: string) => void
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
        className="h-7 text-sm"
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
      className="truncate rounded px-1 py-0.5 text-left text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-subtle)]"
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
}: {
  readonly value: string
  readonly onSave: (v: string) => void
  readonly placeholder: string
  readonly icon: typeof Timer
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
        className="h-7 w-20 text-xs"
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

function TrackSelect({
  value,
  options,
  onChange,
}: {
  readonly value: string
  readonly options: readonly { readonly value: string; readonly label: string }[]
  readonly onChange: (next: string) => void
}) {
  if (options.length <= 1) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className="h-7 w-[124px] px-2 text-xs"
        aria-label="Move to track"
        title="Move to track"
      >
        <SelectValue placeholder="Track" />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

// --- Main component ---

export function ScheduleEntryCard({
  entry,
  isFirst,
  isLast,
  reorderMode = "buttons",
  showTimelineNode = true,
  trackSelect,
  onMoveUp,
  onMoveDown,
  onRemove,
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

  const timelineNodeClass = showTimelineNode ? nodeClasses(entry, typeConfig.isRhythm) : ""

  // Rhythm entries (break/move) get a compact, divider-like treatment
  if (typeConfig.isRhythm) {
    return (
      <>
        <div className={timelineNodeClass}>
          <div className={`group flex items-center gap-2 rounded-md border-l-[3px] ${typeConfig.accent} ${typeConfig.bg} border ${typeConfig.border} px-2.5 py-1.5`}>
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
            />

            <TypeIcon className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />

            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {entry.title}
            </span>

            {/* Duration inline */}
            <div className="flex flex-1 items-center justify-end gap-2">
              {trackSelect ? (
                <TrackSelect
                  value={trackSelect.value}
                  options={trackSelect.options}
                  onChange={trackSelect.onChange}
                />
              ) : null}
              <InlineNumberField
                value={entry.duration != null ? String(entry.duration) : ""}
                onSave={(v) => {
                  const parsed = parseInt(v, 10)
                  onUpdateDuration(Number.isNaN(parsed) ? undefined : parsed)
                }}
                placeholder="Dur."
                icon={Timer}
              />
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
              onClick={() => setConfirmOpen(true)}
              aria-label="Remove entry"
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
          className={`group flex items-start gap-2.5 rounded-md border-l-[3px] border px-3 py-2 transition-colors ${
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
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Row 1: Time (dominant) + Type icon + Title */}
            <div className="flex items-center gap-2">
              <InlineTimeField
                value={(entry.startTime ?? entry.time ?? null) as string | null}
                onSave={onUpdateStartTime}
                placeholder="Set time (e.g. 6:00 AM)"
                icon={Clock}
              />
              <TypeIcon className={`h-3.5 w-3.5 shrink-0 ${isCustomHighlight ? "text-[var(--color-text)]" : "text-[var(--color-primary)]"}`} />
              <InlineTitleField
                value={`${entry.highlight?.emoji ? `${entry.highlight.emoji} ` : ""}${entry.title}`}
                onSave={(nextValue) => {
                  const withoutEmojiPrefix = entry.highlight?.emoji
                    ? nextValue.replace(`${entry.highlight.emoji} `, "").trim()
                    : nextValue.trim()
                  onUpdateTitle(withoutEmojiPrefix || entry.title)
                }}
              />
              {entry.type !== "shot" && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-subtle)]">
                  {entryLabel}
                </span>
              )}
              {trackSelect ? (
                <div className="ml-auto shrink-0">
                  <TrackSelect
                    value={trackSelect.value}
                    options={trackSelect.options}
                    onChange={trackSelect.onChange}
                  />
                </div>
              ) : null}
            </div>

            {/* Row 2: Duration + Notes (tertiary) */}
            <div className="flex items-center gap-3">
              <InlineNumberField
                value={entry.duration != null ? String(entry.duration) : ""}
                onSave={(v) => {
                  const parsed = parseInt(v, 10)
                  onUpdateDuration(Number.isNaN(parsed) ? undefined : parsed)
                }}
                placeholder="Duration (min)"
                icon={Timer}
              />
              <InlineNotesField
                value={entry.notes ?? ""}
                onSave={onUpdateNotes}
                emptyLabel={isCustomHighlight ? "Add description" : "Add notes"}
              />
            </div>
          </div>

          {/* Delete */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
            onClick={() => setConfirmOpen(true)}
            aria-label="Remove entry"
          >
            <Trash2 className="h-3.5 w-3.5" />
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
