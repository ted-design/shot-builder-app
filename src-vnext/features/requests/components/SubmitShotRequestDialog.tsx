import { useState, useEffect } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { ChevronRight, Plus, X } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { submitShotRequest } from "@/features/requests/lib/requestWrites"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import type { ShotRequestPriority } from "@/shared/types"

const titleSchema = z.string().min(1, "Title is required")

interface SubmitShotRequestDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function SubmitShotRequestDialog({
  open,
  onOpenChange,
}: SubmitShotRequestDialogProps) {
  const { user, clientId } = useAuth()

  const [title, setTitle] = useState("")
  const [priority, setPriority] = useState<ShotRequestPriority>("normal")
  const [description, setDescription] = useState("")
  const [referenceUrls, setReferenceUrls] = useState<readonly string[]>([""])
  const [deadline, setDeadline] = useState("")
  const [notes, setNotes] = useState("")
  const [titleError, setTitleError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle("")
      setPriority("normal")
      setDescription("")
      setReferenceUrls([""])
      setDeadline("")
      setNotes("")
      setTitleError(null)
      setSaving(false)
      setDetailsOpen(false)
    }
  }, [open])

  const handleTitleChange = (value: string) => {
    setTitle(value)
    setTitleError(null)
  }

  const handleUrlChange = (index: number, value: string) => {
    setReferenceUrls((prev) =>
      prev.map((url, i) => (i === index ? value : url)),
    )
  }

  const handleAddUrl = () => {
    setReferenceUrls((prev) => [...prev, ""])
  }

  const handleRemoveUrl = (index: number) => {
    setReferenceUrls((prev) => prev.filter((_, i) => i !== index))
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
      const filteredUrls = referenceUrls.filter((u) => u.trim().length > 0)

      await submitShotRequest({
        clientId,
        title: result.data,
        priority,
        description: description.trim() || null,
        referenceUrls: filteredUrls.length > 0 ? filteredUrls : null,
        deadline: deadline || null,
        notes: notes.trim() || null,
        submittedBy: user.uid,
        submittedByName: user.displayName ?? null,
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
          <Button onClick={handleSubmit} disabled={!canSubmit}>
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

            {/* Reference URLs */}
            <div className="flex flex-col gap-2">
              <Label>
                Reference URLs{" "}
                <span className="text-xs font-normal text-[var(--color-text-muted)]">
                  (optional)
                </span>
              </Label>
              <div className="flex flex-col gap-2">
                {referenceUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      type="url"
                      value={url}
                      onChange={(e) => handleUrlChange(index, e.target.value)}
                      placeholder="https://..."
                      className="flex-1"
                    />
                    {referenceUrls.length > 1 && (
                      <button
                        type="button"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-[var(--color-text-subtle)] transition-colors hover:bg-red-50 hover:text-[var(--color-error)]"
                        onClick={() => handleRemoveUrl(index)}
                        aria-label="Remove URL"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="flex items-center gap-1 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
                  onClick={handleAddUrl}
                >
                  <Plus size={14} />
                  Add another URL
                </button>
              </div>
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
