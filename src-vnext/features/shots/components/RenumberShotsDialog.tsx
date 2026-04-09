import { useState, useMemo, useEffect, useRef } from "react"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { previewRenumber, renumberShots, suggestStartNumber } from "@/features/shots/lib/shotNumbering"
import { SORT_LABELS, type SortKey } from "@/features/shots/lib/shotListFilters"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"

const PREVIEW_LIMIT = 10

interface RenumberShotsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly shots: ReadonlyArray<Shot>
  readonly clientId: string | null
  readonly sortKey: SortKey
  readonly sortDir: "asc" | "desc"
  readonly totalShotCount: number
  readonly allShots: ReadonlyArray<Shot>
}

export function RenumberShotsDialog({
  open,
  onOpenChange,
  shots,
  clientId,
  sortKey,
  sortDir,
  totalShotCount,
  allShots,
}: RenumberShotsDialogProps) {
  const [busy, setBusy] = useState(false)
  const [startNumber, setStartNumber] = useState(1)

  // Auto-compute suggested start number only when dialog opens (not on re-renders)
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStartNumber(suggestStartNumber(allShots, shots))
    }
    prevOpen.current = open
  }, [open, allShots, shots])

  const { changes, unchangedCount } = useMemo(
    () => (open ? previewRenumber(shots, startNumber) : { changes: [], unchangedCount: 0 }),
    [open, shots, startNumber],
  )

  const preview = changes.slice(0, PREVIEW_LIMIT)
  const remaining = changes.length - preview.length

  const handleRenumber = async () => {
    if (!clientId || changes.length === 0) return
    setBusy(true)
    try {
      const count = await renumberShots(shots, clientId, startNumber)
      toast.success(`Renumbered ${count} shot${count === 1 ? "" : "s"}`)
      onOpenChange(false)
    } catch (err) {
      toast.error("Failed to renumber shots", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setBusy(false)
    }
  }

  const sortLabel = `${SORT_LABELS[sortKey] ?? "Custom Order"} ${sortDir === "desc" ? "\u2193" : "\u2191"}`

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Renumber Shots</DialogTitle>
          <DialogDescription>
            Reassign sequential shot numbers based on the current display order.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-[var(--color-status-blue-bg)] px-2.5 py-1 text-2xs font-medium text-[var(--color-status-blue-text)]">
            Sorted by: {sortLabel}
          </div>

          {shots.length < totalShotCount && (
            <div className="rounded-md border-l-2 border-l-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] px-3 py-2 text-xs text-[var(--color-status-amber-text)]">
              Renumbering {shots.length} of {totalShotCount} shots. Hidden shots will keep their current numbers.
            </div>
          )}

          <div className="flex items-center gap-2">
            <label htmlFor="renumber-start" className="text-sm text-[var(--color-text)]">
              Start from:
            </label>
            <Input
              id="renumber-start"
              type="number"
              min={1}
              value={startNumber}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!Number.isNaN(val) && val >= 1) {
                  setStartNumber(val)
                }
              }}
              className="w-20 tabular-nums"
            />
          </div>

          {changes.length === 0 ? (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
              All shot numbers are already sequential. Nothing to change.
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-md border border-[var(--color-border)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--color-text-subtle)]">Current</th>
                      <th className="px-3 py-1.5 text-center text-xs text-[var(--color-text-subtle)]">{"\u2192"}</th>
                      <th className="px-3 py-1.5 text-left text-xs font-medium text-[var(--color-text-subtle)]">New</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((c) => (
                      <tr key={c.shotId} className="border-b border-[var(--color-border)] last:border-0">
                        <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{c.currentNumber}</td>
                        <td className="px-3 py-1.5 text-center text-[var(--color-text-subtle)]">{"\u2192"}</td>
                        <td className="px-3 py-1.5 font-medium text-[var(--color-status-blue-text)]">{c.newNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {remaining > 0 && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  {"\u2026"} and {remaining} more
                </div>
              )}

              <div className="text-xs text-[var(--color-text-muted)]">
                {changes.length} shot{changes.length === 1 ? "" : "s"} will be renumbered
                {unchangedCount > 0 ? ` \u00b7 ${unchangedCount} unchanged` : ""}
              </div>

              <div className="rounded-md border-l-2 border-l-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] px-3 py-2 text-xs text-[var(--color-status-amber-text)]">
                This will also update the sort order to match. This action cannot be undone.
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleRenumber} disabled={busy || changes.length === 0}>
            {busy ? "Renumbering\u2026" : `Renumber ${changes.length} Shot${changes.length === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
