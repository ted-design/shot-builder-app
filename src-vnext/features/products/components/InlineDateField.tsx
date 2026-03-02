import { useState } from "react"
import type { Timestamp } from "firebase/firestore"
import { formatLaunchDate, getLaunchDeadlineWarning } from "@/features/products/lib/assetRequirements"
import { parseDateInput } from "@/features/products/lib/productDetailHelpers"
import { toast } from "@/shared/hooks/use-toast"
import { CalendarDays, Pencil, X } from "lucide-react"
import { Button } from "@/ui/button"

interface InlineDateFieldProps {
  readonly value: Timestamp | null | undefined
  readonly onChange: (date: Date | null) => Promise<void>
  readonly canEdit: boolean
  readonly label?: string
  readonly showWarning?: boolean
}

function timestampToInputValue(ts: Timestamp | null | undefined): string {
  if (!ts) return ""
  try {
    const d = ts.toDate()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${day}`
  } catch {
    return ""
  }
}

export function InlineDateField({
  value,
  onChange,
  canEdit,
  label,
  showWarning = true,
}: InlineDateFieldProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(() => timestampToInputValue(value))
  const [saving, setSaving] = useState(false)

  const warning = showWarning ? getLaunchDeadlineWarning(value) : "none"

  const handleSave = async () => {
    const parsed = inputValue.trim() ? parseDateInput(inputValue) : null
    setSaving(true)
    try {
      await onChange(parsed)
      setEditing(false)
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not update date.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    setSaving(true)
    try {
      await onChange(null)
      setInputValue("")
      setEditing(false)
    } catch (err) {
      toast({
        title: "Clear failed",
        description: err instanceof Error ? err.message : "Could not clear date.",
      })
    } finally {
      setSaving(false)
    }
  }

  if (editing && canEdit) {
    return (
      <div className="flex items-center gap-2">
        {label && (
          <span className="text-2xs text-[var(--color-text-muted)]">{label}</span>
        )}
        <input
          type="date"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 text-sm text-[var(--color-text)]"
          disabled={saving}
        />
        <Button size="sm" variant="outline" disabled={saving} onClick={() => void handleSave()}>
          Save
        </Button>
        {value && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => void handleClear()}>
            <X className="h-3 w-3" />
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          disabled={saving}
          onClick={() => {
            setEditing(false)
            setInputValue(timestampToInputValue(value))
          }}
        >
          Cancel
        </Button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <CalendarDays className="h-4 w-4 text-[var(--color-text-subtle)]" />
      {label && (
        <span className="text-2xs text-[var(--color-text-muted)]">{label}</span>
      )}
      <span className="text-sm text-[var(--color-text)]">{formatLaunchDate(value)}</span>
      {warning === "overdue" && (
        <span className="rounded-md bg-[var(--color-status-red-bg)] px-1.5 py-0.5 text-2xs text-[var(--color-status-red-text)]">
          Overdue
        </span>
      )}
      {warning === "soon" && (
        <span className="rounded-md bg-[var(--color-status-amber-bg)] px-1.5 py-0.5 text-2xs text-[var(--color-status-amber-text)]">
          Soon
        </span>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            setInputValue(timestampToInputValue(value))
            setEditing(true)
          }}
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}
