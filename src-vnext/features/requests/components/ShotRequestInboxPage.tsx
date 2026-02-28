import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Inbox, Plus } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useIsDesktop } from "@/shared/hooks/useMediaQuery"
import { useShotRequests } from "@/features/requests/hooks/useShotRequests"
import { useShotRequest } from "@/features/requests/hooks/useShotRequest"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { Button } from "@/ui/button"
import { Switch } from "@/ui/switch"
import { Label } from "@/ui/label"
import { cn } from "@/shared/lib/utils"
import { ShotRequestCard } from "./ShotRequestCard"
import { SubmitShotRequestDialog } from "./SubmitShotRequestDialog"
import { TriagePanel } from "./TriagePanel"
import type { ShotRequest, ShotRequestStatus } from "@/shared/types"

type FilterValue = "all" | "submitted" | "triaged" | "done"

const FILTER_OPTIONS: readonly { readonly value: FilterValue; readonly label: string }[] = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "triaged", label: "Triaged" },
  { value: "done", label: "Done" },
]

const DONE_STATUSES: readonly ShotRequestStatus[] = ["absorbed", "rejected"]

function matchesFilter(request: ShotRequest, filter: FilterValue): boolean {
  if (filter === "all") return true
  if (filter === "done") return DONE_STATUSES.includes(request.status)
  return request.status === filter
}

function sortRequests(requests: readonly ShotRequest[]): readonly ShotRequest[] {
  return [...requests].sort((a, b) => {
    if (a.priority === "urgent" && b.priority !== "urgent") return -1
    if (a.priority !== "urgent" && b.priority === "urgent") return 1

    const aMs = a.submittedAt?.toMillis?.() ?? 0
    const bMs = b.submittedAt?.toMillis?.() ?? 0
    return bMs - aMs
  })
}

export default function ShotRequestInboxPage() {
  const { user, clientId } = useAuth()
  const isDesktop = useIsDesktop()
  const { data: allRequests, loading, error } = useShotRequests()
  const { data: projects } = useProjects()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showSubmitDialog, setShowSubmitDialog] = useState(false)

  const filter = (searchParams.get("filter") as FilterValue) ?? "all"
  const selectedRid = searchParams.get("rid")
  const myRequestsOnly = searchParams.get("mine") === "1"

  const { data: selectedRequest } = useShotRequest(
    isDesktop ? selectedRid : null,
    clientId,
  )

  const selectedProjectName = useMemo(() => {
    if (!selectedRequest?.absorbedIntoProjectId) return null
    return projects.find((p) => p.id === selectedRequest.absorbedIntoProjectId)?.name ?? null
  }, [selectedRequest, projects])

  const filteredRequests = useMemo(() => {
    const filtered = allRequests.filter((r) => {
      if (!matchesFilter(r, filter)) return false
      if (myRequestsOnly && r.submittedBy !== user?.uid) return false
      return true
    })
    return sortRequests(filtered)
  }, [allRequests, filter, myRequestsOnly, user?.uid])

  const submittedCount = useMemo(
    () => allRequests.filter((r) => r.status === "submitted").length,
    [allRequests],
  )

  const setFilter = (value: FilterValue) => {
    const next = new URLSearchParams(searchParams)
    next.set("filter", value)
    setSearchParams(next, { replace: true })
  }

  const setSelectedRequest = (rid: string) => {
    const next = new URLSearchParams(searchParams)
    next.set("rid", rid)
    setSearchParams(next, { replace: true })
  }

  const toggleMyRequests = () => {
    const next = new URLSearchParams(searchParams)
    if (myRequestsOnly) {
      next.delete("mine")
    } else {
      next.set("mine", "1")
    }
    setSearchParams(next, { replace: true })
  }

  if (loading) return <LoadingState loading skeleton={<ListPageSkeleton />} />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Inbox"
        actions={
          <div className="flex items-center gap-2">
            {submittedCount > 0 && (
              <span className="text-xs text-[var(--color-text-muted)]">
                {submittedCount} pending
              </span>
            )}
            <Button size="sm" onClick={() => setShowSubmitDialog(true)}>
              <Plus className="h-4 w-4" />
              New Request
            </Button>
          </div>
        }
      />

      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] px-4 py-2">
        <div className="flex items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setFilter(opt.value)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                filter === opt.value
                  ? "bg-[var(--color-surface-inverse)] text-[var(--color-text-inverse)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="my-requests-toggle" className="text-xs text-[var(--color-text-muted)]">
            My Requests
          </Label>
          <Switch
            id="my-requests-toggle"
            checked={myRequestsOnly}
            onCheckedChange={toggleMyRequests}
          />
        </div>
      </div>

      {isDesktop ? (
        <div className="grid grid-cols-[300px_1fr] divide-x divide-[var(--color-border)]">
          <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
            {filteredRequests.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">No requests found</p>
              </div>
            ) : (
              filteredRequests.map((r) => (
                <ShotRequestCard
                  key={r.id}
                  request={r}
                  selected={r.id === selectedRid}
                  onClick={() => setSelectedRequest(r.id)}
                />
              ))
            )}
          </div>

          <div className="max-h-[calc(100vh-200px)] overflow-y-auto">
            {selectedRequest ? (
              <TriagePanel
                request={selectedRequest}
                projectName={selectedProjectName}
              />
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Select a request to view details
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {filteredRequests.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-12 w-12" />}
              title="No requests"
              description="No shot requests match your current filters."
            />
          ) : (
            filteredRequests.map((r) => (
              <ShotRequestCard
                key={r.id}
                request={r}
                selected={false}
                onClick={() => setSelectedRequest(r.id)}
              />
            ))
          )}
        </div>
      )}

      <SubmitShotRequestDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
      />
    </div>
  )
}
