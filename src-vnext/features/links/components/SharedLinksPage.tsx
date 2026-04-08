import React, { useMemo, useState } from "react"
import { Link2 } from "lucide-react"
import { toast } from "sonner"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { PageHeader } from "@/shared/components/PageHeader"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageCasting } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { useShareLinks } from "@/features/links/hooks/useShareLinks"
import {
  toggleShareLink,
  setShareLinkExpiry,
  deleteShareLink,
} from "@/features/links/lib/shareLinkActions"
import type { ShareLink, ShareLinkType } from "@/features/links/lib/shareLinkTypes"
import { ShareLinkRow } from "./ShareLinkRow"
import { ShareLinkCard } from "./ShareLinkCard"
import { ShareLinkExpandedDetail } from "./ShareLinkExpandedDetail"
import { ShareLinkExpiryDialog } from "./ShareLinkExpiryDialog"
import { ShareLinkStats } from "./ShareLinkStats"

type TypeFilter = "all" | ShareLinkType

const FILTER_OPTIONS: readonly { key: TypeFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "shots", label: "Shots" },
  { key: "casting", label: "Casting" },
  { key: "pull", label: "Pulls" },
]

export default function SharedLinksPage() {
  const { projectId, projectName } = useProjectScope()
  const { clientId, role } = useAuth()

  const isMobile = useIsMobile()
  const canEdit = canManageCasting(role)

  const { links, loading, error } = useShareLinks(projectId, clientId)

  // Local UI state
  const [filter, setFilter] = useState<TypeFilter>("all")
  const [expiryLink, setExpiryLink] = useState<ShareLink | null>(null)
  const [expiryOpen, setExpiryOpen] = useState(false)
  const [deleteLink, setDeleteLink] = useState<ShareLink | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Filter links
  const filtered = useMemo(() => {
    if (filter === "all") return links
    return links.filter((l) => l.type === filter)
  }, [links, filter])

  // Permission gate
  if (!canEdit) {
    return (
      <ErrorBoundary>
        <PageHeader
          title="Shared Links"
          breadcrumbs={[
            { label: "Projects", to: "/projects" },
            { label: projectName || projectId || "Project" },
          ]}
        />
        <EmptyState
          icon={<Link2 className="h-8 w-8" />}
          title="You don't have permission to manage shared links"
        />
      </ErrorBoundary>
    )
  }

  if (loading) {
    return <LoadingState loading skeleton={<ListPageSkeleton />} />
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  // Handlers
  const handleCopy = async (link: ShareLink) => {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + link.url,
      )
      toast.success("Link copied to clipboard")
    } catch {
      toast.error("Failed to copy link")
    }
  }

  const handleOpen = (link: ShareLink) => {
    window.open(window.location.origin + link.url, "_blank", "noopener,noreferrer")
  }

  const handleToggle = async (link: ShareLink) => {
    try {
      await toggleShareLink(link)
      toast.success(link.enabled ? "Link disabled" : "Link enabled")
    } catch (err) {
      toast.error("Failed to toggle link", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleSetExpiry = (link: ShareLink) => {
    setExpiryLink(link)
    setExpiryOpen(true)
  }

  const handleExpirySave = async (link: ShareLink, date: Date | null) => {
    try {
      await setShareLinkExpiry(link, date)
      toast.success(date ? "Expiry date set" : "Expiry cleared")
    } catch (err) {
      toast.error("Failed to update expiry", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleDeleteRequest = (link: ShareLink) => {
    setDeleteLink(link)
    setDeleteOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteLink) return
    try {
      await deleteShareLink(deleteLink)
      toast.success("Share link deleted")
    } catch (err) {
      toast.error("Failed to delete link", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleToggleExpand = (link: ShareLink) => {
    setExpandedId((prev) => (prev === link.id ? null : link.id))
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Shared Links"
        breadcrumbs={[
          { label: "Projects", to: "/projects" },
          { label: projectName || projectId || "Project" },
        ]}
      />

      {links.length === 0 ? (
        <EmptyState
          icon={<Link2 className="h-8 w-8" />}
          title="No shared links"
          description="Share links are created from Shots, Casting, and Pull pages."
        />
      ) : (
        <>
          {/* Filter tabs */}
          <div className="mb-4 flex items-center gap-1">
            {FILTER_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant={filter === opt.key ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>

          {/* Stats bar */}
          <div className="mb-4">
            <ShareLinkStats links={links} />
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Link2 className="h-6 w-6" />}
              title="No matching links"
              description="Try a different filter."
            />
          ) : isMobile ? (
            /* Mobile: card list */
            <div className="flex flex-col gap-3">
              {filtered.map((link) => (
                <ShareLinkCard
                  key={link.id}
                  link={link}
                  canEdit={canEdit}
                  onCopy={handleCopy}
                  onOpen={handleOpen}
                  onToggle={handleToggle}
                  onSetExpiry={handleSetExpiry}
                  onDelete={handleDeleteRequest}
                />
              ))}
            </div>
          ) : (
            /* Desktop: table */
            <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">
                      Type
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">
                      Title
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">
                      Created
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">
                      Status
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">
                      Engagement
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {filtered.map((link) => (
                    <React.Fragment key={link.id}>
                      <ShareLinkRow
                        link={link}
                        canEdit={canEdit}
                        onCopy={handleCopy}
                        onOpen={handleOpen}
                        onToggle={handleToggle}
                        onSetExpiry={handleSetExpiry}
                        onDelete={handleDeleteRequest}
                        isExpanded={expandedId === link.id}
                        onToggleExpand={handleToggleExpand}
                      />
                      {expandedId === link.id && (
                        <ShareLinkExpandedDetail link={link} />
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Expiry dialog */}
      <ShareLinkExpiryDialog
        open={expiryOpen}
        onOpenChange={setExpiryOpen}
        link={expiryLink}
        onSave={handleExpirySave}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Share Link"
        description={`Are you sure you want to delete "${deleteLink?.title ?? ""}"? This will revoke access for anyone who has this link.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteConfirm}
      />
    </ErrorBoundary>
  )
}
