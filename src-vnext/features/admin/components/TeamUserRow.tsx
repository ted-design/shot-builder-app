import { ChevronDown, ChevronRight } from "lucide-react"
import { normalizeRole, roleLabel } from "@/shared/lib/rbac"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { UserRoleSelect } from "./UserRoleSelect"
import { UserDetailPanel } from "./UserDetailPanel"
import type { Role } from "@/shared/types"

interface ProjectMembership {
  readonly projectId: string
  readonly projectName: string
  readonly role: string
}

interface TeamUserRowProps {
  readonly userId: string
  readonly email: string
  readonly displayName: string | null
  readonly role: string
  readonly status: string | undefined
  readonly updatedAt: unknown
  readonly currentUserId: string | undefined
  readonly clientId: string | undefined
  readonly isExpanded: boolean
  readonly onToggleExpand: () => void
  readonly projectMemberships: ReadonlyArray<ProjectMembership>
  readonly formatTimestamp: (ts: unknown) => string
}

function getUserStatusDisplay(userStatus: string | undefined): {
  label: string
  color: string
} {
  if (userStatus === "deactivated") return { label: "Deactivated", color: "gray" }
  return { label: "Active", color: "green" }
}

export function TeamUserRow({
  userId,
  email,
  displayName,
  role,
  status: userStatus,
  updatedAt,
  currentUserId,
  clientId,
  isExpanded,
  onToggleExpand,
  projectMemberships,
  formatTimestamp,
}: TeamUserRowProps) {
  const normalizedRole = normalizeRole(role)
  const isSelf = currentUserId === userId
  const isDeactivated = userStatus === "deactivated"
  const statusDisplay = getUserStatusDisplay(userStatus)

  return (
    <>
      <tr
        className="border-b border-[var(--color-border)] last:border-b-0 cursor-pointer hover:bg-[var(--color-surface-subtle)] transition-colors"
        onClick={onToggleExpand}
      >
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />
            ) : (
              <ChevronRight className="h-4 w-4 flex-shrink-0 text-[var(--color-text-muted)]" />
            )}
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--color-text)] truncate">
                {displayName ?? email}
              </div>
              {displayName && (
                <div className="text-xxs text-[var(--color-text-muted)] truncate">
                  {email}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <StatusBadge label={statusDisplay.label} color={statusDisplay.color} />
        </td>
        <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
          {isDeactivated ? (
            <span className="text-sm text-[var(--color-text-muted)]">
              {roleLabel(normalizedRole)}
            </span>
          ) : clientId ? (
            <UserRoleSelect
              userId={userId}
              userEmail={email}
              currentRole={normalizedRole}
              clientId={clientId}
              disabled={isSelf}
            />
          ) : (
            <span className="text-sm text-[var(--color-text-muted)]">
              {roleLabel(normalizedRole)}
            </span>
          )}
        </td>
        <td className="hidden px-4 py-2.5 text-sm text-[var(--color-text-muted)] sm:table-cell">
          {"\u2014"}
        </td>
        <td className="hidden px-4 py-2.5 text-sm text-[var(--color-text-muted)] md:table-cell">
          {formatTimestamp(updatedAt)}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={5} className="p-0">
            <UserDetailPanel
              userId={userId}
              email={email}
              displayName={displayName ?? null}
              role={normalizedRole}
              clientId={clientId ?? ""}
              isSelf={isSelf}
              isPending={false}
              isDeactivated={isDeactivated}
              lastSignIn={"\u2014"}
              projectMemberships={projectMemberships}
            />
          </td>
        </tr>
      )}
    </>
  )
}
