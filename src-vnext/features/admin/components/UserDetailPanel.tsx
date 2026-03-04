import { useMemo, useState } from "react"
import { doc, setDoc, serverTimestamp } from "firebase/firestore"
import { toast } from "sonner"
import { ExternalLink, FolderPlus } from "lucide-react"
import { db } from "@/shared/lib/firebase"
import { userDocPath } from "@/shared/lib/paths"
import { useAuth } from "@/app/providers/AuthProvider"
import { ROLE, roleLabel } from "@/shared/lib/rbac"
import { deactivateUser, reactivateUser, bulkAddProjectMembers } from "@/features/admin/lib/adminWrites"
import { ProjectAssignmentPicker, type ProjectAssignment } from "./ProjectAssignmentPicker"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
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
import { StatusBadge } from "@/shared/components/StatusBadge"
import type { Role } from "@/shared/types"

const REACTIVATION_ROLES: readonly Role[] = [
  ROLE.ADMIN,
  ROLE.PRODUCER,
  ROLE.CREW,
  ROLE.WAREHOUSE,
  ROLE.VIEWER,
]

interface UserDetailPanelProps {
  readonly userId: string
  readonly email: string
  readonly displayName: string | null
  readonly role: Role
  readonly clientId: string
  readonly isSelf: boolean
  readonly isPending: boolean
  readonly isDeactivated: boolean
  readonly lastSignIn: string
  readonly projectMemberships: ReadonlyArray<{
    readonly projectId: string
    readonly projectName: string
    readonly role: string
  }>
}

export function UserDetailPanel({
  userId,
  email,
  displayName,
  role,
  clientId,
  isSelf,
  isPending,
  isDeactivated,
  lastSignIn,
  projectMemberships,
}: UserDetailPanelProps) {
  const { user: currentUser } = useAuth()
  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState(displayName ?? "")
  const [savingName, setSavingName] = useState(false)
  const [deactivating, setDeactivating] = useState(false)
  const [confirmDeactivate, setConfirmDeactivate] = useState(false)
  const [showReactivate, setShowReactivate] = useState(false)
  const [reactivateRole, setReactivateRole] = useState<Role>(role || ROLE.VIEWER)
  const [reactivating, setReactivating] = useState(false)
  const [showAssignProjects, setShowAssignProjects] = useState(false)
  const [projectAssignments, setProjectAssignments] = useState<readonly ProjectAssignment[]>([])
  const [savingProjects, setSavingProjects] = useState(false)

  const existingProjectIds = useMemo(() => {
    return new Set(projectMemberships.map((pm) => pm.projectId))
  }, [projectMemberships])

  const handleSaveProjectAssignments = async () => {
    if (projectAssignments.length === 0 || !currentUser) return

    setSavingProjects(true)
    try {
      await bulkAddProjectMembers({
        assignments: projectAssignments,
        userId,
        addedBy: currentUser.uid,
        clientId,
      })
      const count = projectAssignments.length
      toast.success(`Added to ${count} project${count > 1 ? "s" : ""}`)
      setProjectAssignments([])
      setShowAssignProjects(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign projects")
    } finally {
      setSavingProjects(false)
    }
  }

  const handleSaveName = async () => {
    const trimmed = nameValue.trim()
    if (trimmed === (displayName ?? "")) {
      setEditingName(false)
      return
    }

    setSavingName(true)
    try {
      const ref = doc(db, ...userDocPath(userId, clientId))
      await setDoc(
        ref,
        {
          displayName: trimmed || null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      )
      toast.success("Display name updated")
      setEditingName(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update name")
    } finally {
      setSavingName(false)
    }
  }

  const handleNameBlur = () => {
    void handleSaveName()
  }

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      void handleSaveName()
    }
    if (e.key === "Escape") {
      setNameValue(displayName ?? "")
      setEditingName(false)
    }
  }

  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      await deactivateUser({ targetUid: userId, clientId })
      toast.success(`${displayName || email} has been deactivated`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate user")
    } finally {
      setDeactivating(false)
    }
  }

  const handleReactivate = async () => {
    setReactivating(true)
    try {
      await reactivateUser({ targetUid: userId, role: reactivateRole, clientId })
      toast.success(`${displayName || email} has been reactivated as ${roleLabel(reactivateRole)}`)
      setShowReactivate(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reactivate user")
    } finally {
      setReactivating(false)
    }
  }

  return (
    <div className="border-t border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-4 py-3">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Display Name */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[var(--color-text-muted)]">Display Name</Label>
          {editingName ? (
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              disabled={savingName}
              autoFocus
              className="h-8 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameValue(displayName ?? "")
                setEditingName(true)
              }}
              className="text-left text-sm text-[var(--color-text)] hover:text-[var(--color-primary)] transition-colors"
            >
              {displayName || "Click to set name"}
            </button>
          )}
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[var(--color-text-muted)]">Email</Label>
          <span className="text-sm text-[var(--color-text)]">{email}</span>
        </div>

        {/* Role */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[var(--color-text-muted)]">Role</Label>
          <span className="text-sm text-[var(--color-text)]">{roleLabel(role)}</span>
        </div>

        {/* Last Sign In */}
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-[var(--color-text-muted)]">Last Sign In</Label>
          <span className="text-sm text-[var(--color-text)]">{lastSignIn}</span>
        </div>
      </div>

      {/* Project Memberships */}
      <div className="mt-4">
        <Label className="text-xs text-[var(--color-text-muted)]">Project Memberships</Label>
        {projectMemberships.length > 0 ? (
          <div className="mt-1 flex flex-wrap gap-2">
            {projectMemberships.map((pm) => (
              <StatusBadge
                key={pm.projectId}
                label={`${pm.projectName} (${roleLabel(pm.role as Role)})`}
                color="gray"
              />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {isDeactivated ? "Removed from all projects" : "Not assigned to any projects"}
          </p>
        )}
        {!isPending && !isDeactivated && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setShowAssignProjects(!showAssignProjects)
                if (showAssignProjects) setProjectAssignments([])
              }}
            >
              <FolderPlus className="mr-1 h-3 w-3" />
              {showAssignProjects ? "Cancel" : "Assign to Projects"}
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={() => {
                const tabTrigger = document.querySelector<HTMLButtonElement>(
                  '[data-value="project-access"]',
                )
                tabTrigger?.click()
              }}
            >
              <ExternalLink className="mr-1 h-3 w-3" />
              Manage in Project Access tab
            </Button>
          </div>
        )}
        {showAssignProjects && (
          <div className="mt-2 flex flex-col gap-2">
            <ProjectAssignmentPicker
              assignments={projectAssignments}
              onChange={setProjectAssignments}
              existingProjectIds={existingProjectIds}
              defaultRole={role === "admin" ? "producer" : role}
            />
            {projectAssignments.length > 0 && (
              <Button
                size="sm"
                onClick={handleSaveProjectAssignments}
                disabled={savingProjects}
                className="self-start"
              >
                {savingProjects
                  ? "Saving..."
                  : `Add to ${projectAssignments.length} Project${projectAssignments.length > 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Deactivate / Reactivate */}
      {!isPending && !isSelf && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-3">
          {isDeactivated ? (
            <div className="flex flex-col gap-2">
              {showReactivate ? (
                <div className="flex items-center gap-2">
                  <Select value={reactivateRole} onValueChange={(v) => setReactivateRole(v as Role)}>
                    <SelectTrigger className="h-8 w-[140px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REACTIVATION_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleReactivate}
                    disabled={reactivating}
                  >
                    {reactivating ? "Reactivating..." : "Confirm"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowReactivate(false)}
                    disabled={reactivating}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReactivate(true)}
                >
                  Reactivate User
                </Button>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="text-[var(--color-error)] hover:text-[var(--color-error)]"
              onClick={() => setConfirmDeactivate(true)}
              disabled={deactivating}
            >
              {deactivating ? "Deactivating..." : "Deactivate User"}
            </Button>
          )}
        </div>
      )}

      <AlertDialog open={confirmDeactivate} onOpenChange={setConfirmDeactivate}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deactivate {displayName || email}? They will lose access to all projects and will not be able to sign in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              disabled={deactivating}
              className="bg-[var(--color-error)] text-white hover:bg-[var(--color-error)]/90"
            >
              {deactivating ? "Deactivating..." : "Deactivate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
