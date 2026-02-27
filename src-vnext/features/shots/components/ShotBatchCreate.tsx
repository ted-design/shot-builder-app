import { useState } from "react"
import { Popover, PopoverContent, PopoverAnchor } from "@/ui/popover"
import { Textarea } from "@/ui/textarea"
import { Button } from "@/ui/button"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShotBatchCreateProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onBatchCreate: (titles: readonly string[]) => Promise<void>
  readonly creating: boolean
  readonly children?: React.ReactNode
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PLACEHOLDER = [
  "Hero \u2014 Red Dress",
  "Flat Lay \u2014 White Tee",
  "Close-Up \u2014 Ring Detail",
  "Lifestyle \u2014 Poolside",
  "Group \u2014 Summer Basics",
].join("\n")

function parseLines(text: string): readonly string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function countLabel(count: number): string {
  if (count === 1) return "1 shot to create"
  return `${count} shots to create`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotBatchCreate({
  open,
  onOpenChange,
  onBatchCreate,
  creating,
  children,
}: ShotBatchCreateProps) {
  const [text, setText] = useState("")

  const lines = parseLines(text)
  const count = lines.length
  const canCreate = count > 0 && !creating

  const handleCreate = () => {
    if (!canCreate) return
    void onBatchCreate(lines).then(() => {
      setText("")
    })
  }

  const handleCancel = () => {
    setText("")
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      {children && <PopoverAnchor asChild>{children}</PopoverAnchor>}
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[var(--radix-popover-trigger-width,100%)] min-w-[320px] max-w-[560px] rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-2.5">
          <p className="text-sm font-semibold text-[var(--color-text)]">
            Batch create shots
          </p>
          <p className="text-xs text-[var(--color-text-muted)]">
            Paste or type one title per line. Each line becomes a new shot.
          </p>
        </div>

        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER}
          rows={6}
          className="min-h-[140px] resize-y border-[var(--color-border)] bg-transparent text-xs leading-relaxed text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus-visible:border-[var(--color-primary)] focus-visible:ring-0"
          autoFocus
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-muted)]">
            {countLabel(count)}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" disabled={!canCreate} onClick={handleCreate}>
              Create all
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
