import { useState, useEffect } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { roleLabel } from "@/shared/lib/rbac"
import { bulkAddProjectMembers } from "@/features/admin/lib/adminWrites"
import { ProjectAssignmentPicker, type ProjectAssignment } from "./ProjectAssignmentPicker"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import type { Role } from "@/shared/types"

interface RoleProjectAssignmentDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly userId: string
  readonly userEmail: string
  readonly newRole: Role
  readonly clientId: string
  readonly addedBy: string
}

/**
 * Follow-up step after an EXISTING user's role is changed to a project-scoped
 * role (crew/warehouse/viewer) via UserRoleSelect on the Team roster.
 *
 * UserRoleSelect's updateUserRole only sets the global claim — it has no
 * project-membership side effect, unlike InviteUserDialog which pairs a new
 * user's role with ProjectAssignmentPicker + bulkAddProjectMembers. This
 * dialog offers that same assignment step for the existing-user path so a
 * role change doesn't silently leave someone unable to see any project.
 *
 * Admin may skip — this never blocks the role change, which has already
 * been written by the time this dialog opens.
 */
export function RoleProjectAssignmentDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  newRole,
  clientId,
  addedBy,
}: RoleProjectAssignmentDialogProps) {
  const [assignments, setAssignments] = useState<readonly ProjectAssignment[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setAssignments([])
    }
  }, [open])

  const hasNoAssignments = assignments.length === 0

  const handleSkip = () => {
    onOpenChange(false)
  }

  const handleAssign = async () => {
    if (assignments.length === 0 || !clientId || !addedBy) return

    setSaving(true)
    try {
      await bulkAddProjectMembers({
        assignments,
        userId,
        addedBy,
        clientId,
      })
      const count = assignments.length
      toast.success(`Added ${userEmail} to ${count} project${count > 1 ? "s" : ""}`)
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign projects")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Assign to Projects"
      description={`Give ${userEmail} access to specific projects as ${roleLabel(newRole)}.`}
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={handleSkip} disabled={saving}>
            Skip
          </Button>
          <Button onClick={handleAssign} disabled={saving || hasNoAssignments}>
            {saving
              ? "Saving..."
              : `Assign${assignments.length > 0 ? ` (${assignments.length})` : ""}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 py-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          {userEmail} is now {roleLabel(newRole)}. {roleLabel(newRole)} needs explicit
          project access to see anything — pick which projects to add them to.
        </p>

        <ProjectAssignmentPicker
          assignments={assignments}
          onChange={setAssignments}
          defaultRole={newRole}
        />

        {hasNoAssignments && (
          <div className="flex items-start gap-2 rounded-md border p-3 bg-[var(--color-status-amber-bg)] border-[var(--color-status-amber-border)] text-[var(--color-status-amber-text)]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm">
              {userEmail} can&apos;t see any projects yet. Skipping leaves them with no
              project access until someone assigns them one.
            </p>
          </div>
        )}
      </div>
    </ResponsiveDialog>
  )
}
