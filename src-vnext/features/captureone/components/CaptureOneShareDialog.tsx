import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { createCaptureOneShareLink } from "@/features/captureone/lib/captureOneShareWrites"
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
import { Copy, Link } from "lucide-react"

type ShareScope = "all" | "selected"

interface CaptureOneShareDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly clientId: string | null
  readonly projectId: string
  readonly projectName: string
  readonly userId: string
  readonly selectedShotIds?: readonly string[]
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

export function CaptureOneShareDialog({
  open,
  onOpenChange,
  clientId,
  projectId,
  projectName,
  userId,
  selectedShotIds,
}: CaptureOneShareDialogProps) {
  const selectionCount = selectedShotIds?.length ?? 0
  const hasSelection = selectionCount > 0
  const defaultScope: ShareScope = hasSelection ? "selected" : "all"

  const [scope, setScope] = useState<ShareScope>(defaultScope)
  const [title, setTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setScope(defaultScope)
    setTitle("")
    setCreating(false)
    setCreatedUrl(null)
  }, [defaultScope, open])

  const defaultTitle = useMemo(() => `${projectName} — Capture One names`, [projectName])

  const shareUrlPreview = createdUrl
    ? createdUrl
    : `${window.location.origin}/captureone/shared/…`

  const create = async () => {
    if (!clientId) {
      toast.error("Failed to create share link", { description: "Missing clientId." })
      return
    }
    setCreating(true)
    try {
      const shotIds = scope === "selected" && selectedShotIds ? [...selectedShotIds] : null
      const shareToken = await createCaptureOneShareLink({
        clientId,
        projectId,
        userId,
        title: (title.trim() || defaultTitle).trim(),
        shotIds,
      })
      const url = `${window.location.origin}/captureone/shared/${shareToken}`
      setCreatedUrl(url)
      const copied = await copyToClipboard(url)
      toast.success("Share link created", { description: copied ? "Copied to clipboard." : url })
    } catch (err) {
      console.error("[CaptureOneShareDialog] Failed to create share link:", err)
      toast.error("Failed to create share link", { description: formatShareError(err) })
    } finally {
      setCreating(false)
    }
  }

  const handleCopyUrl = async () => {
    if (!createdUrl) return
    const copied = await copyToClipboard(createdUrl)
    if (copied) toast.success("Copied to clipboard")
    else toast.error("Failed to copy")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share Capture One names</DialogTitle>
          <DialogDescription className="sr-only">
            Create a no-login link to the generated Capture One filenames for the digi-tech.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Scope</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={scope === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setScope("all")}
              >
                All project shots
              </Button>
              {hasSelection && (
                <Button
                  type="button"
                  variant={scope === "selected" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScope("selected")}
                >
                  {"Selected (" + selectionCount + ")"}
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="captureone-share-title" className="text-xs">
              Title
            </Label>
            <Input
              id="captureone-share-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Link preview</Label>
            <div className="flex items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2">
              <Link className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
              <span className="flex-1 truncate font-mono text-xs text-[var(--color-text-muted)]">
                {shareUrlPreview}
              </span>
              {createdUrl && (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={handleCopyUrl}>
                  <Copy className="mr-1 h-3 w-3" />
                  Copy
                </Button>
              )}
            </div>
            <p className="text-2xs text-[var(--color-text-muted)]">
              Anyone with this link can view the filenames. No login required.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              Close
            </Button>
            <Button onClick={create} disabled={creating}>
              {creating ? "Creating…" : "Create Link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
