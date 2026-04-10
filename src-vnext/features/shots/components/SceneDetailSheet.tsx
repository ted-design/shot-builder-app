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
import { SCENE_COLORS, getSceneColor } from "@/features/shots/lib/sceneColors"
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
const MAX_SCENE_NUMBER = 9999

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
    // Scene number cannot be cleared — every lane has one (auto-incremented at
    // creation, backfilled at read time for legacy lanes). If the user empties
    // the field, revert to the stored value.
    if (!trimmed) {
      setSceneNumber(lane.sceneNumber != null ? String(lane.sceneNumber) : "")
      return
    }
    const parsed = Number(trimmed)
    // Scene numbers must be positive integers (1..9999). Scene 0 would produce shot
    // numbers like "0A", "0B" which sort before Scene 1. An upper bound prevents
    // absurd values like "99999A" that would overflow table columns and PDFs.
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_SCENE_NUMBER) {
      toast.error(`Scene number must be a whole number between 1 and ${MAX_SCENE_NUMBER}`)
      setSceneNumber(lane.sceneNumber != null ? String(lane.sceneNumber) : "")
      return
    }
    if (parsed !== lane.sceneNumber) {
      savePatch({ sceneNumber: parsed })
      // Reflect the normalized value back into the input (e.g., "01" → "1")
      setSceneNumber(String(parsed))
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
      // maxLength on the textarea enforces the limit at the browser boundary.
      setDirection(e.target.value)
    },
    [],
  )

  const handleNotesChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // maxLength on the textarea enforces the limit at the browser boundary.
      setNotes(e.target.value)
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
            <label
              htmlFor="scene-detail-name"
              className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 block"
            >
              Scene Name
            </label>
            <Input
              id="scene-detail-name"
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
            <label
              htmlFor="scene-detail-number"
              className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 block"
            >
              Scene Number
            </label>
            <Input
              id="scene-detail-number"
              type="number"
              value={sceneNumber}
              onChange={(e) => setSceneNumber(e.target.value)}
              onBlur={handleSceneNumberBlur}
              onKeyDown={handleSceneNumberKeyDown}
              placeholder="e.g., 1"
              min={1}
              max={MAX_SCENE_NUMBER}
              data-testid="scene-number-input"
            />
          </div>

          {/* Color Picker — fieldset/legend for an accessible group label */}
          <fieldset>
            <legend className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5 block">
              Color
            </legend>
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
                  aria-pressed={lane.color === c.key}
                  data-testid={`scene-color-${c.key}`}
                />
              ))}
            </div>
          </fieldset>

          {/* Creative Direction */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="scene-detail-direction"
                className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                Creative Direction
              </label>
              <span className="text-3xs text-[var(--color-text-subtle)]">
                {direction.length}/{MAX_DIRECTION_CHARS}
              </span>
            </div>
            <Textarea
              id="scene-detail-direction"
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
              <label
                htmlFor="scene-detail-notes"
                className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
              >
                Production Notes
              </label>
              <span className="text-3xs text-[var(--color-text-subtle)]">
                {notes.length}/{MAX_NOTES_CHARS}
              </span>
            </div>
            <Textarea
              id="scene-detail-notes"
              value={notes}
              onChange={handleNotesChange}
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
