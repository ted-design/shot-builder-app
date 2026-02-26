import { useState } from "react"
import { ChevronDown, ChevronUp, Users, User } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/ui/avatar"
import { useEntityPresence } from "@/features/shots/hooks/useEntityPresence"
import { formatFieldNames, type ActiveEditor } from "@/shared/types/presence"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0] ?? "")
    .join("")
    .toUpperCase()
}

// ---------------------------------------------------------------------------
// Stacked avatars (shared between full + compact)
// ---------------------------------------------------------------------------

function StackedAvatars({
  editors,
  size = "sm",
}: {
  readonly editors: readonly ActiveEditor[]
  readonly size?: "sm" | "xs"
}) {
  const dim = size === "sm" ? "h-6 w-6" : "h-5 w-5"
  const overlap = size === "sm" ? "-space-x-2" : "-space-x-1.5"

  return (
    <div className={`flex ${overlap}`}>
      {editors.slice(0, 3).map((editor, i) => (
        <Avatar
          key={editor.userId}
          className={`${dim} border-2 border-[var(--color-surface)]`}
          style={{ zIndex: 3 - i }}
        >
          {editor.userAvatar ? (
            <AvatarImage src={editor.userAvatar} alt={editor.userName} />
          ) : null}
          <AvatarFallback className="bg-blue-100 text-blue-700 text-3xs">
            {editor.userName ? initials(editor.userName) : <User className="h-3 w-3" />}
          </AvatarFallback>
        </Avatar>
      ))}
      {editors.length > 3 && (
        <div
          className={`${dim} rounded-full border-2 border-[var(--color-surface)] bg-blue-100 flex items-center justify-center text-3xs font-medium text-blue-700`}
        >
          +{editors.length - 3}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ActiveEditorsBar (full, expandable)
// ---------------------------------------------------------------------------

interface ActiveEditorsBarProps {
  readonly clientId: string | null
  readonly entityType: string
  readonly entityId: string | undefined
  readonly enabled?: boolean
}

export function ActiveEditorsBar({
  clientId,
  entityType,
  entityId,
  enabled = true,
}: ActiveEditorsBarProps) {
  const [expanded, setExpanded] = useState(false)
  const { activeEditors, isLoading, hasActiveEditors } = useEntityPresence(
    clientId,
    entityType,
    entityId,
    { enabled, excludeSelf: true },
  )

  if (!hasActiveEditors || isLoading) return null

  return (
    <div
      className="border-b border-blue-200 bg-blue-50"
      data-testid="active-editors-bar"
    >
      {/* Collapsed summary */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 transition-colors hover:bg-blue-100"
      >
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <StackedAvatars editors={activeEditors} />
          <span className="text-sm text-blue-700">
            {activeEditors.length === 1 ? (
              <>
                <span className="font-medium">{activeEditors[0].userName}</span>
                {" is editing"}
              </>
            ) : (
              <>
                <span className="font-medium">{activeEditors.length} people</span>
                {" are editing"}
              </>
            )}
          </span>
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-blue-500" />
        ) : (
          <ChevronDown className="h-4 w-4 text-blue-500" />
        )}
      </button>

      {/* Expanded per-editor detail */}
      {expanded && (
        <div className="space-y-2 px-4 pb-3 pt-1">
          {activeEditors.map((editor) => (
            <div key={editor.userId} className="flex items-center gap-2 text-sm">
              <Avatar className="h-5 w-5">
                {editor.userAvatar ? (
                  <AvatarImage src={editor.userAvatar} alt={editor.userName} />
                ) : null}
                <AvatarFallback className="bg-blue-100 text-blue-700 text-3xs">
                  {editor.userName ? initials(editor.userName) : <User className="h-3 w-3" />}
                </AvatarFallback>
              </Avatar>
              <span className="text-[var(--color-text-secondary)]">
                <span className="font-medium">{editor.userName}</span>
                <span className="text-[var(--color-text-muted)]">
                  {" is editing "}
                  {formatFieldNames(editor.fields)}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompactActiveEditors (avatar dots + ping indicator)
// ---------------------------------------------------------------------------

interface CompactActiveEditorsProps {
  readonly clientId: string | null
  readonly entityType: string
  readonly entityId: string | undefined
  readonly enabled?: boolean
}

export function CompactActiveEditors({
  clientId,
  entityType,
  entityId,
  enabled = true,
}: CompactActiveEditorsProps) {
  const { activeEditors, hasActiveEditors } = useEntityPresence(
    clientId,
    entityType,
    entityId,
    { enabled, excludeSelf: true },
  )

  if (!hasActiveEditors) return null

  const summary =
    activeEditors.length === 1
      ? `${activeEditors[0].userName} is editing ${formatFieldNames(activeEditors[0].fields)}`
      : `${activeEditors.length} people are editing`

  return (
    <div
      className="inline-flex items-center gap-1"
      title={summary}
      data-testid="compact-active-editors"
    >
      <StackedAvatars editors={activeEditors} size="xs" />
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
      </span>
    </div>
  )
}
