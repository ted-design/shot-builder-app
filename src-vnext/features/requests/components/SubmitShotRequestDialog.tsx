import { useState, useEffect, useId } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { ChevronRight, X, Check, ChevronsUpDown } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { submitShotRequest } from "@/features/requests/lib/requestWrites"
import { RecipientPicker } from "@/features/requests/components/RecipientPicker"
import { ReferenceInput } from "@/features/requests/components/ReferenceInput"
import { useProductFamilies } from "@/features/products/hooks/useProducts"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import type { ShotRequestPriority, ShotRequestReference } from "@/shared/types"

const titleSchema = z.string().min(1, "Title is required")

interface SubmitShotRequestDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

function ProductPickerPopover({
  selectedIds,
  onToggle,
}: {
  readonly selectedIds: readonly string[]
  readonly onToggle: (id: string) => void
}) {
  const { data: families } = useProductFamilies()
  const [search, setSearch] = useState("")
  const [popoverOpen, setPopoverOpen] = useState(false)
  const searchId = useId()

  const filtered = families.filter((f) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      f.styleName.toLowerCase().includes(q) ||
      (f.styleNumbers?.[0] ?? f.styleNumber ?? "").toLowerCase().includes(q)
    )
  })

  const selectedFamilies = families.filter((f) => selectedIds.includes(f.id))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedFamilies.map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xs text-[var(--color-text)]"
          >
            {f.styleName}
            <button
              type="button"
              onClick={() => onToggle(f.id)}
              aria-label={`Remove ${f.styleName}`}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
            >
              <X size={10} />
            </button>
          </span>
        ))}
      </div>

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-9 w-full items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-text-muted)] hover:bg-[var(--color-surface-subtle)]"
          >
            {selectedIds.length > 0
              ? `${selectedIds.length} product${selectedIds.length === 1 ? "" : "s"} selected`
              : "Search products..."}
            <ChevronsUpDown size={14} className="shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <label htmlFor={searchId} className="sr-only">
            Search products
          </label>
          <Input
            id={searchId}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or style number..."
            className="mb-2 h-8 text-sm"
            autoFocus
          />
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">
                No products found
              </p>
            )}
            {filtered.map((f) => {
              const isSelected = selectedIds.includes(f.id)
              const styleNum = f.styleNumbers?.[0] ?? f.styleNumber
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onToggle(f.id)}
                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--color-surface-subtle)]"
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    {isSelected && (
                      <Check size={10} className="text-[var(--color-text-inverted)]" />
                    )}
                  </span>
                  <span className="flex-1 truncate text-[var(--color-text)]">
                    {f.styleName}
                  </span>
                  {styleNum && (
                    <span className="shrink-0 text-xxs text-[var(--color-text-muted)]">
                      {styleNum}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function SubmitShotRequestDialog({
  open,
  onOpenChange,
}: SubmitShotRequestDialogProps) {
  const { user, clientId } = useAuth()

  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<ShotRequestPriority>("normal")
  const [description, setDescription] = useState("")
  const [references, setReferences] = useState<readonly ShotRequestReference[]>([])
  const [deadline, setDeadline] = useState("")
  const [notes, setNotes] = useState("")
  const [relatedFamilyIds, setRelatedFamilyIds] = useState<readonly string[]>([])
  const [notifyUserIds, setNotifyUserIds] = useState<readonly string[]>([])
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  // Stable requestId placeholder for Storage path during composition
  const [draftRequestId] = useState(() => `draft-${Date.now()}`)

  useEffect(() => {
    if (open) {
      setTitle("")
      setPriority("normal")
      setDescription("")
      setReferences([])
      setDeadline("")
      setNotes("")
      setRelatedFamilyIds([])
      setNotifyUserIds([])
      setTitleError(null)
      setSaving(false)
      setDetailsOpen(false)
    }
  }, [open])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setTitleError(null)
  }

  const handleToggleFamily = (familyId: string) => {
    setRelatedFamilyIds((prev) =>
      prev.includes(familyId)
        ? prev.filter((id) => id !== familyId)
        : [...prev, familyId],
    )
  }

  const canSubmit = title.trim().length > 0 && !saving

  const handleSubmit = async () => {
    const result = titleSchema.safeParse(title.trim())
    if (!result.success) {
      setTitleError(result.error.issues[0]?.message ?? "Title is required")
      return
    }

    if (!clientId || !user?.uid) {
      toast.error("Must be signed in to submit a request.")
      return
    }

    setSaving(true)
    try {
      const validReferences = references.filter((r) => r.url.trim().length > 0)

      await submitShotRequest({
        clientId,
        title: result.data,
        priority,
        description: description.trim() || null,
        referenceUrls: null,
        references: validReferences.length > 0 ? validReferences : null,
        deadline: deadline || null,
        notes: notes.trim() || null,
        submittedBy: user.uid,
        submittedByName: user.displayName ?? null,
        relatedFamilyIds: relatedFamilyIds.length > 0 ? [...relatedFamilyIds] : null,
        notifyUserIds: notifyUserIds.length > 0 ? [...notifyUserIds] : null,
      })

      toast.success("Shot request submitted")
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New Shot Request"
      description="Submit a request for new shots to be planned"
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {saving ? "Submitting..." : "Submit Request"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        {/* Title (required) */}
        <div className="flex flex-col gap-2">
          <Label htmlFor="request-title">
            Title <span className="text-[var(--color-error)]">*</span>
          </Label>
          <Input
            id="request-title"
            type="text"
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="e.g. Spring Campaign Hero Shots"
            autoFocus
          />
          {titleError && (
            <p className="text-xs text-[var(--color-error)]">{titleError}</p>
          )}
        </div>

        {/* Priority toggle */}
        <div className="flex flex-col gap-2">
          <Label>Priority</Label>
          <div className="flex gap-0.5 rounded-md bg-[var(--color-surface-subtle)] p-0.5">
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-all ${
                priority === "normal"
                  ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
                  : "text-[var(--color-text-muted)]"
              }`}
              onClick={() => setPriority("normal")}
            >
              Normal
            </button>
            <button
              type="button"
              className={`flex-1 rounded px-3 py-1.5 text-sm font-medium transition-all ${
                priority === "urgent"
                  ? "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400"
                  : "text-[var(--color-text-muted)]"
              }`}
              onClick={() => setPriority("urgent")}
            >
              Urgent
            </button>
          </div>
        </div>

        {/* Notify */}
        {clientId && (
          <RecipientPicker
            clientId={clientId}
            value={notifyUserIds}
            onChange={(uids) => setNotifyUserIds(uids)}
          />
        )}

        {/* Products */}
        <div className="flex flex-col gap-2">
          <Label>
            Products{" "}
            <span className="text-xs font-normal text-[var(--color-text-muted)]">
              (optional)
            </span>
          </Label>
          <ProductPickerPopover
            selectedIds={relatedFamilyIds}
            onToggle={handleToggleFamily}
          />
        </div>

        {/* Progressive disclosure */}
        <button
          type="button"
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
          onClick={() => setDetailsOpen((prev) => !prev)}
        >
          <ChevronRight
            size={14}
            className={`transition-transform duration-200 ${detailsOpen ? "rotate-90" : ""}`}
          />
          More details
        </button>

        {detailsOpen && (
          <div className="flex flex-col gap-4">
            {/* Description */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="request-description">
                Description{" "}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="request-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the shots needed, creative direction, mood, etc."
              />
            </div>

            {/* Structured References */}
            <div className="flex flex-col gap-2">
              <Label>
                References{" "}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  (optional)
                </span>
              </Label>
              {clientId && (
                <ReferenceInput
                  clientId={clientId}
                  requestId={draftRequestId}
                  references={references}
                  onChange={setReferences}
                />
              )}
            </div>

            {/* Deadline */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="request-deadline">
                Deadline{" "}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  (optional)
                </span>
              </Label>
              <Input
                id="request-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="request-notes">
                Notes{" "}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="request-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for the production team..."
                className="min-h-[60px]"
              />
            </div>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
