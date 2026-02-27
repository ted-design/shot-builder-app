import { useState } from "react"
import { ShieldCheck, UserPlus } from "lucide-react"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { EmptyState } from "@/shared/components/EmptyState"
import { LoadingState } from "@/shared/components/LoadingState"
import { ListPageSkeleton } from "@/shared/components/Skeleton"
import { PageHeader } from "@/shared/components/PageHeader"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import { normalizeRole, roleLabel } from "@/shared/lib/rbac"
import { useUsers } from "@/features/admin/hooks/useUsers"
import { InviteUserDialog } from "./InviteUserDialog"
import { UserRoleSelect } from "./UserRoleSelect"

function formatTimestamp(ts: unknown): string {
  if (!ts || typeof ts !== "object") return "\u2014"
  const t = ts as { toDate?: () => Date }
  if (typeof t.toDate === "function") {
    return t.toDate().toLocaleDateString()
  }
  return "\u2014"
}

export default function AdminPage() {
  const { data: users, loading, error } = useUsers()
  const { user, clientId } = useAuth()
  const [inviteOpen, setInviteOpen] = useState(false)

  if (loading) return <LoadingState loading skeleton={<ListPageSkeleton />} />

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-[var(--color-error)]">{error.message}</p>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex flex-col gap-5">
        <PageHeader
          title="Team"
          actions={
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Invite User
            </Button>
          }
        />

        {users.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-12 w-12" />}
            title="No team members yet"
            description="Invite team members to give them access to Shot Builder."
            actionLabel="Invite User"
            onAction={() => setInviteOpen(true)}
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                  <th className="label-meta px-4 py-3 text-left">Name</th>
                  <th className="label-meta px-4 py-3 text-left">Email</th>
                  <th className="label-meta px-4 py-3 text-left">Role</th>
                  <th className="label-meta px-4 py-3 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = user?.uid === u.id
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-[var(--color-border)] last:border-b-0"
                    >
                      <td className="px-4 py-2.5 text-sm font-medium text-[var(--color-text)]">
                        {u.displayName ?? "\u2014"}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
                        {u.email}
                      </td>
                      <td className="px-4 py-2.5">
                        {clientId ? (
                          <UserRoleSelect
                            userId={u.id}
                            userEmail={u.email}
                            currentRole={normalizeRole(u.role)}
                            clientId={clientId}
                            disabled={isSelf}
                          />
                        ) : (
                          <span className="text-sm text-[var(--color-text-muted)]">
                            {roleLabel(normalizeRole(u.role))}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
                        {formatTimestamp(u.updatedAt)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <InviteUserDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </ErrorBoundary>
  )
}
