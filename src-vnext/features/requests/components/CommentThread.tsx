import { useCallback, useEffect, useRef, useState } from "react"
import { MessageCircle, Send } from "lucide-react"
import { toast } from "sonner"
import { useRequestComments } from "@/features/requests/hooks/useRequestComments"
import { addRequestComment } from "@/features/requests/lib/requestWrites"
import { formatRelativeTime } from "@/features/requests/lib/formatRelativeTime"

interface CommentAuthor {
  readonly uid: string
  readonly displayName: string | null
}

interface CommentThreadProps {
  readonly clientId: string
  readonly requestId: string
  readonly currentUser: CommentAuthor
}

function AvatarInitial({ name, isSelf }: { readonly name: string; readonly isSelf: boolean }) {
  const initial = name.charAt(0).toUpperCase()
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
        isSelf
          ? "bg-[var(--color-primary)] text-[var(--color-text-inverted)]"
          : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]"
      }`}
    >
      {initial}
    </span>
  )
}

export function CommentThread({ clientId, requestId, currentUser }: CommentThreadProps) {
  const { comments, loading } = useRequestComments(clientId, requestId)
  const [body, setBody] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const justSubmittedRef = useRef(false)

  const isNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return true
    return el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  useEffect(() => {
    if (isNearBottom() || justSubmittedRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      justSubmittedRef.current = false
    }
  }, [comments.length, isNearBottom])

  const handleSubmit = async () => {
    const trimmed = body.trim()
    if (!trimmed) return

    setSubmitting(true)
    justSubmittedRef.current = true
    try {
      await addRequestComment(clientId, requestId, trimmed, currentUser)
      setBody("")
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="label-meta text-[var(--color-text-muted)]">Comments</h3>

      {loading && (
        <p className="text-xs text-[var(--color-text-muted)]">Loading comments...</p>
      )}

      {!loading && comments.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <MessageCircle className="h-6 w-6 text-[var(--color-text-subtle)]" />
          <p className="text-sm text-[var(--color-text-muted)]">
            No comments yet. Start the conversation.
          </p>
        </div>
      )}

      {!loading && comments.length > 0 && (
        <div ref={containerRef} className="flex flex-col gap-3">
          {comments.map((comment) => {
            const isSelf = comment.authorId === currentUser.uid
            return (
              <div
                key={comment.id}
                className={`flex items-start gap-2 rounded-md p-2 ${
                  isSelf
                    ? "bg-[var(--color-surface-subtle)]"
                    : "bg-transparent"
                }`}
              >
                <AvatarInitial name={comment.authorName} isSelf={isSelf} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-medium text-[var(--color-text)]">
                      {comment.authorName}
                    </span>
                    <span className="text-xxs text-[var(--color-text-muted)]">
                      {formatRelativeTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-[var(--color-text)] break-words">
                    {comment.body}
                  </p>
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment..."
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          disabled={submitting}
          aria-label="Add a comment"
        />
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!body.trim() || submitting}
          aria-label="Send comment"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] text-[var(--color-text-inverted)] transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
