import { useEffect, useMemo, useState } from "react"
import { httpsCallable } from "firebase/functions"
import { doc, serverTimestamp, setDoc } from "firebase/firestore"
import { db, functions } from "@/shared/lib/firebase"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Separator } from "@/ui/separator"
import { toast } from "sonner"
import type { AuthUser } from "@/shared/types"

type ShareScope = "project" | "selected"

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

function generateShareToken(): string {
  try {
    const token = globalThis.crypto?.randomUUID?.()
    if (token && token.length >= 10) return token
  } catch {
    // ignore
  }
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function getErrorCode(err: unknown): string | null {
  if (!err || typeof err !== "object") return null
  const code = (err as { code?: unknown }).code
  return typeof code === "string" ? code : null
}

function shouldFallbackToFirestore(err: unknown): boolean {
  const code = getErrorCode(err)
  if (!code) return false
  return (
    code === "functions/not-found" ||
    code === "not-found" ||
    code === "functions/unimplemented" ||
    code === "unimplemented" ||
    code === "functions/internal" ||
    code === "internal"
  )
}

export function ShotsShareDialog({
  open,
  onOpenChange,
  clientId,
  projectId,
  projectName,
  user,
  selectedShotIds,
}: {
  readonly open: boolean
  readonly onOpenChange: (next: boolean) => void
  readonly clientId: string | null
  readonly projectId: string
  readonly projectName: string
  readonly user: AuthUser | null
  readonly selectedShotIds: readonly string[]
}) {
  const hasSelection = selectedShotIds.length > 0
  const defaultScope: ShareScope = hasSelection ? "selected" : "project"

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

  const defaultTitle = useMemo(() => {
    if (scope === "selected") return `${projectName} — Selected shots`
    return `${projectName} — Shots`
  }, [projectName, scope])

  const shareUrl = createdUrl
    ? createdUrl
    : (() => {
        const tokenPreview = "…"
        return `${window.location.origin}/shots/shared/${tokenPreview}`
      })()

  const create = async () => {
    if (!clientId) {
      toast.error("Share failed", { description: "Missing clientId." })
      return
    }
    setCreating(true)
    try {
      const payload = {
        projectId,
        scope,
        shotIds: scope === "selected" ? selectedShotIds : null,
        title: (title.trim() || defaultTitle).trim(),
      }
      let shareToken: string
      try {
        const callable = httpsCallable(functions, "createShotShareLink")
        const res = await callable(payload)
        const callableToken = (res.data as { shareToken?: unknown } | null)?.shareToken
        if (typeof callableToken !== "string" || callableToken.trim().length < 10) {
          throw new Error("Invalid share response")
        }
        shareToken = callableToken
      } catch (callableErr) {
        if (!shouldFallbackToFirestore(callableErr)) {
          throw callableErr
        }
        console.warn("[ShotsShareDialog] createShotShareLink unavailable, using Firestore fallback")
        const fallbackToken = generateShareToken()
        await setDoc(doc(db, "shotShares", fallbackToken), {
          clientId,
          projectId: projectId.trim(),
          shotIds: scope === "selected" ? selectedShotIds : null,
          enabled: true,
          title: (title.trim() || defaultTitle).trim(),
          expiresAt: null,
          createdAt: serverTimestamp(),
          createdBy: user?.uid ?? null,
        })
        shareToken = fallbackToken
      }

      const url = `${window.location.origin}/shots/shared/${shareToken}`
      setCreatedUrl(url)
      const copied = await copyToClipboard(url)
      toast.success("Share link created", { description: copied ? "Copied to clipboard." : url })
    } catch (err) {
      console.error("[ShotsShareDialog] Failed to create share link:", err)
      const description = formatShareError(err)
      toast.error("Failed to create share link", { description })
    } finally {
      setCreating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share shots</DialogTitle>
          <DialogDescription className="sr-only">
            Create a share link for project shots or the current selection.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Scope</Label>
            <div className="flex flex-col gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={scope === "project" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setScope("project")}
                >
                  All project shots
                </Button>
                <Button
                  type="button"
                  variant={scope === "selected" ? "default" : "outline"}
                  size="sm"
                  disabled={!hasSelection}
                  onClick={() => setScope("selected")}
                >
                  Selected shots ({selectedShotIds.length})
                </Button>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                {scope === "project"
                  ? "Live view of the project’s shots (updates as shots change)."
                  : "Shares only the currently selected shots."}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="share-title" className="text-xs">
              Title (optional)
            </Label>
            <Input
              id="share-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={defaultTitle}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <Label className="text-xs">Link</Label>
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
              {shareUrl}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
              Close
            </Button>
            <Button onClick={create} disabled={creating || (scope === "selected" && !hasSelection)}>
              {creating ? "Creating…" : "Create link"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
