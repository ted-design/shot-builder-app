import { useState } from "react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { ROLE, roleLabel } from "@/shared/lib/rbac"
import { updateUserRole } from "@/features/admin/lib/adminWrites"
import { useAuth } from "@/app/providers/AuthProvider"
import { RoleProjectAssignmentDialog } from "./RoleProjectAssignmentDialog"
import type { Role } from "@/shared/types"

const ROLE_OPTIONS: readonly Role[] = [
  ROLE.ADMIN,
  ROLE.PRODUCER,
  ROLE.CREW,
  ROLE.WAREHOUSE,
  ROLE.VIEWER,
]

// Roles that only see what they're explicitly assigned to (unlike admin/producer,
// who get org-wide access via rules) — parity with InviteUserDialog, which pairs
// these roles with a project-assignment step for NEW users.
const PROJECT_SCOPED_ROLES: readonly Role[] = [
  ROLE.CREW,
  ROLE.WAREHOUSE,
  ROLE.VIEWER,
]

interface UserRoleSelectProps {
  readonly userId: string
  readonly userEmail: string
  readonly currentRole: Role
  readonly clientId: string
  readonly disabled?: boolean
}

export function UserRoleSelect({
  userId,
  userEmail,
  currentRole,
  clientId,
  disabled,
}: UserRoleSelectProps) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [assignDialogRole, setAssignDialogRole] = useState<Role | null>(null)

  const handleChange = async (value: string) => {
    const newRole = value as Role
    if (newRole === currentRole) return

    setSaving(true)
    try {
      await updateUserRole({ userId, userEmail, newRole, clientId })
      toast.success(`Updated ${userEmail} to ${roleLabel(newRole)}`)
      if (PROJECT_SCOPED_ROLES.includes(newRole)) {
        setAssignDialogRole(newRole)
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update role",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Select value={currentRole} onValueChange={handleChange} disabled={disabled || saving}>
        <SelectTrigger className="h-8 w-[140px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((role) => (
            <SelectItem key={role} value={role}>
              {roleLabel(role)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {assignDialogRole && (
        <RoleProjectAssignmentDialog
          open={assignDialogRole !== null}
          onOpenChange={(open) => {
            if (!open) setAssignDialogRole(null)
          }}
          userId={userId}
          userEmail={userEmail}
          newRole={assignDialogRole}
          clientId={clientId}
          addedBy={user?.uid ?? ""}
        />
      )}
    </>
  )
}
