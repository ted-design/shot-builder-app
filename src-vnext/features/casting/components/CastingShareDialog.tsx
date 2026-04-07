import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createCastingShareLink } from "@/features/casting/lib/castingWrites"
import { resolveTalentForCastingShare } from "@/features/casting/lib/resolveTalentForShare"
import type { CastingBoardEntry, CastingShareVisibility } from "@/shared/types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"
import { Checkbox } from "@/ui/checkbox"
import { Separator } from "@/ui/separator"
import { Copy, Link } from "lucide-react"

type ShareScope = "all" | "selected"

interface CastingShareDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly clientId: string
  readonly projectId: string
  readonly projectName: string
  readonly userId: string
  readonly entries: readonly CastingBoardEntry[]
  readonly selectedIds?: ReadonlySet<string>
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const el = document.createElement("textarea")
      el.value = text
      el.style.position = "fixed"
      el.style.left = "-9999px"
      document.body.appendChild(el)
      el.select()
      const ok = document.execCommand("copy")
      el.remove()
      return ok
    } catch {
      return false
    }
  }
}

function formatShareError(err: unknown): string {
  if (!err || typeof err !== "object") return "Unknown error"
  const anyErr = err as { code?: unknown; message?: unknown }
  const code = typeof anyErr.code === "string" ? anyErr.code : null
  const message = typeof anyErr.message === "string" ? anyErr.message : null
  const label = code ? `(${code})` : ""
  if (!message) return label ? `Share failed ${label}` : "Share failed"
  return label ? `${message} ${label}` : message
}

export function CastingShareDialog({
  open,
  onOpenChange,
  clientId,
  projectId,
  projectName,
  userId,
  entries,
  selectedIds,
}: CastingShareDialogProps) {
  const hasSelection = (selectedIds?.size ?? 0) > 0
  const defaultScope: ShareScope = hasSelection ? "selected" : "all"

  const [scope, setScope] = useState<ShareScope>(defaultScope)
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [creating, setCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  // Visibility toggles
  const [showAgency, setShowAgency] = useState(true)
  const [showMeasurements, setShowMeasurements] = useState(true)
  const [showPortfolio, setShowPortfolio] = useState(false)
  const [showCastingNotes, setShowCastingNotes] = useState(false)

  // Reviewer settings
  const [showVoteTallies, setShowVoteTallies] = useState(true)

  // Reset state when dialog opens
  useEffect(() => {
    if (!open) return
    setScope(defaultScope)
    setTitle("")
    setInstructions("")
    setCreating(false)
    setCreatedUrl(null)
    setShowAgency(true)
    setShowMeasurements(true)
    setShowPortfolio(false)
    setShowCastingNotes(false)
    setShowVoteTallies(true)
  }, [defaultScope, open])

  const scopedEntries = useMemo(() => {
    if (scope === "selected" && selectedIds && selectedIds.size > 0) {
      return entries.filter((e) => selectedIds.has(e.id))
    }
    return entries
  }, [entries, scope, selectedIds])

  const defaultTitle = useMemo(() => {
    return `${projectName} \u2014 Casting`
  }, [projectName])

  const shareUrlPreview = createdUrl
    ? createdUrl
    : `${window.location.origin}/casting/shared/\u2026`

  const create = async () => {
    setCreating(true)
    try {
      const visibleFields: CastingShareVisibility = {
        agency: showAgency,
        measurements: showMeasurements,
        portfolio: showPortfolio,
        castingNotes: showCastingNotes,
      }

      const resolvedTalent = await resolveTalentForCastingShare({
        clientId,
        entries: [...scopedEntries],
        visibleFields,
      })

      const shareToken = await createCastingShareLink({
        clientId,
        projectId,
        userId,
        title: (title.trim() || defaultTitle).trim(),
        resolvedTalent,
        visibleFields,
        reviewerInstructions: instructions.trim() || null,
        showVoteTallies,
      })

      const url = `${window.location.origin}/casting/shared/${shareToken}`
      setCreatedUrl(url)
      const copied = await copyToClipboard(url)
      toast.success("Share link created", {
        description: copied ? "Copied to clipboard." : url,
      })
    } catch (err) {
      console.error("[CastingShareDialog] Failed to create share link:", err)
      const description = formatShareError(err)
      toast.error("Failed to create share link", { description })
    } finally {
      setCreating(false)
    }
  }

  const handleCopyUrl = async () => {
    if (!createdUrl) return
    const copied = await copyToClipboard(createdUrl)
    if (copied) {
      toast.success("Copied to clipboard")
    } else {
      toast.error("Failed to copy")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Casting Board</DialogTitle>
          <DialogDescription className="sr-only">
            Create a share link for the casting board so external reviewers can
            vote on talent.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Scope */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Scope</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={scope === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setScope("all")}
              >
                {"All talent (" + entries.length + ")"}
              </Button>
              {hasSelection && (
                <Button
                  type="button"
                  variant={scope === "selected" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScope("selected")}
                >
                  {"Selected (" + (selectedIds?.size ?? 0) + ")"}
                </Button>
              )}
            </div>
          </div>

          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="casting-share-title" className="text-xs">
              Title
            </Label>
            <Input
              id="casting-share-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>

          {/* Instructions */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="casting-share-instructions" className="text-xs">
              Instructions for reviewers
            </Label>
            <Textarea
              id="casting-share-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Add a note for reviewers..."
              className="min-h-[64px]"
            />
            <p className="text-2xs text-[var(--color-text-muted)]">
              Optional. Shown at the top of the review page.
            </p>
          </div>

          <Separator />

          {/* Visible to reviewers */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Visible to reviewers</Label>
            <div className="flex flex-col gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              {/* Always-on fields */}
              <p className="text-2xs text-[var(--color-text-muted)]">
                Headshot and name are always visible.
              </p>

              {/* Agency */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={showAgency}
                  onCheckedChange={(v) => setShowAgency(v === true)}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Agency
                </span>
              </label>

              {/* Measurements */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={showMeasurements}
                  onCheckedChange={(v) => setShowMeasurements(v === true)}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Measurements
                </span>
              </label>

              {/* Portfolio images */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={showPortfolio}
                  onCheckedChange={(v) => setShowPortfolio(v === true)}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Portfolio images
                </span>
              </label>

              {/* Casting notes */}
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={showCastingNotes}
                  onCheckedChange={(v) => setShowCastingNotes(v === true)}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Casting notes
                </span>
              </label>
            </div>
          </div>

          <Separator />

          {/* Reviewer settings */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Reviewer settings</Label>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <Checkbox
                  checked={showVoteTallies}
                  onCheckedChange={(v) => setShowVoteTallies(v === true)}
                />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Allow reviewers to see vote tallies from others
                </span>
              </label>
            </div>
          </div>

          <Separator />

          {/* Link preview */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Link preview</Label>
            <div className="flex items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2">
              <Link className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
              <span className="flex-1 truncate font-mono text-xs text-[var(--color-text-muted)]">
                {shareUrlPreview}
              </span>
              {createdUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={handleCopyUrl}
                >
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              )}
            </div>
            <p className="text-2xs text-[var(--color-text-muted)]">
              Anyone with this link can review and vote.
            </p>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Close
            </Button>
            <Button
              onClick={create}
              disabled={creating || scopedEntries.length === 0}
            >
              {creating ? "Creating\u2026" : "Create Link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
