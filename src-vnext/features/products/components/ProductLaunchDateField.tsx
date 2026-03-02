import { useState } from "react"
import type { Timestamp } from "firebase/firestore"
import { parseDateInput } from "@/features/products/lib/productDetailHelpers"
import { formatLaunchDate, getLaunchDeadlineWarning } from "@/features/products/lib/assetRequirements"
import { updateProductFamilyLaunchDate } from "@/features/products/lib/productWorkspaceWrites"
import { toast } from "@/shared/hooks/use-toast"
import { CalendarDays, Pencil, X } from "lucide-react"
import { Button } from "@/ui/button"

interface ProductLaunchDateFieldProps {
  readonly familyId: string
  readonly clientId: string | null
  readonly userId: string | null
  readonly launchDate: Timestamp | null | undefined
  readonly canEdit: boolean
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

export function ProductLaunchDateField({
  familyId,
  clientId,
  userId,
  launchDate,
  canEdit,
}: ProductLaunchDateFieldProps) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(() => timestampToInputValue(launchDate))
  const [saving, setSaving] = useState(false)

  const warning = getLaunchDeadlineWarning(launchDate)

  const handleSave = async () => {
    if (!clientId) return
    const parsed = inputValue.trim() ? parseDateInput(inputValue) : null
    setSaving(true)
    try {
      await updateProductFamilyLaunchDate({ clientId, familyId, userId, launchDate: parsed })
      setEditing(false)
    } catch (err) {
      toast({
        title: "Save failed",
        description: err instanceof Error ? err.message : "Could not update launch date.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClear = async () => {
    if (!clientId) return
    setSaving(true)
    try {
      await updateProductFamilyLaunchDate({ clientId, familyId, userId, launchDate: null })
      setInputValue("")
      setEditing(false)
    } catch (err) {
      toast({
        title: "Clear failed",
        description: err instanceof Error ? err.message : "Could not clear launch date.",
      })
    } finally {
      setSaving(false)
    }
  }

  if (editing && canEdit) {
    return (
      <div className="flex items-center gap-2">
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
        {launchDate && (
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
            setInputValue(timestampToInputValue(launchDate))
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
      <span className="text-sm text-[var(--color-text)]">{formatLaunchDate(launchDate)}</span>
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
            setInputValue(timestampToInputValue(launchDate))
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
