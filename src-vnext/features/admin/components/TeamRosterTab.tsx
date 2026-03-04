import { useState, useMemo, useCallback } from "react"
import { ShieldCheck } from "lucide-react"
import { EmptyState } from "@/shared/components/EmptyState"
import { normalizeRole } from "@/shared/lib/rbac"
import { TeamSearchFilterBar, type UserStatusFilter } from "./TeamSearchFilterBar"
import { TeamUserRow } from "./TeamUserRow"
import { PendingInvitationRow } from "./PendingInvitationRow"
import type { PendingInvitation } from "@/features/admin/hooks/usePendingInvitations"

interface UserEntry {
  readonly id: string
  readonly email: string
  readonly displayName?: string | null
  readonly role: string
  readonly status?: string
  readonly updatedAt?: unknown
  readonly lastSignInAt?: unknown
}

interface TeamRosterTabProps {
  readonly users: ReadonlyArray<UserEntry>
  readonly pendingInvitations: ReadonlyArray<PendingInvitation>
  readonly currentUserId: string | undefined
  readonly clientId: string | undefined
  readonly onInvite: () => void
}

function formatTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "\u2014"
  const t = ts as { toDate?: () => Date }
  if (typeof t.toDate === "function") {
    return t.toDate().toLocaleDateString()
  }
  return "\u2014"
}

function getUserStatusCategory(status: string | undefined): "active" | "deactivated" {
  return status === "deactivated" ? "deactivated" : "active"
}

export function TeamRosterTab({
  users,
  pendingInvitations,
  currentUserId,
  clientId,
  onInvite,
}: TeamRosterTabProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all")
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const filteredUsers = useMemo(() => {
    const query = searchQuery.toLowerCase().trim()

    return users.filter((u) => {
      // Search filter
      if (query.length > 0) {
        const nameMatch = (u.displayName ?? "").toLowerCase().includes(query)
        const emailMatch = u.email.toLowerCase().includes(query)
        if (!nameMatch && !emailMatch) return false
      }

      // Role filter
      if (roleFilter !== "all" && normalizeRole(u.role) !== roleFilter) {
        return false
      }

      // Status filter
      const userCategory = getUserStatusCategory(u.status)
      if (statusFilter === "pending") return false
      if (statusFilter === "active" && userCategory !== "active") return false
      if (statusFilter === "deactivated" && userCategory !== "deactivated") return false

      return true
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const filteredPending = useMemo(() => {
    if (statusFilter === "active" || statusFilter === "deactivated") {
      return []
    }

    const query = searchQuery.toLowerCase().trim()
    return pendingInvitations.filter((inv) => {
      if (query.length > 0) {
        return inv.email.toLowerCase().includes(query)
      }
      return true
    }).filter((inv) => {
      if (roleFilter !== "all" && inv.role !== roleFilter) return false
      return true
    })
  }, [pendingInvitations, searchQuery, roleFilter, statusFilter])

  const handleToggleExpand = useCallback((userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId))
  }, [])

  const totalResults = filteredUsers.length + filteredPending.length
  const isEmpty = users.length === 0 && pendingInvitations.length === 0

  const activeCount = useMemo(() => {
    return users.filter((u) => getUserStatusCategory(u.status) === "active").length
  }, [users])

  const deactivatedCount = useMemo(() => {
    return users.filter((u) => getUserStatusCategory(u.status) === "deactivated").length
  }, [users])

  if (isEmpty) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-12 w-12" />}
        title="No team members yet"
        description="Invite team members to give them access."
        actionLabel="Invite User"
        onAction={onInvite}
      />
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <TeamSearchFilterBar
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        roleFilter={roleFilter}
        onRoleFilterChange={setRoleFilter}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {totalResults === 0 ? (
        <EmptyState
          title="No results found"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                <th className="label-meta px-4 py-3 text-left">Name</th>
                <th className="label-meta px-4 py-3 text-left">Status</th>
                <th className="label-meta px-4 py-3 text-left">Role</th>
                <th className="label-meta hidden px-4 py-3 text-left sm:table-cell">Last Sign In</th>
                <th className="label-meta hidden px-4 py-3 text-left md:table-cell">Updated</th>
                {filteredPending.length > 0 && (
                  <th className="label-meta px-4 py-3 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <TeamUserRow
                  key={u.id}
                  userId={u.id}
                  email={u.email}
                  displayName={u.displayName ?? null}
                  role={u.role}
                  status={u.status}
                  updatedAt={u.updatedAt}
                  lastSignInAt={u.lastSignInAt}
                  currentUserId={currentUserId}
                  clientId={clientId}
                  isExpanded={expandedUserId === u.id}
                  onToggleExpand={() => handleToggleExpand(u.id)}
                  projectMemberships={[]}
                  formatTimestamp={formatTimestamp}
                />
              ))}
              {filteredPending.length > 0 && clientId && (
                <>
                  {filteredUsers.length > 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-2"
                      >
                        <span className="label-meta">Pending Invitations</span>
                      </td>
                    </tr>
                  )}
                  {filteredPending.map((inv) => (
                    <PendingInvitationRow
                      key={inv.id}
                      id={inv.id}
                      email={inv.email}
                      role={inv.role}
                      createdAt={inv.createdAt}
                      clientId={clientId}
                    />
                  ))}
                </>
              )}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-[var(--color-text-muted)]">
        {activeCount} active {activeCount === 1 ? "member" : "members"}
        {deactivatedCount > 0 && `, ${deactivatedCount} deactivated`}
        {pendingInvitations.length > 0 && `, ${pendingInvitations.length} pending`}
      </p>
    </div>
  )
}
