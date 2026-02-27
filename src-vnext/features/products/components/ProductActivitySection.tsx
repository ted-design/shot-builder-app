import { useState } from "react"
import type { ProductFamily, ProductComment, ProductSample, ProductDocument } from "@/shared/types"
import { LoadingState } from "@/shared/components/LoadingState"
import { InlineEmpty } from "@/shared/components/InlineEmpty"
import { createProductComment, setProductCommentDeleted } from "@/features/products/lib/productWorkspaceWrites"
import { formatDateTime } from "@/features/products/lib/productDetailHelpers"
import { toast } from "@/shared/hooks/use-toast"
import { Button } from "@/ui/button"
import { Separator } from "@/ui/separator"
import { Textarea } from "@/ui/textarea"
import { cn } from "@/shared/lib/utils"
import { Activity as ActivityIcon, MessageSquare } from "lucide-react"

interface ProductActivitySectionProps {
  readonly family: ProductFamily
  readonly comments: ReadonlyArray<ProductComment>
  readonly commentsLoading: boolean
  readonly commentsError: { message: string } | null
  readonly visibleSamples: ReadonlyArray<ProductSample>
  readonly visibleDocuments: ReadonlyArray<ProductDocument>
  readonly canEdit: boolean
  readonly clientId: string | null
  readonly userId: string | null
  readonly userName: string | null
  readonly userAvatar: string | null
  readonly isFamilyDeleted: boolean
}

export function ProductActivitySection({
  family,
  comments,
  commentsLoading,
  commentsError,
  visibleSamples,
  visibleDocuments,
  canEdit,
  clientId,
  userId,
  userName,
  userAvatar,
  isFamilyDeleted,
}: ProductActivitySectionProps) {
  const [commentDraft, setCommentDraft] = useState("")
  const [commentSaving, setCommentSaving] = useState(false)

  const visibleComments = comments.filter((c) => c.deleted !== true)

  const handlePostComment = async () => {
    if (!clientId || !userId) return
    setCommentSaving(true)
    try {
      await createProductComment({
        clientId,
        familyId: family.id,
        body: commentDraft,
        userId,
        userName,
        userAvatar,
      })
      setCommentDraft("")
      toast({ title: "Posted", description: "Comment added." })
    } catch (err) {
      toast({
        title: "Post failed",
        description: err instanceof Error ? err.message : "Failed to post comment.",
      })
    } finally {
      setCommentSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Activity</h3>
        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
          Discussion and a lightweight timeline of recent changes.
        </p>
      </div>

      {commentsError && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm text-[var(--color-error)]">
          {commentsError.message}
        </div>
      )}

      {/* Comments */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
            <MessageSquare className="h-4 w-4 text-[var(--color-text-muted)]" />
            Comments
          </div>
        </div>

        {canEdit && !isFamilyDeleted && (
          <div className="mt-3 flex flex-col gap-2">
            <Textarea
              value={commentDraft}
              disabled={commentSaving}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder="Leave a note for your team…"
            />
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                onClick={() => setCommentDraft("")}
                disabled={commentSaving || commentDraft.trim().length === 0}
              >
                Clear
              </Button>
              <Button
                type="button"
                size="sm"
                className="h-9"
                disabled={commentSaving || !clientId || commentDraft.trim().length === 0}
                onClick={() => void handlePostComment()}
              >
                Post
              </Button>
            </div>
          </div>
        )}

        <Separator className="my-4" />

        {commentsLoading ? (
          <LoadingState loading />
        ) : visibleComments.length === 0 ? (
          <InlineEmpty
            icon={<MessageSquare className="h-8 w-8" />}
            title="No comments yet"
          />
        ) : (
          <div className="flex flex-col gap-3">
            {comments.map((comment) => {
              const mine = comment.createdBy && userId && comment.createdBy === userId
              const who = comment.createdByName ?? (comment.createdBy ? "Member" : "—")
              const when = formatDateTime(comment.createdAt)
              const deleted = comment.deleted === true
              return (
                <div key={comment.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--color-text-subtle)]">
                        {who} · {when}
                      </div>
                      <div className={cn("mt-1 whitespace-pre-wrap text-sm", deleted ? "text-[var(--color-text-subtle)] italic" : "text-[var(--color-text)]")}>
                        {deleted ? "Deleted" : comment.body}
                      </div>
                    </div>
                    {canEdit && mine && !deleted && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-[var(--color-error)] hover:text-[var(--color-error)]"
                        onClick={() => {
                          if (!clientId) return
                          void setProductCommentDeleted({
                            clientId,
                            familyId: family.id,
                            commentId: comment.id,
                            deleted: true,
                          }).catch((err) => {
                            toast({
                              title: "Delete failed",
                              description: err instanceof Error ? err.message : "Failed to delete comment.",
                            })
                          })
                        }}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text)]">
          <ActivityIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
          Timeline
        </div>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Created/updated metadata plus sample/doc activity. (Full version history is planned separately.)
        </p>

        <div className="mt-3 flex flex-col gap-2 text-sm">
          <TimelineEntry label="Product created" when={formatDateTime(family.createdAt)} />
          {family.updatedAt && family.createdAt && family.updatedAt.toMillis && family.createdAt.toMillis && family.updatedAt.toMillis() !== family.createdAt.toMillis() && (
            <TimelineEntry label="Product updated" when={formatDateTime(family.updatedAt)} />
          )}

          {visibleDocuments.slice(0, 10).map((doc) => (
            <TimelineEntry
              key={`doc-${doc.id}`}
              label="Document uploaded"
              detail={`${doc.name} · ${formatDateTime(doc.createdAt)}`}
            />
          ))}

          {visibleSamples.slice(0, 10).map((s) => (
            <TimelineEntry
              key={`sample-${s.id}`}
              label="Sample updated"
              detail={`${s.type === "pre_production" ? "Pre-production" : s.type === "bulk" ? "Bulk" : "Shoot"} · ${s.status.split("_").join(" ")} · ${formatDateTime(s.updatedAt ?? s.createdAt)}`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineEntry({
  label,
  when,
  detail,
}: {
  readonly label: string
  readonly when?: string
  readonly detail?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] p-3">
      <div className="min-w-0">
        <div className="font-medium text-[var(--color-text)]">{label}</div>
        <div className="text-xs text-[var(--color-text-muted)]">{detail ?? when}</div>
      </div>
    </div>
  )
}
