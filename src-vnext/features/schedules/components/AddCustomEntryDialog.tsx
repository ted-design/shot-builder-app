import { useEffect, useMemo, useState } from "react"
import { Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { Button } from "@/ui/button"
import { Label } from "@/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { ScheduleEntryHighlight, ScheduleTrack } from "@/shared/types"

const SHARED_TRACK_ID = "shared"
const DEFAULT_COLOR = "#2563eb"

const COLOR_PRESETS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#d946ef",
  "#dc2626",
  "#0f172a",
] as const

const EMOJI_PRESETS = [
  "✨",
  "🎬",
  "🎥",
  "📍",
  "⏰",
  "☕",
  "🚚",
  "⚠️",
  "✅",
  "🧵",
  "💄",
  "👗",
] as const

interface AddCustomEntryDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly tracks: readonly ScheduleTrack[]
  readonly defaultTrackId?: string
  readonly onAdd: (input: {
    readonly title: string
    readonly description: string
    readonly trackId: string
    readonly highlight: ScheduleEntryHighlight
  }) => void
}

export function AddCustomEntryDialog({
  open,
  onOpenChange,
  tracks,
  defaultTrackId,
  onAdd,
}: AddCustomEntryDialogProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [emoji, setEmoji] = useState("")
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "primary")
  const [variant, setVariant] = useState<ScheduleEntryHighlight["variant"]>("solid")
  const [color, setColor] = useState(DEFAULT_COLOR)

  useEffect(() => {
    if (!open) return
    setTitle("")
    setDescription("")
    setEmoji("")
    setVariant("solid")
    setColor(DEFAULT_COLOR)
    if (defaultTrackId === SHARED_TRACK_ID) {
      setTrackId(SHARED_TRACK_ID)
      return
    }
    const nextTrack = defaultTrackId && tracks.some((track) => track.id === defaultTrackId)
      ? defaultTrackId
      : (tracks[0]?.id ?? "primary")
    setTrackId(nextTrack)
  }, [defaultTrackId, open, tracks])

  const isShared = trackId === SHARED_TRACK_ID

  const trackLabel = useMemo(() => {
    if (isShared) return "Shared"
    return tracks.find((track) => track.id === trackId)?.name ?? "Track"
  }, [isShared, trackId, tracks])

  function handleSubmit() {
    const finalTitle = title.trim() || "Highlight"
    const finalDescription = description.trim()
    const finalEmoji = emoji.trim() || null
    onAdd({
      title: finalTitle,
      description: finalDescription,
      trackId,
      highlight: {
        variant,
        color,
        emoji: finalEmoji,
      },
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Highlight Block</DialogTitle>
          <DialogDescription>
            Create a styled block with title and description for beats, reminders, or timing notes.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!isShared && tracks.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-entry-track">Track</Label>
              <Select value={trackId} onValueChange={setTrackId}>
                <SelectTrigger id="custom-entry-track">
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  {tracks.map((track) => (
                    <SelectItem key={track.id} value={track.id}>
                      {track.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isShared && (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
              Adding to <span className="font-semibold text-[var(--color-text)]">{trackLabel}</span> (visible across tracks).
            </div>
          )}

          <div className="grid grid-cols-[72px_1fr] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-entry-emoji">Emoji</Label>
              <Input
                id="custom-entry-emoji"
                value={emoji}
                onChange={(event) => setEmoji(event.target.value)}
                placeholder="✨"
                className="text-center"
                maxLength={4}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-entry-title">Title</Label>
              <Input
                id="custom-entry-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Bold heading"
                onKeyDown={(event) => {
                  if (event.key === "Enter") handleSubmit()
                }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Emoji Presets</Label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setEmoji(preset)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border text-base transition-colors ${
                    emoji === preset
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]"
                      : "border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]"
                  }`}
                  aria-label={`Use emoji ${preset}`}
                  title={preset}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="custom-entry-description">Description</Label>
            <Textarea
              id="custom-entry-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Regular sub-heading / details"
              className="min-h-[96px]"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>Style</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setVariant("solid")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    variant === "solid"
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Solid
                </button>
                <button
                  type="button"
                  onClick={() => setVariant("outline")}
                  className={`flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    variant === "outline"
                      ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)] text-[var(--color-primary)]"
                      : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)]"
                  }`}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Outline
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-entry-color">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="custom-entry-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-9 w-12 p-1"
                />
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      className={`h-6 w-6 rounded border ${color === preset ? "border-[var(--color-text)]" : "border-[var(--color-border)]"}`}
                      style={{ backgroundColor: preset }}
                      aria-label={`Set highlight color ${preset}`}
                      title={preset}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>
            Add Highlight
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
