import { useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useShots } from "@/features/shots/hooks/useShots"
import { ShotCard } from "@/features/shots/components/ShotCard"
import { DraggableShotList } from "@/features/shots/components/DraggableShotList"
import { ShotReorderControls } from "@/features/shots/components/ShotReorderControls"
import { CreateShotDialog } from "@/features/shots/components/CreateShotDialog"
import { useAuth } from "@/app/providers/AuthProvider"
import { canManageShots } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Camera, Plus, Info } from "lucide-react"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"

type SortKey = "custom" | "name" | "date" | "status" | "created"

const SORT_LABELS: Record<SortKey, string> = {
  custom: "Custom Order",
  name: "Name",
  date: "Date",
  status: "Status",
  created: "Created",
}

function sortShots(shots: ReadonlyArray<Shot>, key: SortKey): ReadonlyArray<Shot> {
  if (key === "custom") return shots
  const sorted = [...shots]
  switch (key) {
    case "name":
      return sorted.sort((a, b) => a.title.localeCompare(b.title))
    case "date":
      return sorted.sort((a, b) => {
        const aMs = a.date?.toMillis() ?? 0
        const bMs = b.date?.toMillis() ?? 0
        return aMs - bMs
      })
    case "status":
      return sorted.sort((a, b) => a.status.localeCompare(b.status))
    case "created":
      return sorted.sort((a, b) => {
        const aMs = a.createdAt?.toMillis() ?? 0
        const bMs = b.createdAt?.toMillis() ?? 0
        return aMs - bMs
      })
    default:
      return shots
  }
}

function filterByStatus(
  shots: ReadonlyArray<Shot>,
  status: ShotFirestoreStatus | null,
): ReadonlyArray<Shot> {
  if (!status) return shots
  return shots.filter((s) => s.status === status)
}

export default function ShotListPage() {
  const { data: shots, loading, error } = useShots()
  const { role } = useAuth()
  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileOptimistic, setMobileOptimistic] = useState<ReadonlyArray<Shot> | null>(null)

  const showCreate = canManageShots(role)
  const canReorder = canManageShots(role)

  const sortKey = (searchParams.get("sort") as SortKey) || "custom"
  const statusFilter = searchParams.get("status") as ShotFirestoreStatus | null
  const isCustomSort = sortKey === "custom"

  const setSortKey = (key: SortKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === "custom") {
      next.delete("sort")
    } else {
      next.set("sort", key)
    }
    setSearchParams(next, { replace: true })
  }

  const setStatusFilter = (status: ShotFirestoreStatus | null) => {
    const next = new URLSearchParams(searchParams)
    if (!status) {
      next.delete("status")
    } else {
      next.set("status", status)
    }
    setSearchParams(next, { replace: true })
  }

  const displayShots = useMemo(() => {
    const base = mobileOptimistic ?? shots
    const filtered = filterByStatus(base, statusFilter)
    return sortShots(filtered, sortKey)
  }, [shots, mobileOptimistic, sortKey, statusFilter])

  if (loading) return <LoadingState loading />
  if (error) {
    return (
      <div className="p-8 text-center">
        {error.isMissingIndex ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-[var(--color-text-muted)]">
              {error.message}
            </p>
            {import.meta.env.DEV && error.indexUrl && (
              <a
                href={error.indexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-text-subtle)] underline"
              >
                Create index in Firebase Console
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-error)]">{error.message}</p>
        )}
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Shots"
        actions={
          showCreate ? (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Shot
            </Button>
          ) : undefined
        }
      />

      {/* Toolbar: sort + status filter */}
      {shots.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {SORT_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-1">
            {statusFilter ? (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setStatusFilter(null)}
              >
                {statusFilter} &times;
              </Badge>
            ) : (
              (["todo", "in_progress", "complete", "on_hold"] as const).map((s) => (
                <Badge
                  key={s}
                  variant="outline"
                  className="cursor-pointer text-xs"
                  onClick={() => setStatusFilter(s)}
                >
                  {s.replace("_", " ")}
                </Badge>
              ))
            )}
          </div>
        </div>
      )}

      {/* Sort override banner */}
      {!isCustomSort && shots.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Sorted by {SORT_LABELS[sortKey]} — custom order is overridden.{" "}
            <button
              className="underline hover:text-[var(--color-text)]"
              onClick={() => setSortKey("custom")}
            >
              Restore custom order
            </button>
          </span>
        </div>
      )}

      {shots.length === 0 ? (
        <EmptyState
          icon={<Camera className="h-12 w-12" />}
          title="No shots yet"
          description="Create your first shot to start building your project."
          actionLabel={showCreate ? "Create Shot" : undefined}
          onAction={showCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : isMobile ? (
        /* Mobile: card list with up/down controls when custom sort */
        <div className="grid gap-4">
          {displayShots.map((shot, index) => (
            <div key={shot.id} className="flex items-start gap-2">
              {isCustomSort && canReorder && (
                <ShotReorderControls
                  shot={shot}
                  shots={displayShots}
                  index={index}
                  onOptimisticReorder={setMobileOptimistic}
                  onReorderComplete={() => setMobileOptimistic(null)}
                />
              )}
              <div className="flex-1">
                <ShotCard shot={shot} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop: draggable when custom sort, plain grid otherwise */
        <DraggableShotList
          shots={displayShots}
          disabled={!isCustomSort || !canReorder}
        />
      )}

      {showCreate && (
        <CreateShotDialog open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </ErrorBoundary>
  )
}
