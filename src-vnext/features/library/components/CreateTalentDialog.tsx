import { useState } from "react"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Button } from "@/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { SELECT_NONE } from "@/features/library/components/talentUtils"

export interface CreateTalentFields {
  readonly name: string
  readonly agency: string
  readonly email: string
  readonly phone: string
  readonly gender: string
  readonly url: string
  readonly notes: string
}

interface CreateTalentDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly busy: boolean
  readonly onSubmit: (fields: CreateTalentFields) => Promise<boolean>
}

export function CreateTalentDialog({
  open,
  onOpenChange,
  busy,
  onSubmit,
}: CreateTalentDialogProps) {
  const [createName, setCreateName] = useState("")
  const [createAgency, setCreateAgency] = useState("")
  const [createEmail, setCreateEmail] = useState("")
  const [createPhone, setCreatePhone] = useState("")
  const [createGender, setCreateGender] = useState<string>("")
  const [createUrl, setCreateUrl] = useState("")
  const [createNotes, setCreateNotes] = useState("")

  const resetForm = () => {
    setCreateName("")
    setCreateAgency("")
    setCreateEmail("")
    setCreatePhone("")
    setCreateUrl("")
    setCreateGender("")
    setCreateNotes("")
  }

  const handleSubmit = async () => {
    const ok = await onSubmit({
      name: createName,
      agency: createAgency,
      email: createEmail,
      phone: createPhone,
      gender: createGender,
      url: createUrl,
      notes: createNotes,
    })
    if (ok) resetForm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create talent</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <div className="label-meta">
              Name
            </div>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Full name"
              disabled={busy}
            />
          </div>
          <div>
            <div className="label-meta">
              Agency
            </div>
            <Input
              value={createAgency}
              onChange={(e) => setCreateAgency(e.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </div>
          <div>
            <div className="label-meta">
              Gender
            </div>
            <Select
              value={createGender || SELECT_NONE}
              onValueChange={(next) => setCreateGender(next === SELECT_NONE ? "" : next)}
              disabled={busy}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELECT_NONE}>—</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="non-binary">Non-binary</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="label-meta">
              Email
            </div>
            <Input
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </div>
          <div>
            <div className="label-meta">
              Phone
            </div>
            <Input
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="label-meta">
              Reference URL
            </div>
            <Input
              value={createUrl}
              onChange={(e) => setCreateUrl(e.target.value)}
              placeholder="Optional"
              disabled={busy}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="label-meta">
              Notes
            </div>
            <Textarea
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              placeholder="Optional"
              disabled={busy}
              className="mt-1 min-h-[120px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? "Creating..." : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
