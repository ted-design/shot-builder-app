import { useState, useMemo } from "react"
import { toast } from "sonner"
import { Trash2, UserPlus } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { useUsers } from "@/features/admin/hooks/useUsers"
import { useProjectMembers, type ProjectMember } from "@/features/admin/hooks/useProjectMembers"
import { removeProjectMember } from "@/features/admin/lib/adminWrites"
import { ROLE, normalizeRole, roleLabel, roleRank } from "@/shared/lib/rbac"
import { EmptyState } from "@/shared/components/EmptyState"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog"
import { AddProjectMemberDialog } from "./AddProjectMemberDialog"
import type { Role } from "@/shared/types"

interface RemoveTarget {
  readonly userId: string
  readonly displayName: string
  readonly projectName: string
}

// Admin diagnostic (5b-II, copy-level only): the member-doc role is what
// useEffectiveRole resolves on project surfaces, so surface a quiet one-liner
// when it differs from the user's global claim. No new reads — useUsers
// already carries the global role. Returns null when the roles agree (or the
// global role is unknown), so the row stays exactly as before.
function effectiveAccessNote(projectRole: Role, globalRole: Role | null): string | null {
  if (globalRole === null) return null
  // Mirrors the useEffectiveRole admin exception (locked Q6): a global admin
  // short-circuits to admin and never reads the member doc.
  if (globalRole === ROLE.ADMIN) {
    return "Admin globally — project role has no effect"
  }
  const projectRank = roleRank(projectRole)
  const globalRank = roleRank(globalRole)
  // crew<->warehouse is lateral (equal rank) — no copy, matching roleRank.
  if (projectRank === globalRank) return null
  const direction = projectRank < globalRank ? "downgraded" : "promoted"
  return `Effective here: ${roleLabel(projectRole)} (${direction} from global ${roleLabel(globalRole)})`
}

function MemberTable({
  members,
  users,
  projectName,
  projectId,
  clientId,
  currentUserId,
}: {
  readonly members: readonly ProjectMember[]
  readonly users: ReadonlyArray<{ readonly id: string; readonly email: string; readonly displayName?: string | null; readonly role?: Role }>
  readonly projectName: string
  readonly projectId: string
  readonly clientId: string
  readonly currentUserId: string | null
}) {
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null)
  const [removing, setRemoving] = useState(false)

  const enrichedMembers = useMemo(() => {
    return members.map((m) => {
      const user = users.find((u) => u.id === m.id)
      // Both roles go through normalizeRole, matching the useEffectiveRole
      // pipeline (legacy 'wardrobe' member docs label as Warehouse).
      const projectRole = normalizeRole(m.role)
      const globalRole = user ? normalizeRole(user.role) : null
      return {
        ...m,
        displayName: user?.displayName ?? null,
        email: user?.email ?? "Unknown",
        projectRole,
        effectiveNote: effectiveAccessNote(projectRole, globalRole),
      }
    })
  }, [members, users])

  const handleRemove = async () => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      await removeProjectMember({
        projectId,
        userId: removeTarget.userId,
        clientId,
      })
      toast.success(`Removed ${removeTarget.displayName} from ${removeTarget.projectName}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      toast.error(message)
    } finally {
      setRemoving(false)
      setRemoveTarget(null)
    }
  }

  if (members.length === 0) {
    return (
      <EmptyState
        title="No members assigned to this project"
        description="Add team members to give them access to this project."
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
              <th className="label-meta px-4 py-3 text-left">Name</th>
              <th className="label-meta px-4 py-3 text-left">Email</th>
              <th className="label-meta px-4 py-3 text-left">Project Role</th>
              <th className="label-meta px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrichedMembers.map((m) => (
              <tr
                key={m.id}
                className="border-b border-[var(--color-border)] last:border-b-0"
              >
                <td className="px-4 py-2.5 text-sm font-medium text-[var(--color-text)]">
                  {m.displayName ?? "\u2014"}
                </td>
                <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
                  {m.email}
                </td>
                <td className="px-4 py-2.5 text-sm text-[var(--color-text-muted)]">
                  {roleLabel(m.projectRole)}
                  {m.effectiveNote && (
                    <div
                      data-testid="project-access-effective-role"
                      className="mt-0.5 text-xs text-[var(--color-text-subtle)]"
                    >
                      {m.effectiveNote}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {m.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ${m.displayName ?? m.email} from project`}
                      onClick={() =>
                        setRemoveTarget({
                          userId: m.id,
                          displayName: m.displayName ?? m.email,
                          projectName,
                        })
                      }
                      title="Remove member"
                    >
                      <Trash2 className="h-4 w-4 text-[var(--color-text-muted)]" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Member</AlertDialogTitle>
            <AlertDialogDescription>
              Remove {removeTarget?.displayName} from {removeTarget?.projectName}?
              They will lose access to all project data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function ProjectAccessTab() {
  const { clientId, user } = useAuth()
  const { data: projects } = useProjects()
  const { data: users } = useUsers()
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [addOpen, setAddOpen] = useState(false)

  const activeProjects = useMemo(() => {
    return projects.filter((p) => !p.deletedAt)
  }, [projects])

  const selectedProject = useMemo(() => {
    return activeProjects.find((p) => p.id === selectedProjectId) ?? null
  }, [activeProjects, selectedProjectId])

  const { data: members } = useProjectMembers(
    selectedProjectId || null,
    clientId,
  )

  if (!clientId) return null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-full sm:w-[320px]">
            <SelectValue placeholder="Select a project..." />
          </SelectTrigger>
          <SelectContent>
            {activeProjects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedProject && (
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {!selectedProject ? (
        <EmptyState
          title="Select a project to manage members"
          description="Choose a project from the dropdown above to view and manage its team members."
        />
      ) : (
        <MemberTable
          members={members}
          users={users}
          projectName={selectedProject.name}
          projectId={selectedProject.id}
          clientId={clientId}
          currentUserId={user?.uid ?? null}
        />
      )}

      {selectedProject && (
        <AddProjectMemberDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          projectId={selectedProject.id}
          projectName={selectedProject.name}
          existingMemberIds={members.map((m) => m.id)}
        />
      )}
    </div>
  )
}
