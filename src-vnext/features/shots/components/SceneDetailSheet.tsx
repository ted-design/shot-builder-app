import { useCallback, useEffect, useRef, useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/ui/sheet"
import { Input } from "@/ui/input"
import { Textarea } from "@/ui/textarea"
import { SCENE_COLORS, getSceneColor } from "@/features/shots/components/SceneHeader"
import { updateLane, type LanePatch } from "@/features/shots/lib/laneActions"
import { toast } from "sonner"
import type { Lane } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SceneDetailSheetProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly lane: Lane | null
  readonly projectId: string
  readonly clientId: string | null
  readonly shotCount?: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DIRECTION_CHARS = 500
const MAX_NOTES_CHARS = 5000

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SceneDetailSheet({
  open,
  onOpenChange,
  lane,
  projectId,
  clientId,
  shotCount,
}: SceneDetailSheetProps) {
  // Local state for form fields
  const [name, setName] = useState("")
  const [sceneNumber, setSceneNumber] = useState("")
  const [direction, setDirection] = useState("")
  const [notes, setNotes] = useState("")

  // Sync local state when sheet opens for a DIFFERENT lane.
  // Gate via initKey so Firestore snapshot echoes (same lane.id, new object ref) don't
  // clobber in-progress edits. Resets when sheet closes so next open re-initializes.
  const initKeyRef = useRef<string | null>(null)
  useEffect(() => {
    if (!open) {
      initKeyRef.current = null
      return
    }
    if (lane && initKeyRef.current !== lane.id) {
      initKeyRef.current = lane.id
      setName(lane.name)
      setSceneNumber(lane.sceneNumber != null ? String(lane.sceneNumber) : "")
      setDirection(lane.direction ?? "")
      setNotes(lane.notes ?? "")
    }
  }, [lane, open])

  const savePatch = useCallback(
    async (patch: LanePatch) => {
      if (!lane || !clientId) return
      try {
        await updateLane({
          laneId: lane.id,
          projectId,
          clientId,
          patch,
        })
        toast.success("Scene updated")
      } catch {
        toast.error("Failed to update scene")
      }
    },
    [lane, projectId, clientId],
  )

  const handleNameBlur = useCallback(() => {
    if (!lane) return
    const trimmed = name.trim()
    if (trimmed && trimmed !== lane.name) {
      savePatch({ name: trimmed })
    }
  }, [name, lane, savePatch])

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [],
  )

  const handleSceneNumberBlur = useCallback(() => {
    if (!lane) return
    const trimmed = sceneNumber.trim()
    if (!trimmed) {
      if (lane.sceneNumber !== undefined) {
        savePatch({ sceneNumber: null })
      }
      return
    }
    const parsed = parseInt(trimmed, 10)
    if (!Number.isFinite(parsed) || parsed < 0 || String(parsed) !== trimmed) {
      toast.error("Scene number must be a non-negative integer")
      setSceneNumber(lane.sceneNumber != null ? String(lane.sceneNumber) : "")
      return
    }
    if (parsed !== lane.sceneNumber) {
      savePatch({ sceneNumber: parsed })
    }
  }, [sceneNumber, lane, savePatch])

  const handleSceneNumberKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        ;(e.target as HTMLInputElement).blur()
      }
    },
    [],
  )

  const handleColorSelect = useCallback(
    (colorKey: string) => {
      savePatch({ color: colorKey })
    },
    [savePatch],
  )

  const handleDirectionChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setDirection(e.target.value.slice(0, MAX_DIRECTION_CHARS))
    },
    [],
  )

  const handleDirectionBlur = useCallback(() => {
    if (!lane) return
    const current = lane.direction ?? ""
    if (direction !== current) {
      savePatch({ direction: direction || null })
    }
  }, [direction, lane, savePatch])

  const handleNotesBlur = useCallback(() => {
    if (!lane) return
    const current = lane.notes ?? ""
    if (notes !== current) {
      savePatch({ notes: notes || null })
    }
  }, [notes, lane, savePatch])

  if (!lane) return null

  const resolvedColor = getSceneColor(lane.color)
  const displayShotCount = shotCount ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] sm:max-w-[380px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ background: resolvedColor }}
            />
            Scene Details
          </SheetTitle>
          <SheetDescription className="sr-only">
            Edit scene properties including name, number, color, direction, and notes.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5 mt-4">
          {/* Scene Name */}
          <div>
            <label className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 block">
              Scene Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              placeholder="e.g., Beach Lifestyle"
              data-testid="scene-name-input"
            />
          </div>

          {/* Scene Number */}
          <div>
            <label className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 block">
              Scene Number
            </label>
            <Input
              type="number"
              value={sceneNumber}
              onChange={(e) => setSceneNumber(e.target.value)}
              onBlur={handleSceneNumberBlur}
              onKeyDown={handleSceneNumberKeyDown}
              placeholder="e.g., 1"
              min={0}
              data-testid="scene-number-input"
            />
          </div>

          {/* Color Picker */}
          <div>
            <label className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 block">
              Color
            </label>
            <div className="flex gap-2" data-testid="scene-color-picker">
              {SCENE_COLORS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleColorSelect(c.key)}
                  className={`h-7 w-7 rounded-full transition-all ${
                    lane.color === c.key
                      ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--color-surface)]"
                      : "hover:scale-110"
                  }`}
                  style={{ background: c.hex }}
                  aria-label={`Color ${c.key}`}
                  data-testid={`scene-color-${c.key}`}
                />
              ))}
            </div>
          </div>

          {/* Creative Direction */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Creative Direction
              </label>
              <span className="text-3xs text-[var(--color-text-subtle)]">
                {direction.length}/{MAX_DIRECTION_CHARS}
              </span>
            </div>
            <Textarea
              value={direction}
              onChange={handleDirectionChange}
              onBlur={handleDirectionBlur}
              rows={3}
              maxLength={MAX_DIRECTION_CHARS}
              placeholder="Mood, lighting, style notes..."
              className="resize-none text-sm"
              data-testid="scene-direction-textarea"
            />
          </div>

          {/* Production Notes */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                Production Notes
              </label>
              <span className="text-3xs text-[var(--color-text-subtle)]">
                {notes.length}/{MAX_NOTES_CHARS}
              </span>
            </div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, MAX_NOTES_CHARS))}
              onBlur={handleNotesBlur}
              rows={5}
              maxLength={MAX_NOTES_CHARS}
              placeholder="Setup, timing, special requirements..."
              className="resize-none text-sm"
              data-testid="scene-notes-textarea"
            />
          </div>

          {/* Shot count */}
          <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] pt-1 border-t border-[var(--color-border)]">
            <span className="font-medium">{displayShotCount}</span>
            <span>{displayShotCount === 1 ? "shot" : "shots"} in this scene</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
