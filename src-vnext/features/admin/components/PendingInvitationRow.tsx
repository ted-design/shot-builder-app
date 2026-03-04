import { useState } from "react"
import { deleteDoc, doc } from "firebase/firestore"
import { toast } from "sonner"
import { Trash2, RefreshCw } from "lucide-react"
import { db } from "@/shared/lib/firebase"
import { roleLabel } from "@/shared/lib/rbac"
import { resendInvitation } from "@/features/admin/lib/adminWrites"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { Button } from "@/ui/button"
import type { Role } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

interface PendingInvitationRowProps {
  readonly id: string
  readonly email: string
  readonly role: Role
  readonly createdAt: Timestamp | null
  readonly clientId: string
}

function formatRelativeTime(ts: Timestamp | null): string {
  if (!ts) return "\u2014"
  const now = Date.now()
  const created = ts.toDate().getTime()
  const diffMs = now - created
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "Invited today"
  if (diffDays === 1) return "Invited 1 day ago"
  return `Invited ${diffDays} days ago`
}

export function PendingInvitationRow({
  id,
  email,
  role,
  createdAt,
  clientId,
}: PendingInvitationRowProps) {
  const [resending, setResending] = useState(false)

  const handleRevoke = () => {
    void deleteDoc(doc(db, "clients", clientId, "pendingInvitations", id))
      .then(() => toast.success("Invitation revoked"))
      .catch(() => toast.error("Failed to revoke invitation"))
  }

  const handleResend = async () => {
    setResending(true)
    try {
      await resendInvitation({ email, role })
      toast.success(`Invitation email resent to ${email}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invitation")
    } finally {
      setResending(false)
    }
  }

  return (
    <tr className="border-b border-[var(--color-border)] last:border-b-0">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0">
            <div className="text-sm text-[var(--color-text)] truncate">
              {email}
            </div>
            <div className="text-xxs text-[var(--color-text-muted)]">
              {formatRelativeTime(createdAt)}
            </div>
          </div>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge label="Pending" color="amber" />
      </td>
      <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
        {roleLabel(role)}
      </td>
      <td className="hidden px-4 py-2.5 sm:table-cell">
        {/* Last sign-in: n/a for pending */}
        <span className="text-sm text-[var(--color-text-muted)]">{"\u2014"}</span>
      </td>
      <td className="hidden px-4 py-2.5 md:table-cell">
        <span className="text-sm text-[var(--color-text-muted)]">
          {createdAt ? createdAt.toDate().toLocaleDateString() : "\u2014"}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--color-text-muted)] hover:text-[var(--color-info)]"
            onClick={handleResend}
            disabled={resending}
            title="Resend invitation"
          >
            <RefreshCw className={`h-4 w-4 ${resending ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--color-text-muted)] hover:text-[var(--color-error)]"
            onClick={handleRevoke}
            title="Revoke invitation"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
