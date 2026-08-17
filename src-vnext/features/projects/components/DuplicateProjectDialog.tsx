import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { collection, getCountFromServer, query, where } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { useAuth } from "@/app/providers/AuthProvider"
import { lanesPath, shotsPath } from "@/shared/lib/paths"
import { duplicateProject, DuplicateProjectPartialFailureError } from "@/features/projects/lib/duplicateProject"
import type { Project } from "@/shared/types"
import { toast } from "sonner"
import { ResponsiveDialog } from "@/shared/components/ResponsiveDialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { Label } from "@/ui/label"

interface DuplicateProjectDialogProps {
  readonly project: Project
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

interface SourceCounts {
  readonly laneCount: number
  readonly shotCount: number
}

async function loadSourceCounts(clientId: string, projectId: string): Promise<SourceCounts> {
  const lanesSegs = lanesPath(projectId, clientId)
  const shotsSegs = shotsPath(clientId)

  const [lanesSnap, shotsSnap] = await Promise.all([
    getCountFromServer(collection(db, lanesSegs[0]!, ...lanesSegs.slice(1))),
    getCountFromServer(
      query(
        collection(db, shotsSegs[0]!, ...shotsSegs.slice(1)),
        where("projectId", "==", projectId),
        where("deleted", "==", false),
      ),
    ),
  ])

  return { laneCount: lanesSnap.data().count, shotCount: shotsSnap.data().count }
}

export function DuplicateProjectDialog({ project, open, onOpenChange }: DuplicateProjectDialogProps) {
  const { clientId, role, user } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState(`${project.name} (Copy)`)
  const [counts, setCounts] = useState<SourceCounts | null>(null)
  const [countsLoading, setCountsLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(`${project.name} (Copy)`)
    setError(null)
    if (!clientId) return
    setCountsLoading(true)
    setCounts(null)
    loadSourceCounts(clientId, project.id)
      .then(setCounts)
      .catch((err) => {
        console.error("[DuplicateProjectDialog] Failed to load source counts:", err)
      })
      .finally(() => setCountsLoading(false))
  }, [open, project.id, project.name, clientId])

  const handleDuplicate = async () => {
    const trimmedName = name.trim()
    if (!trimmedName || !clientId || saving) return

    setSaving(true)
    setError(null)
    try {
      const result = await duplicateProject({
        clientId,
        sourceProjectId: project.id,
        newName: trimmedName,
        role,
        user,
      })
      toast.success("Project duplicated", {
        description: `${result.shotCount} shot${result.shotCount === 1 ? "" : "s"} across ${result.laneCount} set${result.laneCount === 1 ? "" : "s"}.`,
      })
      onOpenChange(false)
      navigate(`/projects/${result.newProjectId}/shots`)
    } catch (err) {
      if (err instanceof DuplicateProjectPartialFailureError) {
        setError(err.message)
        toast.error("Project duplicated partially", { description: err.message })
      } else {
        const message = err instanceof Error ? err.message : "Failed to duplicate project"
        setError(message)
        toast.error("Failed to duplicate project", { description: message })
      }
    } finally {
      setSaving(false)
    }
  }

  const countsLabel = countsLoading
    ? "Counting sets and shots…"
    : counts
      ? `${counts.laneCount} set${counts.laneCount === 1 ? "" : "s"}, ${counts.shotCount} shot${counts.shotCount === 1 ? "" : "s"} will be copied.`
      : null

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next)
      }}
      title="Duplicate project"
      description={`Create a copy of "${project.name}" with all its sets and shots.`}
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleDuplicate()} disabled={!name.trim() || saving}>
            {saving ? "Duplicating…" : "Duplicate"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="duplicate-project-name">New project name</Label>
          <Input
            id="duplicate-project-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            disabled={saving}
          />
        </div>

        {countsLabel && (
          <p className="text-xs text-[var(--color-text-muted)]">{countsLabel}</p>
        )}

        <p className="text-xs text-[var(--color-text-subtle)]">
          Status, dates, shot numbers, and order are preserved exactly. Pulls, schedules, and
          casting are not copied.
        </p>

        {error && (
          <p className="text-xs text-[var(--color-error)]" role="alert">
            {error}
          </p>
        )}
      </div>
    </ResponsiveDialog>
  )
}
