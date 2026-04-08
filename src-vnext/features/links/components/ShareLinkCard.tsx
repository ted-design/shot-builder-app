import { Copy, ExternalLink, MoreVertical, Eye, EyeOff, Clock, Trash2 } from "lucide-react"
import { Button } from "@/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import type { ShareLink } from "@/features/links/lib/shareLinkTypes"
import { TYPE_STYLES, STATUS_STYLES, formatRelativeDate, formatEngagement } from "./ShareLinkRow"

interface ShareLinkCardProps {
  readonly link: ShareLink
  readonly canEdit: boolean
  readonly onCopy: (link: ShareLink) => void
  readonly onOpen: (link: ShareLink) => void
  readonly onToggle: (link: ShareLink) => void
  readonly onSetExpiry: (link: ShareLink) => void
  readonly onDelete: (link: ShareLink) => void
}

export function ShareLinkCard({
  link,
  canEdit,
  onCopy,
  onOpen,
  onToggle,
  onSetExpiry,
  onDelete,
}: ShareLinkCardProps) {
  const isInactive = link.status === "disabled" || link.status === "expired"
  const typeStyle = TYPE_STYLES[link.type]
  const statusStyle = STATUS_STYLES[link.status]

  return (
    <div
      className={`rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 ${
        isInactive ? "opacity-60" : ""
      }`}
    >
      {/* Row 1: Type + Status badges */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-block rounded px-2 py-0.5 text-2xs font-medium ${typeStyle.className}`}>
          {typeStyle.label}
        </span>
        <span className={`inline-block rounded px-2 py-0.5 text-2xs font-medium ${statusStyle.className}`}>
          {statusStyle.label}
        </span>
      </div>

      {/* Row 2: Title */}
      <p className="mb-0.5 truncate text-sm font-medium text-[var(--color-text)]">
        {link.title}
      </p>

      {/* Row 3: Meta */}
      <p className="mb-3 text-2xs text-[var(--color-text-muted)]">
        {formatRelativeDate(link.createdAt)}
        <span className="mx-1.5 text-[var(--color-text-subtle)]">&middot;</span>
        {formatEngagement(link)}
      </p>

      {/* Row 4: Actions */}
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 flex-1"
          onClick={() => onCopy(link)}
        >
          <Copy className="h-3.5 w-3.5" />
          Copy
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 flex-1"
          onClick={() => onOpen(link)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Open
        </Button>

        {canEdit && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onToggle(link)}>
                {link.enabled ? (
                  <>
                    <EyeOff className="mr-2 h-3.5 w-3.5" />
                    Disable link
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-3.5 w-3.5" />
                    Enable link
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onSetExpiry(link)}>
                <Clock className="mr-2 h-3.5 w-3.5" />
                Set expiry
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--color-error)]"
                onClick={() => onDelete(link)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
