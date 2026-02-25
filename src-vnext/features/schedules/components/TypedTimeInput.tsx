import { useCallback, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/ui/popover"
import { classifyTimeInput, formatHHMMTo12h, parseTimeToMinutes } from "@/features/schedules/lib/time"
import { cn } from "@/shared/lib/utils"

type EditMode = "time" | "text"

interface TypedTimeInputProps {
  readonly value: string
  readonly onSave: (value: string) => void
  readonly placeholder?: string
  readonly allowText?: boolean
  readonly disabled?: boolean
  readonly icon?: React.ReactNode
  readonly triggerClassName?: string
  readonly contentAlign?: "start" | "center" | "end"
}

function minutesToParts(minutes: number): { readonly hour: string; readonly minute: string; readonly period: "AM" | "PM" } {
  const normalized = ((Math.floor(minutes) % (24 * 60)) + (24 * 60)) % (24 * 60)
  const h24 = Math.floor(normalized / 60)
  const minute = String(normalized % 60).padStart(2, "0")
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM"
  const hour = String(h24 % 12 === 0 ? 12 : h24 % 12)
  return { hour, minute, period }
}

function formatTimeDisplay(value: string): string {
  const formatted = formatHHMMTo12h(value)
  return formatted || value
}

export function TypedTimeInput({
  value,
  onSave,
  placeholder = "Set time",
  allowText = false,
  disabled = false,
  icon,
  triggerClassName,
  contentAlign = "start",
}: TypedTimeInputProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<EditMode>("time")
  const [hourDraft, setHourDraft] = useState("6")
  const [minuteDraft, setMinuteDraft] = useState("00")
  const [periodDraft, setPeriodDraft] = useState<"AM" | "PM">("AM")
  const [textDraft, setTextDraft] = useState("")

  const classified = useMemo(
    () => classifyTimeInput(value, { allowText }),
    [allowText, value],
  )

  const display = useMemo(() => {
    if (classified.kind === "time") return formatTimeDisplay(classified.canonical)
    if (classified.kind === "text") return classified.text
    const trimmed = value.trim()
    return trimmed || ""
  }, [classified, value])

  const hydrateDraftFromValue = useCallback(() => {
    const parsed = classifyTimeInput(value, { allowText })
    if (parsed.kind === "time") {
      const minutes = parseTimeToMinutes(parsed.canonical) ?? 6 * 60
      const parts = minutesToParts(minutes)
      setMode("time")
      setHourDraft(parts.hour)
      setMinuteDraft(parts.minute)
      setPeriodDraft(parts.period)
      setTextDraft("")
      return
    }

    if (allowText && parsed.kind === "text") {
      setMode("text")
      setTextDraft(parsed.text)
      return
    }

    const fallbackMinutes = parseTimeToMinutes(value) ?? parseTimeToMinutes(placeholder) ?? 6 * 60
    const parts = minutesToParts(fallbackMinutes)
    setMode("time")
    setHourDraft(parts.hour)
    setMinuteDraft(parts.minute)
    setPeriodDraft(parts.period)
    setTextDraft("")
  }, [allowText, value])

  const commitTime = useCallback(() => {
    const hours = Number.parseInt(hourDraft, 10)
    const minutes = Number.parseInt(minuteDraft, 10)

    if (!Number.isFinite(hours) || hours < 1 || hours > 12) {
      toast.error("Hour must be between 1 and 12.")
      return
    }
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 59) {
      toast.error("Minute must be between 00 and 59.")
      return
    }
    if (minutes % 5 !== 0) {
      toast.error("Minute must use 5-minute steps.")
      return
    }

    onSave(`${hours}:${String(minutes).padStart(2, "0")} ${periodDraft}`)
    setOpen(false)
  }, [hourDraft, minuteDraft, onSave, periodDraft])

  const commitText = useCallback(() => {
    onSave(textDraft.trim())
    setOpen(false)
  }, [onSave, textDraft])

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) hydrateDraftFromValue()
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex w-full items-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-left transition-colors hover:bg-[var(--color-surface-subtle)] disabled:cursor-default disabled:opacity-60",
            !display && "text-[var(--color-text-subtle)]",
            triggerClassName,
          )}
        >
          {icon ? <span className="shrink-0 text-[var(--color-text-muted)]">{icon}</span> : null}
          <span className="min-w-0 flex-1 truncate">{display || placeholder}</span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={contentAlign} className="w-64 p-3">
        <div className="flex flex-col gap-3">
          {allowText ? (
            <div className="flex items-center gap-1 rounded-md bg-[var(--color-surface-subtle)] p-1">
              <button
                type="button"
                className={cn(
                  "h-7 flex-1 rounded text-xs font-medium transition-colors",
                  mode === "time" ? "bg-white text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)]",
                )}
                onClick={() => setMode("time")}
              >
                Time
              </button>
              <button
                type="button"
                className={cn(
                  "h-7 flex-1 rounded text-xs font-medium transition-colors",
                  mode === "text" ? "bg-white text-[var(--color-text)] shadow-sm" : "text-[var(--color-text-muted)]",
                )}
                onClick={() => setMode("text")}
              >
                Text
              </button>
            </div>
          ) : null}

          {mode === "time" ? (
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">Hour</span>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  step={1}
                  value={hourDraft}
                  inputMode="numeric"
                  onChange={(e) => setHourDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTime()
                  }}
                  className="h-8 text-xs"
                  placeholder="1-12"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">Min</span>
                <Input
                  type="number"
                  min={0}
                  max={55}
                  step={5}
                  value={minuteDraft}
                  inputMode="numeric"
                  onChange={(e) => setMinuteDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitTime()
                  }}
                  className="h-8 text-xs"
                  placeholder="00"
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">AM/PM</span>
                <select
                  value={periodDraft}
                  onChange={(e) => setPeriodDraft(e.target.value === "PM" ? "PM" : "AM")}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <span className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">Text override</span>
              <Input
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitText()
                }}
                placeholder="OFF, O/C, etc"
                className="h-8 text-xs"
              />
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                onSave("")
                setOpen(false)
              }}
            >
              Clear
            </Button>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={mode === "time" ? commitTime : commitText}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
