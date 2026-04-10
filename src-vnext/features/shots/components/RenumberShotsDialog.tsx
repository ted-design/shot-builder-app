import { useState, useMemo, useEffect, useRef, type ReactElement } from "react"
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
import {
  MAX_SHOTS_PER_SCENE,
  parseSceneShotNumber,
  previewRenumber,
  previewRenumberWithScenes,
  renumberShots,
  renumberShotsWithScenes,
  suggestStartNumber,
} from "@/features/shots/lib/shotNumbering"
import { SORT_LABELS, type SortKey, type GroupKey } from "@/features/shots/lib/shotListFilters"
import { getSceneColor } from "@/features/shots/lib/sceneColors"
import { toast } from "sonner"
import type { Shot, Lane } from "@/shared/types"

const PREVIEW_LIMIT = 10

type RenumberMode = "sequential" | "byScene"

interface RenumberShotsDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly shots: ReadonlyArray<Shot>
  readonly clientId: string | null
  readonly sortKey: SortKey
  readonly sortDir: "asc" | "desc"
  readonly totalShotCount: number
  readonly allShots: ReadonlyArray<Shot>
  readonly lanes?: ReadonlyArray<Lane>
  readonly groupKey?: GroupKey
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
  lanes,
  groupKey,
}: RenumberShotsDialogProps) {
  const [busy, setBusy] = useState(false)
  const [startNumber, setStartNumber] = useState(1)
  const [mode, setMode] = useState<RenumberMode>("sequential")

  const hasScenes = (lanes?.length ?? 0) > 0

  // Detect shots currently using scene letter suffixes — sequential renumber would destroy these
  const sceneNumberedCount = useMemo(
    () => shots.filter((s) => s.shotNumber && parseSceneShotNumber(s.shotNumber).suffix != null).length,
    [shots],
  )

  // Detect scenes that exceed the A..ZZ letter capacity — these would fail in
  // renumberShotsWithScenes' overflow guard. Surface a preview warning so users
  // see the problem before clicking Renumber.
  const overflowScenes = useMemo(() => {
    if (!lanes) return [] as ReadonlyArray<{ name: string; count: number }>
    return lanes
      .map((lane) => ({
        name: lane.name,
        count: shots.filter((s) => s.laneId === lane.id).length,
      }))
      .filter((g) => g.count > MAX_SHOTS_PER_SCENE)
  }, [lanes, shots])

  // Auto-compute suggested start number and set mode when dialog opens
  const prevOpen = useRef(false)
  useEffect(() => {
    if (open && !prevOpen.current) {
      setStartNumber(suggestStartNumber(allShots, shots))
      setMode(hasScenes && groupKey === "scene" ? "byScene" : "sequential")
    }
    prevOpen.current = open
  }, [open, allShots, shots, hasScenes, groupKey])

  // Build scene groups for preview/execution
  const { sceneGroups, ungroupedShots, maxSceneNumberAcrossProject } = useMemo(() => {
    if (!lanes || lanes.length === 0) {
      return {
        sceneGroups: [],
        ungroupedShots: [] as readonly Shot[],
        maxSceneNumberAcrossProject: 0,
      }
    }

    const groups = lanes
      .filter((l) => l.sceneNumber != null)
      .sort((a, b) => (a.sceneNumber ?? 0) - (b.sceneNumber ?? 0))
      .map((lane) => ({
        sceneId: lane.id,
        sceneNumber: lane.sceneNumber!,
        sceneName: lane.name,
        color: lane.color,
        shots: shots.filter((s) => s.laneId === lane.id),
      }))
      .filter((g) => g.shots.length > 0)

    const laneIds = new Set(lanes.map((l) => l.id))
    const ungrouped = shots.filter((s) => !s.laneId || !laneIds.has(s.laneId))

    // Compute max across ALL lanes (not just visible). This guards against
    // cross-filter collisions: if a filter hides scene 5 entirely, the visible
    // scenes' max would drop and ungrouped numbering would collide with the
    // still-stored "5A", "5B" shot numbers from the hidden scene.
    const maxSceneNumberAcrossProject = lanes.reduce(
      (max, l) => (l.sceneNumber != null && l.sceneNumber > max ? l.sceneNumber : max),
      0,
    )

    return { sceneGroups: groups, ungroupedShots: ungrouped, maxSceneNumberAcrossProject }
  }, [lanes, shots])

  // Preview: sequential or by-scene
  const { changes, unchangedCount } = useMemo(() => {
    if (!open) return { changes: [] as readonly { shotId: string; title: string; currentNumber: string; newNumber: string; sceneName: string; sceneId: string }[], unchangedCount: 0 }
    if (mode === "byScene" && sceneGroups.length > 0) {
      return previewRenumberWithScenes(sceneGroups, ungroupedShots, maxSceneNumberAcrossProject)
    }
    // Sequential mode — wrap changes to include empty sceneName/sceneId for type consistency
    const seq = previewRenumber(shots, startNumber)
    return {
      changes: seq.changes.map((c) => ({ ...c, sceneName: "", sceneId: "" })),
      unchangedCount: seq.unchangedCount,
    }
  }, [open, mode, shots, startNumber, sceneGroups, ungroupedShots, maxSceneNumberAcrossProject])

  const handleRenumber = async () => {
    if (!clientId || changes.length === 0) return
    setBusy(true)
    try {
      let count: number
      if (mode === "byScene" && sceneGroups.length > 0) {
        count = await renumberShotsWithScenes(
          sceneGroups,
          ungroupedShots,
          clientId,
          maxSceneNumberAcrossProject,
        )
      } else {
        count = await renumberShots(shots, clientId, startNumber)
      }
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
            {mode === "byScene"
              ? "Assign scene-based shot numbers (1A, 1B\u2026) using scene order."
              : "Reassign sequential shot numbers based on the current display order."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-[var(--color-status-blue-bg)] px-2.5 py-1 text-2xs font-medium text-[var(--color-status-blue-text)]">
            Sorted by: {sortLabel}
          </div>

          {hasScenes && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-[var(--color-text)]">Mode</span>
              <div className="flex rounded-md border border-[var(--color-border)] overflow-hidden">
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-medium transition-colors ${
                    mode === "sequential"
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-text)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => setMode("sequential")}
                >
                  Sequential
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 text-xs font-medium transition-colors border-l border-[var(--color-border)] ${
                    mode === "byScene"
                      ? "bg-[var(--color-primary)] text-[var(--color-primary-text)]"
                      : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                  }`}
                  onClick={() => setMode("byScene")}
                >
                  By Scene
                </button>
              </div>
            </div>
          )}

          {shots.length < totalShotCount && (
            <div className="rounded-md border-l-2 border-l-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] px-3 py-2 text-xs text-[var(--color-status-amber-text)]">
              Renumbering {shots.length} of {totalShotCount} shots. Hidden shots will keep their current numbers.
            </div>
          )}

          {mode === "sequential" && sceneNumberedCount > 0 && (
            <div className="rounded-md border-l-2 border-l-[var(--color-status-amber-border)] bg-[var(--color-status-amber-bg)] px-3 py-2 text-xs text-[var(--color-status-amber-text)]">
              {sceneNumberedCount} shot{sceneNumberedCount === 1 ? " has" : "s have"} scene letter suffixes (e.g., 1A, 2B). Sequential mode will replace them with flat numbers.
            </div>
          )}

          {mode === "byScene" && overflowScenes.length > 0 && (
            <div className="rounded-md border-l-2 border-l-[var(--color-status-red-border)] bg-[var(--color-status-red-bg)] px-3 py-2 text-xs text-[var(--color-status-red-text)]">
              {overflowScenes.length === 1
                ? `Scene "${overflowScenes[0]!.name}" has ${overflowScenes[0]!.count} shots, exceeding the per-scene limit of ${MAX_SHOTS_PER_SCENE} (A..ZZ).`
                : `${overflowScenes.length} scenes exceed the per-scene limit of ${MAX_SHOTS_PER_SCENE} shots (A..ZZ).`}
              {" "}Renumbering will fail until you split or shrink these scenes.
            </div>
          )}

          {mode === "sequential" && (
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
          )}

          {changes.length === 0 ? (
            <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text-muted)]">
              All shot numbers are already {mode === "byScene" ? "scene-aligned" : "sequential"}. Nothing to change.
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
                    {mode === "byScene" ? (
                      <ScenePreviewRows
                        changes={changes}
                        sceneGroups={sceneGroups}
                        ungroupedShots={ungroupedShots}
                        previewLimit={PREVIEW_LIMIT}
                      />
                    ) : (
                      changes.slice(0, PREVIEW_LIMIT).map((c) => (
                        <tr key={c.shotId} className="border-b border-[var(--color-border)] last:border-0">
                          <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{c.currentNumber}</td>
                          <td className="px-3 py-1.5 text-center text-[var(--color-text-subtle)]">{"\u2192"}</td>
                          <td className="px-3 py-1.5 font-medium text-[var(--color-status-blue-text)]">{c.newNumber}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {mode === "sequential" && changes.length > PREVIEW_LIMIT && (
                <div className="text-xs text-[var(--color-text-muted)]">
                  {"\u2026"} and {changes.length - PREVIEW_LIMIT} more
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

// ---------------------------------------------------------------------------
// Scene preview rows — grouped by scene with headers
// ---------------------------------------------------------------------------

interface ScenePreviewRowsProps {
  readonly changes: ReadonlyArray<{
    readonly shotId: string
    readonly currentNumber: string
    readonly newNumber: string
    readonly sceneName: string
    readonly sceneId: string
  }>
  readonly sceneGroups: ReadonlyArray<{
    readonly sceneId: string
    readonly sceneNumber: number
    readonly sceneName: string
    readonly color?: string
  }>
  readonly ungroupedShots: ReadonlyArray<Shot>
  readonly previewLimit: number
}

type PreviewRow = ReactElement

function buildScenePreviewRowsState(
  changes: ScenePreviewRowsProps["changes"],
  sceneGroups: ScenePreviewRowsProps["sceneGroups"],
  ungroupedShots: ReadonlyArray<Shot>,
  previewLimit: number,
): ReadonlyArray<PreviewRow> {
  // Phase 1: scene groups. Track running count via reduce, building rows immutably.
  const scenePhase = sceneGroups.reduce<{ rows: ReadonlyArray<PreviewRow>; rendered: number }>(
    (acc, group) => {
      if (acc.rendered >= previewLimit) return acc
      // Filter by stable sceneId to avoid name-collision bugs.
      const groupChanges = changes.filter((c) => c.sceneId === group.sceneId)
      if (groupChanges.length === 0) return acc

      const visible = groupChanges.slice(0, previewLimit - acc.rendered)
      const header: PreviewRow = (
        <tr key={`header-${group.sceneId}`} className="bg-[var(--color-surface-subtle)]">
          <td colSpan={3} className="px-3 py-1.5 text-xs font-medium text-[var(--color-text)]">
            <span
              className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
              style={{ backgroundColor: getSceneColor(group.color) }}
            />
            {"Scene "}
            {group.sceneNumber}
            {" \u2014 "}
            {group.sceneName}
          </td>
        </tr>
      )
      const changeRows: ReadonlyArray<PreviewRow> = visible.map((c) => (
        <tr key={c.shotId} className="border-b border-[var(--color-border)] last:border-0">
          <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{c.currentNumber}</td>
          <td className="px-3 py-1.5 text-center text-[var(--color-text-subtle)]">{"\u2192"}</td>
          <td className="px-3 py-1.5 font-medium text-[var(--color-status-blue-text)]">{c.newNumber}</td>
        </tr>
      ))
      const moreRow: ReadonlyArray<PreviewRow> =
        groupChanges.length > visible.length
          ? [
              <tr key={`more-${group.sceneId}`}>
                <td colSpan={3} className="px-3 py-1 text-2xs text-[var(--color-text-muted)]">
                  {"\u2026"} and {groupChanges.length - visible.length} more in this scene
                </td>
              </tr>,
            ]
          : []

      return {
        rendered: acc.rendered + visible.length,
        rows: [...acc.rows, header, ...changeRows, ...moreRow],
      }
    },
    { rows: [], rendered: 0 },
  )

  // Phase 2: ungrouped shots
  if (scenePhase.rendered >= previewLimit || ungroupedShots.length === 0) {
    return scenePhase.rows
  }
  const ungroupedChanges = changes.filter((c) => c.sceneId === "")
  if (ungroupedChanges.length === 0) {
    return scenePhase.rows
  }
  const visible = ungroupedChanges.slice(0, previewLimit - scenePhase.rendered)
  const ungroupedHeader: PreviewRow = (
    <tr key="header-ungrouped" className="bg-[var(--color-surface-subtle)]">
      <td colSpan={3} className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-muted)]">
        Ungrouped
      </td>
    </tr>
  )
  const ungroupedChangeRows: ReadonlyArray<PreviewRow> = visible.map((c) => (
    <tr key={c.shotId} className="border-b border-[var(--color-border)] last:border-0">
      <td className="px-3 py-1.5 text-[var(--color-text-muted)]">{c.currentNumber}</td>
      <td className="px-3 py-1.5 text-center text-[var(--color-text-subtle)]">{"\u2192"}</td>
      <td className="px-3 py-1.5 font-medium text-[var(--color-status-blue-text)]">{c.newNumber}</td>
    </tr>
  ))
  const ungroupedMoreRow: ReadonlyArray<PreviewRow> =
    ungroupedChanges.length > visible.length
      ? [
          <tr key="more-ungrouped">
            <td colSpan={3} className="px-3 py-1 text-2xs text-[var(--color-text-muted)]">
              {"\u2026"} and {ungroupedChanges.length - visible.length} more ungrouped
            </td>
          </tr>,
        ]
      : []

  return [...scenePhase.rows, ungroupedHeader, ...ungroupedChangeRows, ...ungroupedMoreRow]
}

function ScenePreviewRows({ changes, sceneGroups, ungroupedShots, previewLimit }: ScenePreviewRowsProps) {
  const rows = buildScenePreviewRowsState(changes, sceneGroups, ungroupedShots, previewLimit)
  return <>{rows}</>
}
