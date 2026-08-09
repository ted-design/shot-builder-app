import { useState } from "react"
import { toast } from "sonner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { ROLE, roleLabel, isProjectScopedRole } from "@/shared/lib/rbac"
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
  // Mount (assignDialogRole) and open (assignOpen) are separate on purpose —
  // house pattern from ProjectAccessTab's AddProjectMemberDialog. Collapsing
  // them into one signal (as this used to) unmounts RoleProjectAssignmentDialog
  // the instant it closes, which kills Radix's exit animation. Keeping the
  // dialog mounted with assignDialogRole set (even while assignOpen is false)
  // also means a second role change reuses the same instance instead of a
  // fresh one, so its internal "reset assignments on reopen" effect is a real,
  // reachable path rather than untested dead code.
  const [assignDialogRole, setAssignDialogRole] = useState<Role | null>(null)
  const [assignOpen, setAssignOpen] = useState(false)

  const handleChange = async (value: string) => {
    const newRole = value as Role
    if (newRole === currentRole) return

    setSaving(true)
    try {
      await updateUserRole({ userId, userEmail, newRole, clientId })
      toast.success(`Updated ${userEmail} to ${roleLabel(newRole)}`)
      if (isProjectScopedRole(newRole)) {
        setAssignDialogRole(newRole)
        setAssignOpen(true)
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
      {/* user?.uid guard: without it the dialog would mount with an empty
          addedBy, so a real assignment write would silently fail attribution.
          If uid is ever absent here, skip the follow-up rather than open a
          dialog whose Assign button can never do anything. */}
      {assignDialogRole && user?.uid && (
        <RoleProjectAssignmentDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          userId={userId}
          userEmail={userEmail}
          newRole={assignDialogRole}
          clientId={clientId}
          addedBy={user.uid}
        />
      )}
    </>
  )
}
