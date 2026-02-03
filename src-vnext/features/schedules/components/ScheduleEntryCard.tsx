import { useState } from "react"
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
} from "lucide-react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
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
  readonly onMoveUp: () => void
  readonly onMoveDown: () => void
  readonly onRemove: () => void
  readonly onUpdateTime: (time: string) => void
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
  readonly value: string
  readonly onSave: (v: string) => void
  readonly placeholder: string
  readonly icon: typeof Clock
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
        placeholder={placeholder}
        className="h-7 w-24 text-xs"
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

function InlineNotesField({
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
        Add notes
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

// --- Node class helper ---

function nodeClasses(entry: ScheduleEntry, isRhythm: boolean): string {
  const base = "schedule-entry-node"
  const active = entry.time ? "schedule-entry-node--active" : ""
  const rhythm = isRhythm ? "schedule-entry-node--rhythm" : ""
  return [base, active, rhythm].filter(Boolean).join(" ")
}

// --- Main component ---

export function ScheduleEntryCard({
  entry,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  onUpdateTime,
  onUpdateDuration,
  onUpdateNotes,
}: ScheduleEntryCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  const typeConfig = ENTRY_TYPE_CONFIG[entry.type]
  const TypeIcon = typeConfig.icon

  // Rhythm entries (break/move) get a compact, divider-like treatment
  if (typeConfig.isRhythm) {
    return (
      <>
        <div className={nodeClasses(entry, true)}>
          <div className={`group flex items-center gap-2 rounded-md border-l-[3px] ${typeConfig.accent} ${typeConfig.bg} border ${typeConfig.border} px-2.5 py-1.5`}>
            {/* Reorder */}
            <div className="flex gap-0.5">
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isFirst} onClick={onMoveUp} aria-label="Move up">
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isLast} onClick={onMoveDown} aria-label="Move down">
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>

            {/* Time — dominant when set */}
            {entry.time ? (
              <InlineTimeField value={entry.time} onSave={onUpdateTime} placeholder="Time" icon={Clock} />
            ) : (
              <InlineTimeField value="" onSave={onUpdateTime} placeholder="Time" icon={Clock} />
            )}

            <TypeIcon className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />

            <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              {entry.title}
            </span>

            {/* Duration inline */}
            <div className="flex flex-1 items-center justify-end gap-2">
              <InlineTimeField
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
      <div className={nodeClasses(entry, false)}>
        <div className={`group flex items-start gap-2.5 rounded-md border-l-[3px] ${typeConfig.accent} border ${typeConfig.border} ${typeConfig.bg} px-3 py-2 transition-colors hover:border-[var(--color-border-strong)]`}>
          {/* Reorder controls */}
          <div className="flex flex-col gap-0.5 pt-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isFirst} onClick={onMoveUp} aria-label="Move up">
              <ArrowUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5" disabled={isLast} onClick={onMoveDown} aria-label="Move down">
              <ArrowDown className="h-3 w-3" />
            </Button>
          </div>

          {/* Entry content — time dominant */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {/* Row 1: Time (dominant) + Type icon + Title */}
            <div className="flex items-center gap-2">
              <InlineTimeField value={entry.time ?? ""} onSave={onUpdateTime} placeholder="Set time" icon={Clock} />
              <TypeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
              <span className="truncate text-sm font-medium text-[var(--color-text)]">
                {entry.title}
              </span>
              {entry.type !== "shot" && (
                <span className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-subtle)]">
                  {typeConfig.label}
                </span>
              )}
            </div>

            {/* Row 2: Duration + Notes (tertiary) */}
            <div className="flex items-center gap-3">
              <InlineTimeField
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
