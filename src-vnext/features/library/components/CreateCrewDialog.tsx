import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { createCrewMember } from "@/features/library/lib/crewWrites"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"

interface CreateCrewDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

export function CreateCrewDialog({ open, onOpenChange }: CreateCrewDialogProps) {
  const { clientId, user } = useAuth()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setCompany("")
      setNotes("")
    }
  }, [open])

  const canSubmit = !!(firstName.trim() || lastName.trim()) && !saving

  const handleCreate = async () => {
    if (!canSubmit) return
    if (!clientId) {
      toast.error("Missing client scope. Try refreshing, then sign in again.")
      return
    }

    setSaving(true)
    try {
      const newId = await createCrewMember({
        clientId,
        userId: user?.uid ?? null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        company: company.trim() || null,
        notes: notes.trim() || null,
      })

      toast.success("Crew member created")
      onOpenChange(false)
      navigate(`/library/crew/${newId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create crew member")
    } finally {
      setSaving(false)
    }
  }

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add Crew Member"
      description="Add a new crew member to your library."
      contentClassName="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="crew-first-name">First Name</Label>
            <Input
              id="crew-first-name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              autoFocus
              data-testid="crew-first-name-input"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="crew-last-name">Last Name</Label>
            <Input
              id="crew-last-name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              data-testid="crew-last-name-input"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="crew-email">Email</Label>
          <Input
            id="crew-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="crew-phone">Phone</Label>
          <Input
            id="crew-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="crew-company">Company</Label>
          <Input
            id="crew-company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Company or agency"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="crew-notes">Notes</Label>
          <Textarea
            id="crew-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional notes..."
            rows={3}
          />
        </div>
      </div>
    </ResponsiveDialog>
  )
}
