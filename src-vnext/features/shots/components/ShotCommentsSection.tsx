import { useMemo, useState } from "react"
import type { Timestamp } from "firebase/firestore"
import { MessageSquare } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { canManageShots } from "@/shared/lib/rbac"
import { useShotComments } from "@/features/shots/hooks/useShotComments"
import {
  createShotComment,
  setShotCommentDeleted,
} from "@/features/shots/lib/shotCommentWrites"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { Button } from "@/ui/button"
import { Textarea } from "@/ui/textarea"

function formatDateTime(ts: Timestamp | undefined | null): string {
  if (!ts) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    }).format(ts.toDate())
  } catch {
    return "—"
  }
}

function initials(name: string | null | undefined): string {
  const cleaned = (name ?? "").trim()
  if (!cleaned) return "?"
  const parts = cleaned.split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return (first + last).toUpperCase()
}

export function ShotCommentsSection({
  shotId,
  canComment,
}: {
  readonly shotId: string
  readonly canComment: boolean
}) {
  const { clientId, role, user } = useAuth()
  const { data: comments, loading, error } = useShotComments(shotId)
  const [draft, setDraft] = useState("")
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const writeEnabled = useMemo(() => {
    if (!canComment) return false
    if (!clientId) return false
    if (!user?.uid) return false
    return canManageShots(role)
  }, [canComment, clientId, role, user?.uid])

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <MessageSquare className="h-4 w-4 text-[var(--color-text-muted)]" />
          Comments
        </div>
        {!writeEnabled && (
          <span className="text-xs text-[var(--color-text-subtle)]">Read-only</span>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
          {error.message}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3">
        {writeEnabled && (
          <div className="flex flex-col gap-2">
            <Textarea
              value={draft}
              disabled={saving}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Leave a note for your team…"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-[var(--color-text-muted)]">Max 2000 characters</span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9"
                  onClick={() => setDraft("")}
                  disabled={saving || draft.trim().length === 0}
                >
                  Clear
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  disabled={saving || draft.trim().length === 0}
                  onClick={async () => {
                    if (!clientId || !user?.uid) return
                    setSaving(true)
                    try {
                      await createShotComment({
                        clientId,
                        shotId,
                        body: draft,
                        userId: user.uid,
                        userName: user.displayName ?? user.email ?? null,
                        userAvatar: user.photoURL ?? null,
                      })
                      setDraft("")
                    } catch (err) {
                      toast.error(
                        err instanceof Error ? err.message : "Failed to create comment.",
                      )
                    } finally {
                      setSaving(false)
                    }
                  }}
                >
                  Post
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {loading && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-muted)]">
              Loading comments…
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-muted)]">
              No comments yet.
            </div>
          )}

          {comments.map((comment) => {
            const mine = Boolean(user?.uid && comment.createdBy === user.uid)
            const deleted = Boolean(comment.deleted)
            const author = comment.createdByName ?? "Unknown"
            const when = formatDateTime(comment.createdAt)

            return (
              <div
                key={comment.id}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <Avatar className="mt-0.5 h-7 w-7">
                      <AvatarImage
                        src={comment.createdByAvatar ?? undefined}
                        alt={author}
                      />
                      <AvatarFallback>{initials(comment.createdByName)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-[var(--color-text)]">
                          {author}
                        </span>
                        <span className="text-xs text-[var(--color-text-muted)]">
                          {when}
                        </span>
                      </div>
                      <div className="mt-1 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                        {deleted ? "Deleted comment" : comment.body}
                      </div>
                    </div>
                  </div>

                  {writeEnabled && mine && !deleted && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-[var(--color-error)] hover:text-[var(--color-error)]"
                      onClick={() => setDeleteId(comment.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null)
        }}
        title="Delete comment?"
        description="This hides the comment for everyone. You can’t undo this action."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          if (!clientId || !deleteId) return
          void setShotCommentDeleted({
            clientId,
            shotId,
            commentId: deleteId,
            deleted: true,
          }).catch((err) => {
            toast.error(err instanceof Error ? err.message : "Failed to delete comment.")
          })
        }}
      />
    </div>
  )
}
