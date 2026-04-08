import { ChevronDown, ChevronRight, Clock, Copy, ExternalLink, Eye, EyeOff, Trash2 } from "lucide-react"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import type { ShareLink } from "@/features/links/lib/shareLinkTypes"

interface ShareLinkRowProps {
  readonly link: ShareLink
  readonly canEdit: boolean
  readonly onCopy: (link: ShareLink) => void
  readonly onOpen: (link: ShareLink) => void
  readonly onToggle: (link: ShareLink) => void
  readonly onSetExpiry: (link: ShareLink) => void
  readonly onDelete: (link: ShareLink) => void
  readonly isExpanded: boolean
  readonly onToggleExpand: (link: ShareLink) => void
}

const TYPE_STYLES: Record<ShareLink["type"], { label: string; className: string }> = {
  shots: {
    label: "Shots",
    className:
      "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)] border border-[var(--color-status-blue-border)]",
  },
  casting: {
    label: "Casting",
    className:
      "bg-[var(--color-status-purple-bg)] text-[var(--color-status-purple-text)] border border-[var(--color-status-purple-border)]",
  },
  pull: {
    label: "Pull",
    className:
      "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)] border border-[var(--color-status-amber-border)]",
  },
}

const STATUS_STYLES: Record<ShareLink["status"], { label: string; className: string }> = {
  active: {
    label: "Active",
    className:
      "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)] border border-[var(--color-status-green-border)]",
  },
  disabled: {
    label: "Disabled",
    className:
      "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)] border border-[var(--color-status-gray-border)]",
  },
  expired: {
    label: "Expired",
    className:
      "bg-[var(--color-status-red-bg)] text-[var(--color-status-red-text)] border border-[var(--color-status-red-border)]",
  },
}

function formatRelativeDate(date: Date | null): string {
  if (!date) return "--"
  const now = Date.now()
  const diffMs = now - date.getTime()
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffDays < 0) return formatAbsoluteDate(date)
  if (diffDays === 0) return "Today"
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 30) return `${diffDays}d ago`
  return formatAbsoluteDate(date)
}

function formatAbsoluteDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatEngagement(link: ShareLink): string {
  const { type, engagement, contentCount } = link

  if (type === "casting") {
    const voteStr =
      engagement !== null
        ? `${engagement} vote${engagement === 1 ? "" : "s"}`
        : null
    const talentStr =
      contentCount !== null ? `${contentCount} talent` : null

    if (voteStr !== null && talentStr !== null) {
      return `${voteStr} · ${talentStr}`
    }
    if (voteStr !== null) return voteStr
    if (talentStr !== null) return talentStr
    return "--"
  }

  if (type === "shots") {
    return contentCount !== null ? `${contentCount} shot${contentCount === 1 ? "" : "s"}` : "--"
  }

  if (type === "pull") {
    return contentCount !== null ? `${contentCount} item${contentCount === 1 ? "" : "s"}` : "--"
  }

  return "--"
}

export { TYPE_STYLES, STATUS_STYLES, formatRelativeDate, formatEngagement }

export function ShareLinkRow({
  link,
  canEdit,
  onCopy,
  onOpen,
  onToggle,
  onSetExpiry,
  onDelete,
  isExpanded,
  onToggleExpand,
}: ShareLinkRowProps) {
  const { user } = useAuth()
  const isInactive = link.status === "disabled" || link.status === "expired"
  const typeStyle = TYPE_STYLES[link.type]
  const statusStyle = STATUS_STYLES[link.status]

  const isCreator = user?.uid != null && link.createdBy === user.uid
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

  return (
    <tr className={isInactive ? "opacity-60" : undefined}>
      {/* Expand toggle + Type */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onToggleExpand(link)}
            aria-label={isExpanded ? "Collapse row" : "Expand row"}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <ChevronIcon className="h-3.5 w-3.5" />
          </button>
          <span
            className={`inline-block rounded px-2 py-0.5 text-2xs font-medium ${typeStyle.className}`}
          >
            {typeStyle.label}
          </span>
        </div>
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <div className="min-w-0">
          <div className="truncate text-sm text-[var(--color-text)]">
            {link.title}
          </div>
          <div className="truncate text-2xs text-[var(--color-text-subtle)]">
            {link.url}
          </div>
        </div>
      </td>

      {/* Created */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        <span>{formatRelativeDate(link.createdAt)}</span>
        {isCreator && (
          <span className="ml-1 text-2xs text-[var(--color-text-subtle)]">
            by you
          </span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded px-2 py-0.5 text-2xs font-medium ${statusStyle.className}`}
        >
          {statusStyle.label}
        </span>
      </td>

      {/* Engagement */}
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {formatEngagement(link)}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpen(link)}
            aria-label="Open in new tab"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCopy(link)}
            aria-label="Copy link"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          {canEdit && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onToggle(link)}
                aria-label={link.enabled ? "Disable link" : "Enable link"}
              >
                {link.enabled ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onSetExpiry(link)}
                aria-label="Set expiry"
              >
                <Clock className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-[var(--color-error)]"
                onClick={() => onDelete(link)}
                aria-label="Delete link"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}
