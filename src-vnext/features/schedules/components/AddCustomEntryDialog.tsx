import { useEffect, useState } from "react"
import { Coffee, Truck, Wrench, StickyNote } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { ScheduleEntryType } from "@/shared/types"
import type { ScheduleTrack } from "@/shared/types"

type CustomEntryType = Exclude<ScheduleEntryType, "shot">

const CUSTOM_TYPES: readonly {
  readonly value: CustomEntryType
  readonly label: string
  readonly icon: typeof Wrench
  readonly defaultTitle: string
}[] = [
  { value: "setup", label: "Setup", icon: Wrench, defaultTitle: "Setup" },
  { value: "break", label: "Break", icon: Coffee, defaultTitle: "Break" },
  { value: "move", label: "Move", icon: Truck, defaultTitle: "Company Move" },
  { value: "banner", label: "Banner", icon: StickyNote, defaultTitle: "Note" },
]

interface AddCustomEntryDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly tracks: readonly ScheduleTrack[]
  readonly defaultTrackId?: string
  readonly defaultType?: CustomEntryType
  readonly onAdd: (type: CustomEntryType, title: string, trackId: string) => void
}

export function AddCustomEntryDialog({
  open,
  onOpenChange,
  tracks,
  defaultTrackId,
  defaultType,
  onAdd,
}: AddCustomEntryDialogProps) {
  const [selectedType, setSelectedType] = useState<CustomEntryType>("setup")
  const [title, setTitle] = useState("")
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "primary")

  useEffect(() => {
    if (!open) return
    if (defaultType) setSelectedType(defaultType)
    const next = defaultTrackId && tracks.some((t) => t.id === defaultTrackId)
      ? defaultTrackId
      : (tracks[0]?.id ?? "primary")
    setTrackId(next)
  }, [defaultTrackId, defaultType, open, tracks])

  function handleSubmit() {
    const selected = CUSTOM_TYPES.find((t) => t.value === selectedType)
    const finalTitle = title.trim() || selected?.defaultTitle || selectedType
    onAdd(selectedType, finalTitle, selectedType === "banner" ? "primary" : trackId)
    setTitle("")
    setSelectedType("setup")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add custom entry</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Type selector */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-[var(--color-text-muted)]">
              Type
            </Label>
            <div className="flex gap-2">
              {CUSTOM_TYPES.map((t) => {
                const Icon = t.icon
                const isSelected = selectedType === t.value
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setSelectedType(t.value)}
                    className={`flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1 ${
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          {tracks.length > 1 && selectedType !== "banner" && (
            <div className="flex flex-col gap-2">
              <Label className="text-xs font-medium text-[var(--color-text-muted)]">
                Track
              </Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-title" className="text-xs font-medium text-[var(--color-text-muted)]">
              Title
            </Label>
            <Input
              id="entry-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={CUSTOM_TYPES.find((t) => t.value === selectedType)?.defaultTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSubmit()
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
