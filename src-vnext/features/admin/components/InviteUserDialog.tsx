import { useState, useEffect } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { ROLE, roleLabel } from "@/shared/lib/rbac"
import { ROLE_DESCRIPTIONS } from "@/shared/lib/roleDescriptions"
import { inviteOrUpdateUser, bulkAddProjectMembers } from "@/features/admin/lib/adminWrites"
import { ProjectAssignmentPicker, type ProjectAssignment } from "./ProjectAssignmentPicker"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
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
import type { Role } from "@/shared/types"

const emailSchema = z.string().email("Enter a valid email address")

const ROLE_OPTIONS: readonly Role[] = [
  ROLE.ADMIN,
  ROLE.PRODUCER,
  ROLE.CREW,
  ROLE.WAREHOUSE,
  ROLE.VIEWER,
]

interface InviteUserDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

function copyLoginLink() {
  void navigator.clipboard.writeText(`${window.location.origin}/login?invited=true`)
  toast.success("Login link copied to clipboard")
}

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { clientId, user } = useAuth()

  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<Role>(ROLE.PRODUCER)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [projectAssignments, setProjectAssignments] = useState<readonly ProjectAssignment[]>([])

  useEffect(() => {
    if (open) {
      setEmail("")
      setDisplayName("")
      setRole(ROLE.PRODUCER)
      setEmailError(null)
      setProjectAssignments([])
    }
  }, [open])

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setEmailError(null)
  }

  const canSubmit = email.trim().length > 0 && !saving

  const handleSubmit = async () => {
    const result = emailSchema.safeParse(email.trim())
    if (!result.success) {
      setEmailError(result.error.issues[0]?.message ?? "Invalid email")
      return
    }

    if (!clientId) {
      toast.error("Missing client scope. Try refreshing, then sign in again.")
      return
    }

    setSaving(true)
    try {
      const projectIds = projectAssignments.map((a) => a.projectId)
      const inviteResult = await inviteOrUpdateUser({
        targetEmail: result.data,
        displayName: displayName.trim() || null,
        role,
        clientId,
        assignToProjects: projectIds.length > 0 ? projectIds : undefined,
      })

      if ("pending" in inviteResult) {
        const projectNote = projectAssignments.length > 0
          ? ` Projects will be assigned when they sign in.`
          : ""
        toast.success(`Invitation created for ${inviteResult.email}`, {
          description: `They'll receive an email with a sign-in link.${projectNote}`,
          duration: 8000,
          action: {
            label: "Copy Login Link",
            onClick: copyLoginLink,
          },
        })
      } else {
        if (projectAssignments.length > 0 && clientId && user) {
          await bulkAddProjectMembers({
            assignments: projectAssignments,
            userId: inviteResult.uid,
            addedBy: user.uid,
            clientId,
          })
        }

        const projectCount = projectAssignments.length
        const desc = projectCount > 0
          ? `Added to ${projectCount} project${projectCount > 1 ? "s" : ""}.`
          : undefined
        toast.success(`Role applied for ${result.data}`, {
          description: desc,
          duration: 6000,
          action: {
            label: "Copy Login Link",
            onClick: copyLoginLink,
          },
        })
      }
      onOpenChange(false)
    } catch (err: unknown) {
      const code = err != null && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : ""

      const friendlyMessages: Record<string, string> = {
        "functions/permission-denied": "You don't have permission to invite users. Contact your system administrator.",
        "functions/unauthenticated": "Your session has expired. Please sign in again.",
        "functions/invalid-argument": "Invalid input. Please check the email and role.",
        "functions/not-found": "The invitation service is not available. Please try again later.",
        "functions/internal": "Something went wrong. Please try again.",
      }

      const message = friendlyMessages[code]
        ?? (err instanceof Error ? err.message : "Failed to send invitation. Please try again.")
      toast.error(message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite User"
      description="Invite a team member by email."
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Saving..." : "Invite"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="user@example.com"
            autoFocus
          />
          {emailError && (
            <p className="text-xs text-[var(--color-error)]">{emailError}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="invite-name">Display Name (optional)</Label>
          <Input
            id="invite-name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Full name"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((r) => (
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

        <ProjectAssignmentPicker
          assignments={projectAssignments}
          onChange={setProjectAssignments}
          defaultRole={role === "admin" ? "producer" : role}
        />
      </div>
    </ResponsiveDialog>
  )
}
