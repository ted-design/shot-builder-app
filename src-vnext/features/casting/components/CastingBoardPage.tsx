import { useMemo, useState } from "react"
import { Plus, Share2, Users } from "lucide-react"
import { toast } from "sonner"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { EmptyState } from "@/shared/components/EmptyState"
import { PageHeader } from "@/shared/components/PageHeader"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useAuth } from "@/app/providers/AuthProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { EffectiveRoleChip } from "@/shared/components/EffectiveRoleChip"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { useCastingBoard } from "@/features/casting/hooks/useCastingBoard"
import { useTalentLibrary } from "@/features/library/hooks/useTalentLibrary"
import { canManageCasting } from "@/shared/lib/rbac"
import {
  addTalentToCastingBoard,
  updateCastingEntry,
  bookCastingTalent,
  removeTalentFromCastingBoard,
  bulkUpdateCastingStatus,
} from "@/features/casting/lib/castingWrites"
import { CASTING_STATUS_MAP } from "@/features/casting/lib/castingStatuses"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { CastingCard } from "@/features/casting/components/CastingCard"
import { AdminTalentDetailSheet } from "@/features/casting/components/AdminTalentDetailSheet"
import { AddCastingTalentDialog } from "@/features/casting/components/AddCastingTalentDialog"
import { CastingShareDialog } from "@/features/casting/components/CastingShareDialog"
import { useCastingVoteAggregates } from "@/features/casting/hooks/useCastingVoteAggregates"
import type { CastingBoardStatus, TalentRecord } from "@/shared/types"

type StatusFilter = "all" | CastingBoardStatus
type SortKey = "name" | "agency" | "status"

export default function CastingBoardPage() {
  const { projectId, projectName } = useProjectScope()
  const { clientId, role: globalRole, user } = useAuth()
  // 5b effective role: the project members doc WINS over the global claim
  // (locked Q5/Q6). Board-edit affordances render NOTHING while the first
  // uncached member read for this project is in flight (resolving) — never
  // the global-role guess.
  const { role, resolving: roleResolving } = useEffectiveRole()
  const isMobile = useIsMobile()

  const { entries, loading, error } = useCastingBoard(projectId, clientId)
  const { data: talentLibrary, loading: talentLoading } = useTalentLibrary()

  // -- Role-based flags (5b-II: effective role + resolving gate) --
  // Board-edit affordances (Add Talent, status/book/remove, bulk bar, card
  // edits). Backing rule: the castingBoard subcollection has no explicit
  // match, so writes fall to the project wildcard (firestore.rules:921-929):
  // isAdmin || producerCanAccessProject || hasProjectRole(['producer',
  // 'warehouse']).
  const canEdit = !roleResolving && canManageCasting(role) && !isMobile
  // PINNED to the GLOBAL claim: /castingShares create requires a global
  // admin/producer claim (firestore.rules:227-231) — the backend cannot see
  // a project promotion, so the UI must not advertise Share from the
  // effective role.
  const canShare =
    (globalRole === "admin" || globalRole === "producer") && !isMobile
  // PINNED to the GLOBAL claim: Book also backlinks
  // /clients/{clientId}/talent/{talentId}.projectIds, whose rule is
  // global-claim only (firestore.rules:363-365, isAdmin || isProducer —
  // admin/producer/warehouse). The Book batch is atomic, so a
  // project-promoted member (global viewer/crew + member-doc producer) must
  // skip the backlink — the board status update alone goes through the
  // project wildcard (firestore.rules:921-929).
  const canWriteTalentBacklink =
    globalRole === "admin" ||
    globalRole === "producer" ||
    globalRole === "warehouse"

  // Local UI state
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sort, setSort] = useState<SortKey>("name")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addingSaving, setAddingSaving] = useState(false)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [detailTalentId, setDetailTalentId] = useState<string | null>(null)

  // Load vote aggregates from all casting shares for this project
  const { aggregates: voteAggregates } = useCastingVoteAggregates(projectId, clientId)

  // Build talent lookup map
  const talentById = useMemo(() => {
    const map = new Map<string, TalentRecord>()
    for (const t of talentLibrary) {
      map.set(t.id, t)
    }
    return map
  }, [talentLibrary])

  // Existing talent IDs on the board
  const existingTalentIds = useMemo(
    () => new Set(entries.map((e) => e.talentId)),
    [entries],
  )

  // Filter & sort
  const filtered = useMemo(() => {
    const lowerSearch = search.toLowerCase().trim()
    let result = [...entries]

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((e) => e.status === statusFilter)
    }

    // Text search
    if (lowerSearch) {
      result = result.filter((e) => {
        const talent = talentById.get(e.talentId)
        const name = (talent?.name || e.talentName).toLowerCase()
        const agency = (talent?.agency || e.talentAgency || "").toLowerCase()
        return name.includes(lowerSearch) || agency.includes(lowerSearch)
      })
    }

    // Sort
    result.sort((a, b) => {
      const tA = talentById.get(a.talentId)
      const tB = talentById.get(b.talentId)
      switch (sort) {
        case "name": {
          const nameA = (tA?.name || a.talentName).toLowerCase()
          const nameB = (tB?.name || b.talentName).toLowerCase()
          return nameA.localeCompare(nameB)
        }
        case "agency": {
          const agencyA = (tA?.agency || a.talentAgency || "").toLowerCase()
          const agencyB = (tB?.agency || b.talentAgency || "").toLowerCase()
          return agencyA.localeCompare(agencyB) || (tA?.name || a.talentName).localeCompare(tB?.name || b.talentName)
        }
        case "status": {
          const order: Record<CastingBoardStatus, number> = {
            booked: 0,
            shortlist: 1,
            hold: 2,
            passed: 3,
          }
          return (order[a.status] ?? 9) - (order[b.status] ?? 9)
        }
        default:
          return 0
      }
    })

    return result
  }, [entries, statusFilter, search, sort, talentById])

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelected(new Set())

  // Handlers
  const handleStatusChange = async (
    talentId: string,
    status: CastingBoardStatus,
  ) => {
    if (!clientId) return
    try {
      await updateCastingEntry({
        clientId,
        projectId,
        talentId,
        patch: { status },
      })
    } catch (err) {
      toast.error("Failed to update status", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleBook = async (talentId: string) => {
    if (!clientId || !user) return
    try {
      await bookCastingTalent({
        clientId,
        projectId,
        userId: user.uid,
        talentId,
        includeTalentBacklink: canWriteTalentBacklink,
      })
      toast.success("Talent booked")
    } catch (err) {
      toast.error("Failed to book talent", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleRemove = async (talentId: string) => {
    if (!clientId) return
    try {
      await removeTalentFromCastingBoard({ clientId, projectId, talentId })
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(talentId)
        return next
      })
      toast.success("Talent removed")
    } catch (err) {
      toast.error("Failed to remove talent", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleAddTalent = async (talentIds: readonly string[]) => {
    if (!clientId || !user) return
    setAddingSaving(true)
    try {
      const talentData = new Map(
        talentIds.map((id) => {
          const t = talentById.get(id)
          return [id, { name: t?.name ?? "Unknown", agency: t?.agency ?? null }]
        }),
      )
      await addTalentToCastingBoard({
        clientId,
        projectId,
        userId: user.uid,
        talentIds,
        talentData,
      })
      toast.success(`Added ${talentIds.length} talent`)
      setAddDialogOpen(false)
    } catch (err) {
      toast.error("Failed to add talent", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setAddingSaving(false)
    }
  }

  const handleBulkStatus = async (status: CastingBoardStatus) => {
    if (!clientId || selected.size === 0) return
    const talentIds = entries
      .filter((e) => selected.has(e.id))
      .map((e) => e.talentId)
    try {
      await bulkUpdateCastingStatus({ clientId, projectId, talentIds, status })
      clearSelection()
      toast.success(`Updated ${talentIds.length} talent`)
    } catch (err) {
      toast.error("Failed to update", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleBulkRemove = async () => {
    if (!clientId || selected.size === 0) return
    const talentIds = entries
      .filter((e) => selected.has(e.id))
      .map((e) => e.talentId)
    try {
      for (const talentId of talentIds) {
        await removeTalentFromCastingBoard({ clientId, projectId, talentId })
      }
      clearSelection()
      toast.success(`Removed ${talentIds.length} talent`)
    } catch (err) {
      toast.error("Failed to remove", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleShare = () => {
    setShareDialogOpen(true)
  }

  if (loading || talentLoading) {
    return <LoadingState loading skeleton={<ListPageSkeleton />} />
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  const actions = (
    <>
      <EffectiveRoleChip />
      {canShare && (
        <Button variant="outline" size="sm" onClick={handleShare}>
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Share
        </Button>
      )}
      {canEdit && (
        <Button size="sm" onClick={() => setAddDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Talent
        </Button>
      )}
    </>
  )

  return (
    <ErrorBoundary>
      <PageHeader title="Casting" actions={actions} />

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)] px-4 py-3">
        <Input
          placeholder="Search talent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 min-w-[160px] flex-1 text-sm"
        />

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {(
              Object.keys(CASTING_STATUS_MAP) as CastingBoardStatus[]
            ).map((s) => (
              <SelectItem key={s} value={s}>
                {CASTING_STATUS_MAP[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={sort}
          onValueChange={(v) => setSort(v as SortKey)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Sort: Name</SelectItem>
            <SelectItem value="agency">Sort: Agency</SelectItem>
            <SelectItem value="status">Sort: Status</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Talent count */}
      {entries.length > 0 && (
        <div className="mb-4 text-xs text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text-secondary)]">
            {filtered.length}
          </span>{" "}
          talent in casting pool
          {filtered.length !== entries.length &&
            ` (${entries.length} total)`}
        </div>
      )}

      {/* Grid or Empty */}
      {entries.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No talent on the casting board"
          description="Add talent from your library to begin casting for this project."
          actionLabel={canEdit ? "Add Talent" : undefined}
          onAction={canEdit ? () => setAddDialogOpen(true) : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No matching talent"
          description="Try adjusting your search or filter."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((entry) => (
            <CastingCard
              key={entry.id}
              entry={entry}
              talent={talentById.get(entry.talentId) ?? null}
              selected={selected.has(entry.id)}
              canEdit={canEdit}
              voteAggregate={voteAggregates.get(entry.talentId)}
              onClick={() => setDetailTalentId(entry.talentId)}
              onSelect={toggleSelect}
              onStatusChange={handleStatusChange}
              onBook={handleBook}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Selection bar */}
      {selected.size > 0 && canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface-raised)] px-6 py-3 animate-in slide-in-from-bottom-4">
          <span className="mr-2 text-sm text-[var(--color-text-muted)]">
            {selected.size} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkStatus("shortlist")}
          >
            Shortlist
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkStatus("hold")}
          >
            Hold
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkStatus("passed")}
            className="text-[var(--color-error)]"
          >
            Pass
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkRemove}
          >
            Remove
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSelection}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Add Talent Dialog */}
      <AddCastingTalentDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        talent={talentLibrary}
        existingTalentIds={existingTalentIds}
        saving={addingSaving}
        onAdd={handleAddTalent}
      />

      {/* Share Casting Dialog */}
      {clientId && user && (
        <CastingShareDialog
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          clientId={clientId}
          projectId={projectId}
          projectName={projectName || "Project"}
          userId={user.uid}
          entries={entries}
          selectedIds={selected.size > 0 ? selected : undefined}
        />
      )}

      {/* Talent Detail Sheet */}
      <AdminTalentDetailSheet
        open={detailTalentId !== null}
        onOpenChange={(open) => { if (!open) setDetailTalentId(null) }}
        talent={detailTalentId ? (talentById.get(detailTalentId) ?? null) : null}
        entry={detailTalentId ? (entries.find((e) => e.talentId === detailTalentId) ?? null) : null}
        voteAggregate={detailTalentId ? (voteAggregates.get(detailTalentId) ?? null) : null}
      />
    </ErrorBoundary>
  )
}
