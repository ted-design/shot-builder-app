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
  const [saving, setSaving] = useState(false)

  const handleChange = async (value: string) => {
    const newRole = value as Role
    if (newRole === currentRole) return

    setSaving(true)
    try {
      await updateUserRole({ userId, userEmail, newRole, clientId })
      toast.success(`Updated ${userEmail} to ${roleLabel(newRole)}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update role",
      )
    } finally {
      setSaving(false)
    }
  }

  return (
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
  )
}
