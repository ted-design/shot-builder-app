import { useCallback, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { toast } from "sonner"
import { Copy, FileText, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/app/providers/AuthProvider"
import { isFeatureEnabled } from "@/shared/lib/flags"
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
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { useExportReports } from "../../hooks/useExportReports"
import {
  DEFAULT_REPORT_CONFIG,
  REPORT_LAYOUT_LABEL,
  REPORT_LAYOUT_OPTIONS,
  type ReportLayout,
} from "../../lib/report/reportTypes"

// Saved shot reports for a project: create (optionally cloning an existing
// report's config as a recipe), open, and delete. Sits beside the single report
// page; never touches the legacy block-canvas builder. Flag-gated route.

export default function ShotReportListPage() {
  const { id: projectId } = useParams<{ id: string }>()
  const { clientId } = useAuth()
  const navigate = useNavigate()
  const { reports, loading, createShotReport, loadReport, deleteReport } =
    useExportReports(clientId, projectId)

  const shotReports = useMemo(
    () => reports.filter((r) => r.reportType === "shot-report"),
    [reports],
  )

  const recipesEnabled = isFeatureEnabled("featureShotReportRecipes")
  const [newName, setNewName] = useState("")
  const [recipe, setRecipe] = useState<ReportLayout>("image-led")
  const [busy, setBusy] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null)

  const openReport = useCallback(
    (reportId: string) => navigate(`/projects/${projectId}/export/report?reportId=${reportId}`),
    [navigate, projectId],
  )

  const handleCreate = useCallback(async () => {
    setBusy(true)
    try {
      // Recipes flag-off => always image-led, so the create config can't smuggle
      // an unreviewed layout into prod.
      const config = recipesEnabled
        ? { ...DEFAULT_REPORT_CONFIG, layout: recipe }
        : DEFAULT_REPORT_CONFIG
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
        const id = await createShotReport(`${sourceName} (copy)`, full?.config ?? DEFAULT_REPORT_CONFIG)
        openReport(id)
      } catch {
        toast.error("Couldn't duplicate the report")
      } finally {
        setBusy(false)
      }
    },
    [createShotReport, loadReport, openReport],
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
                      <span className="mr-2 rounded-sm bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[var(--color-text-secondary)]">
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
    </div>
  )
}
