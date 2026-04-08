import { useEffect, useState } from "react"
import { Loader2, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import {
  checkTalentDependencies,
  type TalentDependencies,
} from "@/features/library/lib/talentDependencies"

interface DeleteTalentDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly talentName: string
  readonly clientId: string
  readonly talentId: string
  readonly projectIds: readonly string[]
  readonly projectLookup: ReadonlyMap<string, string>
  readonly busy: boolean
  readonly onConfirm: () => void
}

export function DeleteTalentDialog({
  open,
  onOpenChange,
  talentName,
  clientId,
  talentId,
  projectIds,
  projectLookup,
  busy,
  onConfirm,
}: DeleteTalentDialogProps) {
  const [checking, setChecking] = useState(false)
  const [deps, setDeps] = useState<TalentDependencies | null>(null)
  const [confirmText, setConfirmText] = useState("")
  const [shotsExpanded, setShotsExpanded] = useState(false)
  const [castingExpanded, setCastingExpanded] = useState(false)

  useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setDeps(null)
      setConfirmText("")
      setShotsExpanded(false)
      setCastingExpanded(false)
      return
    }

    if (!clientId || !talentId) return

    setChecking(true)
    checkTalentDependencies({ clientId, talentId, projectIds })
      .then((result) => {
        setDeps(result)
      })
      .catch(() => {
        // Degrade gracefully — allow delete even if check fails
        setDeps({ shots: [], castingBoardProjects: [], totalReferences: 0 })
      })
      .finally(() => {
        setChecking(false)
      })
  }, [open, clientId, talentId, projectIds])

  const canConfirm = confirmText === "DELETE" && !busy

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete talent?</DialogTitle>
        </DialogHeader>

        {checking || deps === null ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--color-text-muted)]" />
          </div>
        ) : (
          <div className="grid gap-4">
            {deps.totalReferences > 0 && (
              <div className="rounded-md border p-3 bg-[var(--color-status-amber-bg)] border-[var(--color-status-amber-border)] text-[var(--color-status-amber-text)]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="grid gap-2 text-sm">
                    <p className="font-medium">
                      {deps.totalReferences === 1
                        ? "1 active reference"
                        : `${deps.totalReferences} active references`}
                    </p>

                    {deps.shots.length > 0 && (
                      <div>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs font-medium hover:underline"
                          onClick={() => setShotsExpanded((prev) => !prev)}
                        >
                          {shotsExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {deps.shots.length} shot{deps.shots.length === 1 ? "" : "s"}
                        </button>
                        {shotsExpanded && (
                          <ul className="mt-1 ml-4 grid gap-0.5 text-xs opacity-80">
                            {deps.shots.map((s) => (
                              <li key={s.id}>{s.title}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}

                    {deps.castingBoardProjects.length > 0 && (
                      <div>
                        <button
                          type="button"
                          className="flex items-center gap-1 text-xs font-medium hover:underline"
                          onClick={() => setCastingExpanded((prev) => !prev)}
                        >
                          {castingExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {deps.castingBoardProjects.length} casting board{" "}
                          {deps.castingBoardProjects.length === 1 ? "entry" : "entries"}
                        </button>
                        {castingExpanded && (
                          <ul className="mt-1 ml-4 grid gap-0.5 text-xs opacity-80">
                            {deps.castingBoardProjects.map((p) => (
                              <li key={p.id}>{projectLookup.get(p.id) ?? p.id}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--color-text-muted)]">
              This will archive <span className="font-medium">{talentName}</span>. References will
              show as &ldquo;unknown talent&rdquo;. You can undo this immediately after.
            </p>

            <div>
              <div className="label-meta mb-1">Type DELETE to confirm</div>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                disabled={busy}
                aria-label="Type DELETE to confirm"
                autoComplete="off"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
            disabled={!canConfirm || checking || deps === null}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete talent"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
