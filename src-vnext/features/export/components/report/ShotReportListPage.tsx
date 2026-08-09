import { useCallback, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Copy, FileText, Pencil, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { isFeatureEnabled } from "@/shared/lib/flags"
import { badgeVariants } from "@/ui/badge"
import { Button, buttonVariants } from "@/ui/button"
import { Input } from "@/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { useExportReports } from "../../hooks/useExportReports"
import {
  DEFAULT_REPORT_CONFIG,
  REPORT_LAYOUT_LABEL,
  REPORT_LAYOUT_OPTIONS,
  resolveReportLayout,
  type ReportConfig,
  type ReportLayout,
} from "../../lib/report/reportTypes"

// Saved shot reports for a project: create (optionally cloning an existing
// report's config as a recipe), open, and delete. Sits beside the single report
// page; never touches the legacy block-canvas builder. Flag-gated route.

export default function ShotReportListPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { clientId } = useAuth()
  const navigate = useNavigate()
  const { reports, loading, createShotReport, loadReport, deleteReport, renameReport } =
    useExportReports(clientId, projectId)

  const shotReports = useMemo(
    () => reports.filter((r) => r.reportType === "shot-report"),
    [reports],
  )

  const recipesEnabled = isFeatureEnabled("featureShotReportRecipes")
  const reportConfigEnabled = isFeatureEnabled("featureReportConfig")
  const [newName, setNewName] = useState("")
  // Picker starts on the shipped default recipe (production-sheet as of the
  // 2026-08-09 decision) rather than a hardcoded "image-led" literal, so it
  // can't drift from DEFAULT_REPORT_CONFIG if the default changes again.
  const [recipe, setRecipe] = useState<ReportLayout>(DEFAULT_REPORT_CONFIG.layout ?? "image-led")
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)
  const [pendingRename, setPendingRename] = useState<{ id: string; name: string } | null>(null)
  const [renameDraft, setRenameDraft] = useState("")

  const openReport = useCallback(
    (reportId: string) => navigate(`/projects/${projectId}/export/report?reportId=${reportId}`),
    [navigate, projectId],
  )

  const handleCreate = useCallback(async () => {
    setBusy(true)
    try {
      // Recipes flag-off => always image-led (via the shared clamp, NOT a raw
      // DEFAULT_REPORT_CONFIG spread — DEFAULT_REPORT_CONFIG.layout is now
      // production-sheet, so spreading it verbatim would persist the new
      // default into a doc created while the flag is off: dev/preview, or a
      // flag rollback, would then smuggle an unreviewed layout into prod).
      const config = recipesEnabled
        ? { ...DEFAULT_REPORT_CONFIG, layout: recipe }
        : { ...DEFAULT_REPORT_CONFIG, layout: resolveReportLayout(DEFAULT_REPORT_CONFIG, recipesEnabled) }
      const id = await createShotReport(newName.trim() || "Untitled report", config)
      setNewName("")
      openReport(id)
    } catch {
      toast.error("Couldn't create the report")
    } finally {
      setBusy(false)
    }
  }, [createShotReport, newName, openReport, recipe, recipesEnabled])

  const handleDuplicate = useCallback(
    async (sourceId: string, sourceName: string) => {
      setBusy(true)
      try {
        const full = await loadReport(sourceId)
        // This list only handles shot-report docs; config narrows to ReportConfig.
        // createShotReport always writes a config, so the fallback below is
        // defensive-only (a malformed/legacy doc) — still clamp its layout so
        // that edge case can't smuggle the new default past a flag-off create.
        const sourceConfig = (full?.config as ReportConfig | undefined) ?? {
          ...DEFAULT_REPORT_CONFIG,
          layout: resolveReportLayout(DEFAULT_REPORT_CONFIG, recipesEnabled),
        }
        const id = await createShotReport(`${sourceName} (copy)`, sourceConfig)
        openReport(id)
      } catch {
        toast.error("Couldn't duplicate the report")
      } finally {
        setBusy(false)
      }
    },
    [createShotReport, loadReport, openReport, recipesEnabled],
  )

  const handleDelete = useCallback(
    async (reportId: string) => {
      try {
        await deleteReport(reportId)
        toast.success("Report deleted")
      } catch {
        toast.error("Couldn't delete the report")
      }
    },
    [deleteReport],
  )

  const openRename = useCallback((id: string, name: string) => {
    setPendingRename({ id, name })
    setRenameDraft(name)
  }, [])

  const handleRename = useCallback(async () => {
    if (!pendingRename) return
    const name = renameDraft.trim()
    setPendingRename(null)
    if (!name || name === pendingRename.name) return
    try {
      await renameReport(pendingRename.id, name)
      toast.success("Report renamed")
    } catch {
      toast.error("Couldn't rename the report")
    }
  }, [pendingRename, renameDraft, renameReport])

  return (
    <div className="mx-auto w-full max-w-3xl">
      <PageHeader title="Shot Reports" />

      <div className="mb-6 flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void handleCreate()
          }}
          placeholder="New report name…"
          aria-label="New report name"
          className="flex-1"
        />
        {recipesEnabled && (
          <Select value={recipe} onValueChange={(v) => setRecipe(v as ReportLayout)}>
            <SelectTrigger className="w-40" aria-label="Report recipe">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_LAYOUT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button onClick={() => void handleCreate()} disabled={busy}>
          <Plus /> Create report
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--color-text-muted)]">Loading…</p>
      ) : shotReports.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No shot reports yet"
          description="Create a report above to lay your shots out as an image-led deck, then export it as a PDF."
        />
      ) : (
        <ul className="divide-y divide-[var(--color-border)] rounded-md border border-[var(--color-border)]">
          {shotReports.map((r) => (
            <li key={r.id} className="flex items-center gap-2 p-3">
              <button
                type="button"
                onClick={() => openReport(r.id)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                  {r.name}
                </span>
                {(recipesEnabled || r.updatedAt) && (
                  <span className="block text-xs text-[var(--color-text-muted)]">
                    {recipesEnabled && (
                      <span className={`${badgeVariants({ variant: "secondary" })} mr-2`}>
                        {REPORT_LAYOUT_LABEL[r.layout]}
                      </span>
                    )}
                    {r.updatedAt ? `Updated ${r.updatedAt.toLocaleDateString()}` : null}
                  </span>
                )}
              </button>
              <Button variant="outline" size="sm" onClick={() => openReport(r.id)}>
                Open
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void handleDuplicate(r.id, r.name)}
                disabled={busy}
                title="New report from this one's settings"
              >
                <Copy /> Recipe
              </Button>
              {reportConfigEnabled && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openRename(r.id, r.name)}
                  disabled={busy}
                  aria-label={`Rename ${r.name}`}
                >
                  <Pencil />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPendingDelete({ id: r.id, name: r.name })}
                disabled={busy}
                aria-label={`Delete ${r.name}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.name}” will be permanently deleted. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              onClick={() => {
                if (pendingDelete) void handleDelete(pendingDelete.id)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {reportConfigEnabled && (
        <Dialog
          open={pendingRename !== null}
          onOpenChange={(open) => {
            if (!open) setPendingRename(null)
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename report</DialogTitle>
            </DialogHeader>
            <Input
              value={renameDraft}
              onChange={(e) => setRenameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameDraft.trim()) void handleRename()
              }}
              placeholder="Report name…"
              aria-label="Report name"
              autoFocus
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingRename(null)}>
                Cancel
              </Button>
              <Button disabled={!renameDraft.trim()} onClick={() => void handleRename()}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
