import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useAuth } from "@/app/providers/AuthProvider"
import { createLocation } from "@/features/library/lib/locationWrites"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"
import { Textarea } from "@/ui/textarea"

interface CreateLocationDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

const INITIAL_FORM = {
  name: "",
  street: "",
  unit: "",
  city: "",
  province: "",
  postal: "",
  phone: "",
  notes: "",
}

type FormKey = keyof typeof INITIAL_FORM

export function CreateLocationDialog({
  open,
  onOpenChange,
}: CreateLocationDialogProps) {
  const { clientId, user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState(INITIAL_FORM)
  const [saving, setSaving] = useState(false)

  const setField = (field: FormKey, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleOpenChange = (next: boolean) => {
    if (next) setForm(INITIAL_FORM)
    onOpenChange(next)
  }

  const handleCreate = async () => {
    const trimmedName = form.name.trim()
    if (!trimmedName || !clientId) return

    setSaving(true)
    try {
      const newId = await createLocation({
        clientId,
        userId: user?.uid ?? null,
        name: trimmedName,
        street: form.street || null,
        unit: form.unit || null,
        city: form.city || null,
        province: form.province || null,
        postal: form.postal || null,
        phone: form.phone || null,
        notes: form.notes || null,
      })

      toast.success("Location created")
      onOpenChange(false)
      setForm(INITIAL_FORM)
      navigate(`/library/locations/${newId}`)
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create location",
      )
    } finally {
      setSaving(false)
    }
  }

  const field = (id: string, key: FormKey, label: string, placeholder?: string) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={form[key]}
        onChange={(e) => setField(key, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Create Location"
      description="Add a new location to the library."
      contentClassName="sm:max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!form.name.trim() || saving}>
            {saving ? "Creating..." : "Create"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="location-name">Name</Label>
          <Input
            id="location-name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Studio A — Downtown"
            autoFocus
          />
        </div>

        {field("location-street", "street", "Street Address", "123 Main St")}
        {field("location-unit", "unit", "Unit / Suite", "Suite 200")}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {field("location-city", "city", "City")}
          {field("location-province", "province", "Province")}
        </div>

        {field("location-postal", "postal", "Postal Code")}
        {field("location-phone", "phone", "Phone", "(555) 123-4567")}

        <div className="flex flex-col gap-2">
          <Label htmlFor="location-notes">Notes</Label>
          <Textarea
            id="location-notes"
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder="Parking info, access codes, etc."
            rows={3}
          />
        </div>
      </div>
    </ResponsiveDialog>
  )
}
