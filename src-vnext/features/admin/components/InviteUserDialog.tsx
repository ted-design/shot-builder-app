import { useState, useEffect } from "react"
import { z } from "zod"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { ROLE, roleLabel } from "@/shared/lib/rbac"
import { inviteOrUpdateUser } from "@/features/admin/lib/adminWrites"
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

export function InviteUserDialog({ open, onOpenChange }: InviteUserDialogProps) {
  const { clientId } = useAuth()

  const [email, setEmail] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [role, setRole] = useState<Role>(ROLE.PRODUCER)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail("")
      setDisplayName("")
      setRole(ROLE.PRODUCER)
      setEmailError(null)
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
      await inviteOrUpdateUser({
        targetEmail: result.data,
        displayName: displayName.trim() || null,
        role,
        clientId,
      })

      toast.success(`Role applied for ${result.data}`)
      onOpenChange(false)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("user-not-found") || message.includes("USER_NOT_FOUND")) {
        toast.error("User must sign in once before being assigned a role")
      } else {
        toast.error(message)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Invite User"
      description="Assign a role to a team member. They must have signed in at least once."
      contentClassName="sm:max-w-md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? "Saving..." : "Apply Role"}
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
        </div>
      </div>
    </ResponsiveDialog>
  )
}
