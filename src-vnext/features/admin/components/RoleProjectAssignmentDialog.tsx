import { useState, useEffect, useMemo } from "react"
import { doc, getDoc } from "firebase/firestore"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
import { db } from "@/shared/lib/firebase"
import { projectMemberDocPath } from "@/shared/lib/paths"
import { useProjects } from "@/features/projects/hooks/useProjects"
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
 * The dialog has no upstream knowledge of the target user's EXISTING project
 * memberships (the Team roster row that opens it never loads them — see
 * TeamRosterTab), so it looks them up itself: one getDoc per active project
 * against the member doc's known id (userId), fired only while this dialog
 * is open for a specific user. That set is passed to ProjectAssignmentPicker
 * as `existingProjectIds` so already-assigned projects render disabled +
 * labelled instead of being silently re-writable, and the zero-access
 * warning is gated on the REAL total (existing + newly picked), not just
 * what was picked in this dialog.
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
  // null = still loading this user's existing memberships (or not yet fetched
  // for this open). Kept distinct from an empty Set so the warning copy never
  // flashes a false "zero access" while the lookup is in flight.
  const [existingProjectIds, setExistingProjectIds] = useState<ReadonlySet<string> | null>(null)

  const { data: projects } = useProjects()
  const activeProjectIds = useMemo(
    () => projects.filter((p) => !p.deletedAt).map((p) => p.id),
    [projects],
  )

  useEffect(() => {
    if (open) {
      setAssignments([])
    }
  }, [open])

  useEffect(() => {
    if (!open || !userId || !clientId || activeProjectIds.length === 0) {
      if (open) setExistingProjectIds(new Set())
      return
    }

    let cancelled = false
    setExistingProjectIds(null)

    const loadExisting = async () => {
      const ids = new Set<string>()
      await Promise.all(
        activeProjectIds.map(async (projectId) => {
          const ref = doc(db, ...projectMemberDocPath(userId, projectId, clientId))
          const snap = await getDoc(ref)
          if (snap.exists()) ids.add(projectId)
        }),
      )
      if (!cancelled) setExistingProjectIds(ids)
    }
    void loadExisting()

    return () => {
      cancelled = true
    }
    // activeProjectIds is content-derived from `projects` via useMemo; depending on
    // its joined value (not the array reference) avoids refiring this effect on
    // every Firestore snapshot when the active project set hasn't actually changed.
  }, [open, userId, clientId, activeProjectIds.join(",")])

  const existingCount = existingProjectIds?.size ?? 0
  const totalAfterSave = existingCount + assignments.length
  const stillLoadingExisting = existingProjectIds === null
  const hasNoAssignments = !stillLoadingExisting && totalAfterSave === 0

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
          <Button
            onClick={handleAssign}
            disabled={saving || assignments.length === 0 || !clientId || !addedBy}
          >
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
          project access to see anything
          {!stillLoadingExisting && existingCount > 0
            ? ` — they're already on ${existingCount} project${existingCount > 1 ? "s" : ""}. Pick any more to add.`
            : " — pick which projects to add them to."}
        </p>

        <ProjectAssignmentPicker
          assignments={assignments}
          onChange={setAssignments}
          existingProjectIds={existingProjectIds ?? undefined}
          defaultRole={newRole}
        />

        {hasNoAssignments && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-md border p-3 bg-[var(--color-status-amber-bg)] border-[var(--color-status-amber-border)] text-[var(--color-status-amber-text)]"
          >
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
