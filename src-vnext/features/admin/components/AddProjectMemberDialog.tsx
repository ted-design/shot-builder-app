import { useState, useEffect, useMemo } from "react"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { useUsers } from "@/features/admin/hooks/useUsers"
import { addProjectMember } from "@/features/admin/lib/adminWrites"
import { ROLE, roleLabel } from "@/shared/lib/rbac"
import { ROLE_DESCRIPTIONS } from "@/shared/lib/roleDescriptions"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { Role } from "@/shared/types"

const PROJECT_ROLE_OPTIONS: readonly Role[] = [
  ROLE.PRODUCER,
  ROLE.CREW,
  ROLE.WAREHOUSE,
  ROLE.VIEWER,
]

interface AddProjectMemberDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly projectId: string
  readonly projectName: string
  readonly existingMemberIds: readonly string[]
}

export function AddProjectMemberDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  existingMemberIds,
}: AddProjectMemberDialogProps) {
  const { clientId, user } = useAuth()
  const { data: users } = useUsers()

  const [selectedUserId, setSelectedUserId] = useState("")
  const [role, setRole] = useState<Role>(ROLE.CREW)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setSelectedUserId("")
      setRole(ROLE.CREW)
    }
  }, [open])

  const availableUsers = useMemo(() => {
    return users.filter((u) => !existingMemberIds.includes(u.id))
  }, [users, existingMemberIds])

  const selectedUser = useMemo(() => {
    return availableUsers.find((u) => u.id === selectedUserId) ?? null
  }, [availableUsers, selectedUserId])

  const canSubmit = selectedUserId.length > 0 && !saving

  const handleSubmit = async () => {
    if (!clientId || !selectedUserId || !user) return

    setSaving(true)
    try {
      await addProjectMember({
        projectId,
        userId: selectedUserId,
        role,
        addedBy: user.uid,
        clientId,
      })
      const name = selectedUser?.displayName ?? selectedUser?.email ?? "User"
      toast.success(`Added ${name} as ${roleLabel(role)} on ${projectName}`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Member"
      description="Add a team member to this project with a specific role."
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Adding..." : "Add Member"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label>Team Member</Label>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a user..." />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.displayName ?? u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {availableUsers.length === 0 && (
            <p className="text-xs text-[var(--color-text-muted)]">
              All team members are already assigned to this project.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Project Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROJECT_ROLE_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {roleLabel(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-[var(--color-text-muted)] rounded-md bg-[var(--color-surface-subtle)] p-2">
            {ROLE_DESCRIPTIONS[role]}
          </p>
        </div>
      </div>
    </ResponsiveDialog>
  )
}
